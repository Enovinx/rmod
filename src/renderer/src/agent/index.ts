import type { Settings, Message, ToolCall, ToolResult, SuperAgentPlanTaskPayload } from '../types'
import { getTools, executeToolCall } from './tools'

interface PlanReviewResult {
    action: 'approve' | 'revise' | 'cancel'
    planText?: string
    feedback?: string
}

interface AgentOptions {
    chatId: string
    userMessage: string
    projectPath: string
    projectId: string
    syncMode: 'filesystem'
    settings: Settings
    superAgentMode: boolean
    onStatusUpdate: (status: string) => void
    onMessageAdded: (message: Message) => void
    onStreamUpdate?: (partialContent: string) => void
    onPlanReady?: (plan: string) => Promise<PlanReviewResult>
    onChecklistInit?: (tasks: SuperAgentPlanTaskPayload[]) => void
    onChecklistTaskUpdate?: (taskId: string, status: 'in-progress' | 'completed' | 'failed', note?: string) => void
    signal?: AbortSignal
}

const SYSTEM_PROMPT = `You are an AI coding assistant for Roblox game development. You help users write, edit, and manage Luau code files.

You have access to tools to:
- Read files from the project
- Create new files
- Edit existing files
- Delete files
- Search for files or content
- List directory contents

MAKE SURE TO USE THE TOOLS WHEN NEEDED

When the user asks you to do something:
1. First understand what they want
2. Use the appropriate tools to accomplish the task
3. Explain what you did and show relevant code

Be concise but helpful. When editing code, make sure to preserve existing functionality unless asked to remove it.

For Roblox/Luau code:
- Use :GetService() to get services, dont use game.ServiceName as this is a bad practice
- Use proper naming conventions (PascalCase for services, camelCase for variables)
- Follow Roblox best practices
- Include type annotations where appropriate
- Add comments for complex logic
MAKE SURE TO NOT MAKE UP PROPERTIES OR ROBLOX LUAU SYNTAX, MAKE SURE TO USE CORRECT ROBLOX LUAU SYNTAX AND PROPERTIES


IMPORTANT When creating files with write_file:
    Use type Folder, ModuleScript, LocalScript, or ServerScript when creating a file.

Make sure before you write a file you know where you want to put, use filesystem searching commands to know where it is supposed to go.

Be hard working and don't be lazy, go above and beyond in your work.

When you've completed the user's request, provide a summary of what you did.`

const SUPER_AGENT_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

You are in SUPER AGENT MODE.

Workflow:
1. Explore the project FIRST (at minimum use list_directory on "." and inspect relevant files).
2. Use the create_plan tool to draft a structured plan.
3. Present the plan to the user for approval before making code changes.
4. After approval, execute tasks methodically.
5. Use update_task_status to mark each task as in-progress/completed/failed.

Plan response format must include:
- ## Plan
- ## Files To Create
- ## Implementation Approach
- ## Task Checklist (JSON)

The Task Checklist must be valid JSON and contain an array of task objects with stable ids and descriptions.

