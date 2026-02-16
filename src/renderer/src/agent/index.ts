import type { Settings, Message, ToolCall, ToolResult } from '../types'
import { getTools, executeToolCall } from './tools'

interface AgentOptions {
    chatId: string
    userMessage: string
    projectPath: string
    settings: Settings
    superAgentMode: boolean
    onStatusUpdate: (status: string) => void
    onMessageAdded: (message: Message) => void
    onStreamUpdate?: (partialContent: string) => void
    onPlanReady?: (plan: string) => Promise<string | null>
    onChecklistInit?: (tasks: string[]) => void
    onChecklistTaskUpdate?: (taskIndex: number, status: 'in-progress' | 'completed' | 'failed') => void
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
- Use proper naming conventions (PascalCase for services, camelCase for variables)
- Follow Roblox best practices
- Include type annotations where appropriate
- Add comments for complex logic

When you've completed the user's request, provide a summary of what you did.`

const SUPER_AGENT_SYSTEM_PROMPT = `${SYSTEM_PROMPT}

You are in SUPER AGENT MODE. For complex tasks:
1. First create a plan with clear steps and show it to the user before doing anything else
2. Execute each step methodically
3. After each step, verify it worked correctly
4. If a step fails, try an alternative approach
5. Keep the user informed of progress

Format your plan as:
## Plan
1. Step one description
2. Step two description
...

Then execute each step, marking them as complete.`

const SUPER_AGENT_PLAN_ENFORCER = `In this mode, your first assistant response MUST be a plan for the user and MUST include a markdown section titled exactly "## Plan".
Do not call tools until after the plan message has been sent.`

interface StreamedAssistantMessage {
    content: string
    reasoning?: string
    tool_calls?: any[]
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

    // Build messages for API
    const chatData = await window.api.chats.get(chatId)
    if (!chatData) throw new Error('Chat not found')

    const messages: Array<any> = [
        { role: 'system', content: superAgentMode ? SUPER_AGENT_SYSTEM_PROMPT : SYSTEM_PROMPT }
    ]

    // Add conversation history (limit to last 20 messages to save tokens)
    const recentMessages = chatData.messages.slice(-20)
    for (const msg of recentMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
            messages.push({ role: msg.role, content: msg.content })
        }
    }

    let iterations = 0
    let hasPresentedPlan = false
    let checklistTasks: string[] = []
    let checklistCursor = 0

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
            const reasoning =
                typeof assistantMessage.reasoning === 'string'
                    ? assistantMessage.reasoning
                    : undefined

            if (superAgentMode && !hasPresentedPlan) {
                const includesPlanHeader = (assistantMessage.content || '').includes('## Plan')
                if (!assistantMessage.tool_calls?.length && includesPlanHeader) {
                    const reviewedPlan = await onPlanReady?.(assistantMessage.content || '')
                    if (reviewedPlan === null) {
                        throw new Error('Request stopped by user.')
                    }

                    const finalPlan = reviewedPlan || assistantMessage.content || ''
                    const planLines = finalPlan
                        .split('\n')
                        .map(line => line.trim())
                        .filter(line => /^\d+\.\s+/.test(line))
                        .map(line => line.replace(/^\d+\.\s+/, '').trim())

                    checklistTasks = planLines
                    checklistCursor = 0
                    onChecklistInit?.(planLines)

                    const planMsg = await window.api.chats.addMessage(chatId, {
                        role: 'assistant',
                        content: finalPlan,
                        reasoning
                    })
                    if (planMsg) onMessageAdded(planMsg)

                    messages.push({
                        role: 'assistant',
                        content: finalPlan
                    })

                    hasPresentedPlan = true
                    onStreamUpdate?.('')
                    continue
                }
            }

            // Check if there are tool calls
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                // Save assistant message with tool calls
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

                // Execute tool calls
                const toolResults: ToolResult[] = []
                for (const toolCall of toolCalls) {
                    if (superAgentMode && checklistCursor < checklistTasks.length) {
                        onChecklistTaskUpdate?.(checklistCursor, 'in-progress')
                    }

                    onStatusUpdate(`Executing: ${toolCall.name}`)

                    const result = await executeToolCall(toolCall.name, toolCall.arguments, projectPath)
                    toolResults.push({
                        toolCallId: toolCall.id,
                        result: result.success ? result.data : result.error,
                        error: result.success ? undefined : result.error
                    })

                    if (superAgentMode && checklistCursor < checklistTasks.length) {
                        onChecklistTaskUpdate?.(checklistCursor, result.success ? 'completed' : 'failed')
                        checklistCursor++
                    }
                }

                // Save tool results as a message
                const toolMsg = await window.api.chats.addMessage(chatId, {
                    role: 'assistant',
                    content: '',
                    toolResults
                })
                if (toolMsg) onMessageAdded(toolMsg)

                // Add to messages for next iteration
                messages.push({
                    role: 'assistant',
                    content: assistantMessage.content || '',
                    tool_calls: assistantMessage.tool_calls
                })

                // Add tool results to messages
                for (let i = 0; i < toolCalls.length; i++) {
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCalls[i].id,
                        content: JSON.stringify(toolResults[i].result)
                    })
                }

            } else {
                // No tool calls - agent is done
                const finalMsg = await window.api.chats.addMessage(chatId, {
                    role: 'assistant',
                    content: assistantMessage.content || '',
                    reasoning
                })
                if (finalMsg) onMessageAdded(finalMsg)

                onStatusUpdate('Done!')
                return
            }

            // Check if agent explicitly signals completion
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
