import { useState, useRef, useEffect, useMemo } from 'react'
import type { Chat, Project, Settings, Message, SuperAgentPlan, SuperAgentPlanTaskPayload } from '../types'
import { runAgent } from '../agent'
import MessageBubble from './MessageBubble'
import SuperAgentPanel from './SuperAgentPanel'
import CheckpointViewer from './CheckpointViewer'
import './ChatInterface.css'

interface ChatInterfaceProps {
    chat: Chat
    project: Project
    settings: Settings
    onChatUpdate: (chat: Chat) => void
    onToggleFiles: () => void
    showFileExplorer: boolean
}

export default function ChatInterface({
    chat,
    project,
    settings,
    onChatUpdate,
    onToggleFiles,
    showFileExplorer
}: ChatInterfaceProps) {
    const [input, setInput] = useState('')
    const [isRunning, setIsRunning] = useState(false)
    const [currentAction, setCurrentAction] = useState('')
    const [superAgentMode, setSuperAgentMode] = useState(false)
    const [showCheckpoints, setShowCheckpoints] = useState(false)
    const [streamingContent, setStreamingContent] = useState('')
    const [abortController, setAbortController] = useState<AbortController | null>(null)
    const [pendingPlan, setPendingPlan] = useState<string | null>(null)
    const [planDraft, setPlanDraft] = useState('')
    const [planChangeRequest, setPlanChangeRequest] = useState('')
    const [planResolver, setPlanResolver] = useState<((value: { action: 'approve' | 'revise' | 'cancel'; planText?: string; feedback?: string }) => void) | null>(null)
    const [superAgentPlan, setSuperAgentPlan] = useState<SuperAgentPlan | null>(null)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    useEffect(() => {
        scrollToBottom()
    }, [chat.messages])

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
        }
    }, [input])

    useEffect(() => {
        if (textareaRef.current && !isRunning) {
            textareaRef.current.focus()
        }
    }, [chat.id, isRunning])

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const initializeChecklist = (tasks: SuperAgentPlanTaskPayload[]) => {
        setSuperAgentPlan({
            id: `plan-${Date.now()}`,
            goal: userMessageRef.current || 'Super agent task',
            tasks: tasks.map((task, index) => ({
                id: task.id || `task-${index + 1}`,
                description: task.title ? `${task.title}: ${task.description}` : task.description,
                status: 'pending'
            })),
            createdAt: new Date().toISOString()
        })
    }

    const userMessageRef = useRef('')

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isRunning) return

        const userMessage = input.trim()
        userMessageRef.current = userMessage
        setInput('')
        setIsRunning(true)
        setCurrentAction('Starting...')
        setStreamingContent('')
        setSuperAgentPlan(null)
        const controller = new AbortController()
        setAbortController(controller)

        try {
            const userMsg = await window.api.chats.addMessage(chat.id, {
                role: 'user',
                content: userMessage
            })

            if (userMsg) {
                const updatedChat = { ...chat, messages: [...chat.messages, userMsg] }
                onChatUpdate(updatedChat)
            }

            await window.api.checkpoints.create(chat.id, chat.messages.length, project.folderPath)

            await runAgent({
                chatId: chat.id,
                userMessage,
                projectPath: project.folderPath,
                settings,
                superAgentMode,
                onStatusUpdate: setCurrentAction,
                onStreamUpdate: setStreamingContent,
                signal: controller.signal,
                onPlanReady: async (planText) => {
                    setPendingPlan(planText)
                    setPlanDraft(planText)
                    setPlanChangeRequest('')
                    return await new Promise<{ action: 'approve' | 'revise' | 'cancel'; planText?: string; feedback?: string }>((resolve) => {
                        setPlanResolver(() => resolve)
                    })
                },
                onChecklistInit: (tasks) => {
                    initializeChecklist(tasks)
                },
                onChecklistTaskUpdate: (taskId, status) => {
                    setSuperAgentPlan(prev => {
                        if (!prev) return prev
                        const updatedTasks = prev.tasks.map(task => {
                            if (task.id !== taskId) return task
                            return { ...task, status }
                        })
                        return { ...prev, tasks: updatedTasks }
                    })
                },
                onMessageAdded: async () => {
                    const freshChat = await window.api.chats.get(chat.id)
                    if (freshChat) onChatUpdate(freshChat)
                }
            })

            const finalChat = await window.api.chats.get(chat.id)
            if (finalChat) onChatUpdate(finalChat)
        } catch (error) {
            console.error('Agent error:', error)
            const message = error instanceof Error ? error.message : 'Unknown error occurred'
            await window.api.chats.addMessage(chat.id, {
                role: 'assistant',
                content: message === 'Request stopped by user.'
                    ? 'Stopped. I paused the response as requested.'
                    : `Error: ${message}`
            })
            const errorChat = await window.api.chats.get(chat.id)
            if (errorChat) onChatUpdate(errorChat)
        } finally {
            setIsRunning(false)
            setCurrentAction('')
            setStreamingContent('')
            setAbortController(null)
            setPendingPlan(null)
            setPlanResolver(null)
            setPlanChangeRequest('')
        }
    }

    const handleStop = () => {
        abortController?.abort()
        planResolver?.({ action: 'cancel' })
        setPendingPlan(null)
        setPlanResolver(null)
        setCurrentAction('Stopping...')
    }

    const handleProceedWithPlan = () => {
        planResolver?.({ action: 'approve', planText: planDraft })
        setPendingPlan(null)
        setPlanResolver(null)
    }

    const handleRequestPlanChanges = () => {
        const feedback = planChangeRequest.trim() || 'Please revise the plan and keep the same intent.'
        planResolver?.({ action: 'revise', feedback })
        setPendingPlan(null)
        setPlanResolver(null)
        setPlanChangeRequest('')
    }

    const handleCancelPlan = () => {
        planResolver?.({ action: 'cancel' })
        setPendingPlan(null)
        setPlanResolver(null)
        setPlanChangeRequest('')
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    const planPreview = useMemo<SuperAgentPlan | null>(() => {
        if (!planDraft.trim()) return null

        const planGoal = userMessageRef.current || 'Super agent task'
        const checklistMatch = planDraft.match(/##\s*Task Checklist \(JSON\)[\s\S]*?```json\s*([\s\S]*?)```/i)
        let parsedTasks: SuperAgentPlan['tasks'] = []

        if (checklistMatch?.[1]) {
            try {
                const parsed = JSON.parse(checklistMatch[1])
                if (Array.isArray(parsed)) {
                    parsedTasks = parsed
                        .map((task: any, index) => ({
                            id: String(task.id || `task-${index + 1}`),
                            description: String(task.description || task.title || `Task ${index + 1}`),
                            status: 'pending' as const
                        }))
                        .filter(task => task.description)
                }
            } catch {
                parsedTasks = []
            }
        }

        if (parsedTasks.length === 0) {
            parsedTasks = planDraft
                .split('\n')
                .map(line => line.trim())
                .filter(line => /^\d+\.\s+/.test(line))
                .map((line, index) => ({
                    id: `task-${index + 1}`,
                    description: line.replace(/^\d+\.\s+/, '').trim(),
                    status: 'pending' as const
                }))
        }

        if (parsedTasks.length === 0) return null

        return {
            id: 'plan-preview',
            goal: planGoal,
            tasks: parsedTasks,
            createdAt: new Date().toISOString()
        }
    }, [planDraft])

    const displayMessages = useMemo(() => {
        const merged: Message[] = []

        for (let index = 0; index < chat.messages.length; index++) {
            const msg = chat.messages[index]

            if (msg.role !== 'assistant') {
                merged.push(msg)
                continue
            }

            const assistantRun: Message[] = [msg]
            let cursor = index + 1

            while (cursor < chat.messages.length && chat.messages[cursor].role === 'assistant') {
                assistantRun.push(chat.messages[cursor])
                cursor++
            }

            const textSegments = assistantRun
                .map(item => item.content?.trim())
                .filter((item): item is string => Boolean(item))

            const firstText = textSegments[0] || ''
            const lastText = textSegments[textSegments.length - 1] || ''
            const hasDistinctBoundaryText = firstText && lastText && firstText !== lastText

            const mergedAssistant: Message = {
                ...assistantRun[0],
                content: hasDistinctBoundaryText ? `${firstText}\n\n${lastText}` : (firstText || ''),
                reasoning: assistantRun.map(item => item.reasoning?.trim()).filter(Boolean).join('\n\n') || undefined,
                toolCalls: assistantRun.flatMap(item => item.toolCalls || []),
                toolResults: assistantRun.flatMap(item => item.toolResults || [])
            }

            merged.push(mergedAssistant)
            index = cursor - 1
        }

        return merged
    }, [chat.messages])

    const handleSuggestionClick = (text: string) => {
        setInput(text)
        requestAnimationFrame(() => textareaRef.current?.focus())
    }

    return (
        <div className="chat-interface">
            <header className="chat-header">
                <div className="chat-header-left">
                    <h2 className="chat-title truncate">
                        {chat.messages.length > 0
                            ? chat.messages.find(m => m.role === 'user')?.content.slice(0, 40) || 'Chat'
                            : 'New Chat'}
                    </h2>
                </div>
                <div className="chat-header-actions">
                    <button
                        className={`btn btn-sm ${superAgentMode ? 'btn-primary' : ''}`}
                        onClick={() => setSuperAgentMode(!superAgentMode)}
                        title={superAgentMode ? 'Super Agent Mode ON' : 'Super Agent Mode OFF'}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M7 1L8.545 4.13L12 4.635L9.5 7.07L10.09 10.5L7 8.885L3.91 10.5L4.5 7.07L2 4.635L5.455 4.13L7 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                        Super Agent
                    </button>
                    <button className="btn btn-sm btn-ghost" onClick={() => setShowCheckpoints(true)} title="View checkpoints">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7C2 4.23858 4.23858 2 7 2C9.76142 2 12 4.23858 12 7C12 9.76142 9.76142 12 7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        History
                    </button>
                    <button className={`btn btn-sm ${showFileExplorer ? 'btn-primary' : 'btn-ghost'}`} onClick={onToggleFiles}>
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 4V11C2 11.5523 2.44772 12 3 12H11C11.5523 12 12 11.5523 12 11V5C12 4.44772 11.5523 4 11 4H7L5.5 2.5H3C2.44772 2.5 2 2.94772 2 3.5V4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                        Files
                    </button>
                </div>
            </header>

            {superAgentMode && (
                <div className="super-agent-banner">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M8 6V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span>Super Agent Mode - explores project, drafts a plan, then executes checklist tasks.</span>
                </div>
            )}

            <div className="chat-messages">
                {displayMessages.length === 0 ? (
                    <div className="chat-welcome">
                        <div className="welcome-icon">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                <rect x="4" y="4" width="40" height="40" rx="8" stroke="currentColor" strokeWidth="2" />
                                <path d="M16 20L24 16L32 20V28L24 32L16 28V20Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M24 16V32" stroke="currentColor" strokeWidth="2" />
                            </svg>
                        </div>
                        <h3>How can I help you code today?</h3>
                        <p className="text-secondary">
                            I can read, create, edit, and search files in your project. Just describe what you want to build!
                        </p>
                        <div className="welcome-suggestions">
                            <button onClick={() => handleSuggestionClick('Show me the structure of this project')}>📁 Show project structure</button>
                            <button onClick={() => handleSuggestionClick('Create a new ModuleScript for handling player data')}>✨ Create a new script</button>
                            <button onClick={() => handleSuggestionClick('Find all uses of RemoteEvent in the codebase')}>🔍 Search the codebase</button>
                        </div>
                    </div>
                ) : (
                    displayMessages.map((message, index) => {
                        const previous = displayMessages[index - 1]
                        const showAvatar = message.role === 'assistant' && (!previous || previous.role !== 'assistant')
                        return (
                            <MessageBubble
                                key={message.id || `${message.timestamp}-${index}`}
                                message={message}
                                showAvatar={showAvatar}
                            />
                        )
                    })
                )}

                {isRunning && (
                    <div className="agent-status">
                        <div className="spinner spinner-sm" />
                        <span>{currentAction}</span>
                        <button type="button" className="btn btn-sm btn-ghost" onClick={handleStop}>Stop</button>
                    </div>
                )}

                {isRunning && streamingContent && pendingPlan === null && (
                    <MessageBubble
                        message={{
                            id: 'streaming-preview',
                            role: 'assistant',
                            content: streamingContent,
                            timestamp: new Date().toISOString(),
                            isStreaming: true
                        }}
                        showAvatar={false}
                    />
                )}

                <div ref={messagesEndRef} />
            </div>

            {superAgentMode && superAgentPlan && (
                <div className="super-agent-dock-wrap">
                    <SuperAgentPanel plan={superAgentPlan} onCancel={handleStop} variant="dock" />
                </div>
            )}

            <form className="chat-input-form" onSubmit={handleSubmit}>
                <div className={`chat-input-container ${isRunning ? 'is-disabled' : ''}`}>
                    <textarea
                        ref={textareaRef}
                        className="chat-input"
                        placeholder="Describe what you want to build..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={isRunning}
                    />
                    <button type="submit" className="btn btn-primary send-btn" disabled={!input.trim() || isRunning}>
                        {isRunning ? (
                            <div className="spinner spinner-sm" />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M2 9L16 2L9 16L8 10L2 9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                            </svg>
                        )}
                    </button>
                </div>
            </form>

            {showCheckpoints && (
                <CheckpointViewer
                    chatId={chat.id}
                    projectPath={project.folderPath}
                    onClose={() => setShowCheckpoints(false)}
                    onRestore={async () => {
                        const freshChat = await window.api.chats.get(chat.id)
                        if (freshChat) onChatUpdate(freshChat)
                        setShowCheckpoints(false)
                    }}
                />
            )}

            {pendingPlan !== null && (
                <aside className="plan-review-sidepanel">
                    <div className="plan-review-window">
                        <h3>Review Super Agent Plan</h3>
                        <p>Inspect the structured checklist, then proceed or request changes.</p>
                        {planPreview ? (
                            <SuperAgentPanel plan={planPreview} onCancel={handleCancelPlan} showCancelButton={false} />
                        ) : (
                            <textarea
                                className="plan-review-input"
                                value={planDraft}
                                onChange={e => setPlanDraft(e.target.value)}
                                rows={14}
                            />
                        )}
                        <details className="plan-review-raw">
                            <summary>Edit raw plan markdown</summary>
                            <textarea
                                className="plan-review-input"
                                value={planDraft}
                                onChange={e => setPlanDraft(e.target.value)}
                                rows={10}
                            />
                        </details>
                        <textarea
                            className="plan-review-input"
                            value={planChangeRequest}
                            onChange={e => setPlanChangeRequest(e.target.value)}
                            rows={4}
                            placeholder="Optional: Ask the agent to revise the plan before proceeding..."
                        />
                        <div className="plan-review-actions">
                            <button className="btn btn-ghost" onClick={handleCancelPlan}>Cancel</button>
                            <button className="btn btn-ghost" onClick={handleRequestPlanChanges}>Ask for Changes</button>
                            <button className="btn btn-primary" onClick={handleProceedWithPlan}>Proceed</button>
                        </div>
                    </div>
                </aside>
            )}
        </div>
    )
}