Do not start implementation before user approval.`

const SUPER_AGENT_PLAN_ENFORCER = `Before implementation, provide a visible plan that includes a markdown section titled exactly "## Plan" and a section titled exactly "## Task Checklist (JSON)".`

interface StreamedAssistantMessage {
    content: string
    reasoning?: string
    tool_calls?: any[]
}

function parsePlanTasks(planText: string): SuperAgentPlanTaskPayload[] {
    const jsonBlock = planText.match(/##\s*Task Checklist \(JSON\)[\s\S]*?```json\s*([\s\S]*?)```/i)
    if (jsonBlock?.[1]) {
        try {
            const parsed = JSON.parse(jsonBlock[1])
            if (Array.isArray(parsed)) {
                return parsed
                    .map((task: any, index) => ({
                        id: String(task.id || `task-${index + 1}`),
                        title: typeof task.title === 'string' ? task.title : undefined,
                        description: String(task.description || task.title || `Task ${index + 1}`)
                    }))
                    .filter(task => task.description)
            }
        } catch {
            // Fall back to numbered plan items.
        }
    }

    return planText
        .split('\n')
        .map(line => line.trim())
        .filter(line => /^\d+\.\s+/.test(line))
        .map((line, index) => ({
            id: `task-${index + 1}`,
            description: line.replace(/^\d+\.\s+/, '').trim()
        }))
}

async function streamChatCompletion(params: {
    presetModelId: string
    messages: any[]
    tools: any[]
    temperature: number
    maxTokens: number
    openRouterKey: string
    signal?: AbortSignal
    onToken?: (content: string) => void
}): Promise<{ message: StreamedAssistantMessage; finishReason?: string }> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${params.openRouterKey}`,
            'HTTP-Referer': 'https://rmod.app',
            'X-Title': 'RMod'
        },
        body: JSON.stringify({
            model: params.presetModelId,
            messages: params.messages,
            tools: params.tools,
            tool_choice: 'auto',
            include_reasoning: true,
            temperature: params.temperature,
            max_tokens: params.maxTokens,
            stream: true
        }),
        signal: params.signal
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`API error: ${response.status} - ${error}`)
    }

    if (!response.body) {
        throw new Error('Streaming unavailable: response body is empty')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let finishReason: string | undefined
    const assembled: StreamedAssistantMessage = { content: '', tool_calls: [] }

    while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
            const line = event
                .split('\n')
                .find((entry) => entry.trim().startsWith('data:'))

            if (!line) continue
            const data = line.replace(/^data:\s*/, '').trim()
            if (!data || data === '[DONE]') continue

            let parsed: any
            try {
                parsed = JSON.parse(data)
            } catch {
                continue
            }

            const delta = parsed?.choices?.[0]?.delta || {}
            finishReason = parsed?.choices?.[0]?.finish_reason ?? finishReason

            if (typeof delta.content === 'string' && delta.content.length > 0) {
                assembled.content += delta.content
                params.onToken?.(assembled.content)
            }

            if (typeof delta.reasoning === 'string' && delta.reasoning.length > 0) {
                assembled.reasoning = (assembled.reasoning || '') + delta.reasoning
            }

            if (Array.isArray(delta.tool_calls)) {
                for (const toolCallChunk of delta.tool_calls) {
                    const idx = toolCallChunk.index ?? 0
                    if (!assembled.tool_calls![idx]) {
                        assembled.tool_calls![idx] = {
                            id: '',
                            type: 'function',
                            function: { name: '', arguments: '' }
                        }
                    }

                    const target = assembled.tool_calls![idx]
                    if (toolCallChunk.id) target.id = toolCallChunk.id
                    if (toolCallChunk.function?.name) target.function.name += toolCallChunk.function.name
                    if (toolCallChunk.function?.arguments) target.function.arguments += toolCallChunk.function.arguments
                }
            }
        }
    }

    return { message: assembled, finishReason }
}

