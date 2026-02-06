import { useState, useRef, useEffect } from 'react'
import type { Chat, Project, Settings, Message } from '../types'
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!input.trim() || isRunning) return

        const userMessage = input.trim()
        setInput('')
        setIsRunning(true)
        setCurrentAction('Starting...')

        try {
            // Add user message
            const userMsg = await window.api.chats.addMessage(chat.id, {
                role: 'user',
                content: userMessage
            })

            if (userMsg) {
                const updatedChat = { ...chat, messages: [...chat.messages, userMsg] }
                onChatUpdate(updatedChat)
            }

            // Create checkpoint before agent runs
            await window.api.checkpoints.create(chat.id, chat.messages.length, project.folderPath)

            // Run the agent
            await runAgent({
                chatId: chat.id,
                userMessage,
                projectPath: project.folderPath,
                settings,
                superAgentMode,
                onStatusUpdate: setCurrentAction,
                onMessageAdded: async (msg) => {
                    const freshChat = await window.api.chats.get(chat.id)
                    if (freshChat) onChatUpdate(freshChat)
                }
            })

            // Refresh chat
            const finalChat = await window.api.chats.get(chat.id)
            if (finalChat) onChatUpdate(finalChat)

        } catch (error) {
            console.error('Agent error:', error)
            await window.api.chats.addMessage(chat.id, {
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`
            })
            const errorChat = await window.api.chats.get(chat.id)
            if (errorChat) onChatUpdate(errorChat)
        } finally {
            setIsRunning(false)
            setCurrentAction('')
        }
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSubmit(e)
        }
    }

    const handleSuggestionClick = (text: string) => {
        setInput(text)
        requestAnimationFrame(() => textareaRef.current?.focus())
    }

    return (
        <div className="chat-interface">
            {/* Header */}
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
                    <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => setShowCheckpoints(true)}
                        title="View checkpoints"
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 7C2 4.23858 4.23858 2 7 2C9.76142 2 12 4.23858 12 7C12 9.76142 9.76142 12 7 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        History
                    </button>
                    <button
                        className={`btn btn-sm ${showFileExplorer ? 'btn-primary' : 'btn-ghost'}`}
                        onClick={onToggleFiles}
                    >
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <path d="M2 4V11C2 11.5523 2.44772 12 3 12H11C11.5523 12 12 11.5523 12 11V5C12 4.44772 11.5523 4 11 4H7L5.5 2.5H3C2.44772 2.5 2 2.94772 2 3.5V4Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                        Files
                    </button>
                </div>
            </header>

            {/* Super Agent Warning */}
            {superAgentMode && (
                <div className="super-agent-banner">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1L15 14H1L8 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                        <path d="M8 6V9M8 11V11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span>Super Agent Mode - Creates plans and executes multi-step tasks. Uses more tokens.</span>
                </div>
            )}

            {/* Messages */}
            <div className="chat-messages">
                {chat.messages.length === 0 ? (
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
                            <button onClick={() => handleSuggestionClick('Show me the structure of this project')}>
                                📁 Show project structure
                            </button>
                            <button onClick={() => handleSuggestionClick('Create a new ModuleScript for handling player data')}>
                                ✨ Create a new script
                            </button>
                            <button onClick={() => handleSuggestionClick('Find all uses of RemoteEvent in the codebase')}>
                                🔍 Search the codebase
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {chat.messages.map((message, index) => (
                            <MessageBubble key={message.id || index} message={message} />
                        ))}
                    </>
                )}

                {isRunning && (
                    <div className="agent-status">
                        <div className="spinner spinner-sm" />
                        <span>{currentAction}</span>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form className="chat-input-form" onSubmit={handleSubmit}>
                <div className="chat-input-container">
                    <textarea
                        ref={textareaRef}
                        className="chat-input"
                        placeholder="Describe what you want to build..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                    />
                    <button
                        type="submit"
                        className="btn btn-primary send-btn"
                        disabled={!input.trim() || isRunning}
                    >
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

            {/* Checkpoints modal */}
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
        </div>
    )
}
