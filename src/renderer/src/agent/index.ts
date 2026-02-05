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
}

const SYSTEM_PROMPT = `You are an AI coding assistant for Roblox game development. You help users write, edit, and manage Luau code files.

You have access to tools to:
- Read files from the project
- Create new files
- Edit existing files
- Delete files
- Search for files or content
- List directory contents

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
1. First create a plan with clear steps
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

export async function runAgent(options: AgentOptions): Promise<void> {
    const {
        chatId,
        userMessage,
        projectPath,
        settings,
        superAgentMode,
        onStatusUpdate,
        onMessageAdded
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
    const maxIterations = superAgentMode ? 15 : 8

    while (iterations < maxIterations) {
        iterations++
        onStatusUpdate(`Thinking... (step ${iterations})`)

        try {
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.openRouterKey}`,
                    'HTTP-Referer': 'https://roblox-vibe-code.app',
                    'X-Title': 'Roblox Vibe Code'
                },
                body: JSON.stringify({
                    model: preset.modelId,
                    messages,
                    tools,
                    tool_choice: 'auto',
                    temperature: preset.temperature,
                    max_tokens: preset.maxTokens
                })
            })

            if (!response.ok) {
                const error = await response.text()
                throw new Error(`API error: ${response.status} - ${error}`)
            }

            const data = await response.json()
            const choice = data.choices[0]
            const assistantMessage = choice.message

            // Check if there are tool calls
            if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
                // Save assistant message with tool calls
                const toolCalls: ToolCall[] = assistantMessage.tool_calls.map((tc: any) => ({
                    id: tc.id,
                    name: tc.function.name,
                    arguments: JSON.parse(tc.function.arguments)
                }))

                const savedMsg = await window.api.chats.addMessage(chatId, {
                    role: 'assistant',
                    content: assistantMessage.content || '',
                    toolCalls
                })
                if (savedMsg) onMessageAdded(savedMsg)

                // Execute tool calls
                const toolResults: ToolResult[] = []
                for (const toolCall of toolCalls) {
                    onStatusUpdate(`Executing: ${toolCall.name}`)

                    const result = await executeToolCall(toolCall.name, toolCall.arguments, projectPath)
                    toolResults.push({
                        toolCallId: toolCall.id,
                        result: result.success ? result.data : result.error,
                        error: result.success ? undefined : result.error
                    })
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
                    content: assistantMessage.content || ''
                })
                if (finalMsg) onMessageAdded(finalMsg)

                onStatusUpdate('Done!')
                return
            }

            // Check if agent explicitly signals completion
            if (choice.finish_reason === 'stop' && !assistantMessage.tool_calls) {
                onStatusUpdate('Done!')
                return
            }

        } catch (error) {
            console.error('Agent error:', error)
            throw error
        }
    }

    // Max iterations reached
    const maxIterMsg = await window.api.chats.addMessage(chatId, {
        role: 'assistant',
        content: 'I\'ve reached the maximum number of steps. Let me know if you\'d like me to continue or try a different approach.'
    })
    if (maxIterMsg) onMessageAdded(maxIterMsg)
}