export async function runAgent(options: AgentOptions): Promise<void> {
    const {
        chatId,
        userMessage,
        projectPath,
        projectId,
        syncMode,
        settings,
        superAgentMode,
        onStatusUpdate,
        onMessageAdded,
        onStreamUpdate,
        onPlanReady,
        onChecklistInit,
        onChecklistTaskUpdate,
        signal
    } = options

    const preset = settings.modelPresets.find(p => p.id === settings.activeModelPreset)
        || settings.modelPresets[0]

    const tools = getTools()

    const chatData = await window.api.chats.get(chatId)
    if (!chatData) throw new Error('Chat not found')

    const messages: Array<any> = [
        { role: 'system', content: superAgentMode ? SUPER_AGENT_SYSTEM_PROMPT : SYSTEM_PROMPT }
    ]

    const recentMessages = chatData.messages.slice(-20)
    for (const msg of recentMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content })
        }
    }

    let iterations = 0
    let hasPresentedPlan = false

    while (true) {
        if (signal?.aborted) {
            throw new Error('Request stopped by user.')
        }

        iterations++
        onStatusUpdate(`Thinking... (step ${iterations})`)

        try {
            const callMessages = [...messages]
            if (superAgentMode && !hasPresentedPlan) {
                callMessages.push({ role: 'system', content: SUPER_AGENT_PLAN_ENFORCER })
            }

            const { message: assistantMessage, finishReason } = await streamChatCompletion({
                presetModelId: preset.modelId,
                messages: callMessages,
                tools,
                temperature: preset.temperature,
                maxTokens: preset.maxTokens,
                openRouterKey: settings.openRouterKey,
                signal,
                onToken: onStreamUpdate
            })

            const reasoning = typeof assistantMessage.reasoning === 'string'
                ? assistantMessage.reasoning
                : undefined

            if (superAgentMode && !hasPresentedPlan) {
                const includesPlanHeader = (assistantMessage.content || '').includes('## Plan')
                if (!assistantMessage.tool_calls?.length && includesPlanHeader) {
                    const review = await onPlanReady?.(assistantMessage.content || '')
                    if (!review || review.action === 'cancel') {
                        throw new Error('Request stopped by user.')
                    }

                    if (review.action === 'revise') {
                        const revisionMessage = review.feedback?.trim() || 'Please revise the plan.'
                        messages.push({
                            role: 'assistant',
                            content: assistantMessage.content || ''
                        })
                        messages.push({
                            role: 'user',
                            content: `Please revise the super agent plan based on this feedback: ${revisionMessage}`
                        })
                        onStreamUpdate?.('')
                        continue
                    }

                    const finalPlan = review.planText || assistantMessage.content || ''
                    onChecklistInit?.(parsePlanTasks(finalPlan))

                    const planMsg = await window.api.chats.addMessage(chatId, {
                        role: 'assistant',
                        content: finalPlan,
                        reasoning
                    })
                    if (planMsg) onMessageAdded(planMsg)

                    messages.push({ role: 'assistant', content: finalPlan })
                    hasPresentedPlan = true
                    onStreamUpdate?.('')
                    continue
                }
            }

            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                const toolCalls: ToolCall[] = assistantMessage.tool_calls.map((tc: any) => ({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: (() => {
                        try {
                            return JSON.parse(tc.function.arguments || '{}')
                        } catch {
                            return {}
                        }
                    })()
                }))

                const savedMsg = await window.api.chats.addMessage(chatId, {
                    role: 'assistant',
                    content: assistantMessage.content || '',
                    reasoning,
                    toolCalls
                })
                if (savedMsg) onMessageAdded(savedMsg)

                const toolResults: ToolResult[] = []
                for (const toolCall of toolCalls) {
                    onStatusUpdate(`Executing: ${toolCall.name}`)

                    const result = await executeToolCall(toolCall.name, toolCall.arguments, projectPath, {
                        syncMode,
                        projectId
                    })
                    toolResults.push({
                        toolCallId: toolCall.id,
                        result: result.success ? result.data : result.error,
                        error: result.success ? undefined : result.error
                    })

                    if (toolCall.name === 'update_task_status') {
                        const statusArg = toolCall.arguments.status
                        if (typeof toolCall.arguments.taskId === 'string'
                            && (statusArg === 'in-progress' || statusArg === 'completed' || statusArg === 'failed')) {
                            const noteArg = toolCall.arguments.note
                            onChecklistTaskUpdate?.(
                                toolCall.arguments.taskId,
                                statusArg,
                                typeof noteArg === 'string' ? noteArg : undefined
                            )
                        }
                    }
                }

                const toolMsg = await window.api.chats.addMessage(chatId, {
                    role: 'assistant',
                    content: '',
                    toolResults
                })
                if (toolMsg) onMessageAdded(toolMsg)

                messages.push({
                    role: 'assistant',
                    content: assistantMessage.content || '',
                    tool_calls: assistantMessage.tool_calls
                })

                for (let i = 0; i < toolCalls.length; i++) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCalls[i].id,
                        content: JSON.stringify(toolResults[i].result)
                    })
                }
            } else {
                const finalMsg = await window.api.chats.addMessage(chatId, {
                    role: 'assistant',
                    content: assistantMessage.content || '',
                    reasoning
                })
                if (finalMsg) onMessageAdded(finalMsg)

                onStatusUpdate('Done!')
                return
            }

            if (finishReason === 'stop' && !assistantMessage.tool_calls) {
                onStatusUpdate('Done!')
                return
            }
        } catch (error) {
            console.error('Agent error:', error)
            throw error
        }
    }
}
