import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Project, Chat, Settings } from '../types'
import ChatSidebar from '../components/ChatSidebar'
import ChatInterface from '../components/ChatInterface'
import FileExplorer from '../components/FileExplorer'
import SettingsPanel from '../components/SettingsPanel'
import ActionDialog from '../components/ActionDialog'
import { applyTheme } from '../theme'
import './ProjectWorkspace.css'

export default function ProjectWorkspace() {
    const { projectId, chatId } = useParams<{ projectId: string; chatId?: string }>()
    const navigate = useNavigate()

    const [project, setProject] = useState<Project | null>(null)
    const [chats, setChats] = useState<Chat[]>([])
    const [currentChat, setCurrentChat] = useState<Chat | null>(null)
    const [settings, setSettings] = useState<Settings | null>(null)
    const [loading, setLoading] = useState(true)

    const [showFileExplorer, setShowFileExplorer] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [chatPendingDelete, setChatPendingDelete] = useState<string | null>(null)

    useEffect(() => {
        if (projectId) {
            loadProject()
            loadSettings()
        }
    }, [projectId])

    useEffect(() => {
        if (chatId) {
            loadChat(chatId)
        } else {
            setCurrentChat(null)
        }
    }, [chatId])

    const loadProject = async () => {
        try {
            const projects = await window.api.projects.list()
            const p = projects.find(proj => proj.id === projectId)
            if (p) {
                setProject(p)
                const chatList = await window.api.chats.list(p.id)
                setChats(chatList.sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                ))
            }
        } catch (error) {
            console.error('Failed to load project:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadSettings = async () => {
        const s = await window.api.settings.get()
        const normalizedTheme = applyTheme(s.theme)

        if (normalizedTheme !== s.theme) {
            const migrated = await window.api.settings.set({ theme: normalizedTheme })
            setSettings(migrated)
            return
        }

        setSettings(s)
    }

    const loadChat = async (id: string) => {
        try {
            const chat = await window.api.chats.get(id)
            setCurrentChat(chat)
        } catch (error) {
            console.error('Failed to load chat:', error)
        }
    }

    const handleNewChat = async () => {
        if (!project) return
        try {
            const chat = await window.api.chats.create(project.id, 'New Chat')
            setChats(prev => [chat, ...prev])
            navigate(`/project/${project.id}/chat/${chat.id}`)
        } catch (error) {
            console.error('Failed to create chat:', error)
        }
    }

    const handleSelectChat = (chat: Chat) => {
        navigate(`/project/${project?.id}/chat/${chat.id}`)
    }

    const handleDeleteChat = async (chatId: string) => {
        setChatPendingDelete(chatId)
    }

    const confirmDeleteChat = async () => {
        if (!chatPendingDelete) return
        const chatId = chatPendingDelete
        await window.api.chats.delete(chatId)
        setChats(prev => prev.filter(c => c.id !== chatId))
        if (currentChat?.id === chatId) {
            navigate(`/project/${project?.id}`)
        }
        setChatPendingDelete(null)
    }

    const handleChatUpdate = (updatedChat: Chat) => {
        setCurrentChat(updatedChat)
        setChats(prev => prev.map(c => c.id === updatedChat.id ? updatedChat : c))
    }

    const handleSettingsChange = async (updates: Partial<Settings>) => {
        const updated = await window.api.settings.set(updates)
        applyTheme(updated.theme)
        setSettings(updated)
    }

    const [fileExplorerWidth, setFileExplorerWidth] = useState(350)
    const [isResizing, setIsResizing] = useState(false)

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isResizing) return
            const newWidth = window.innerWidth - e.clientX
            // Clamp width between 200px and 800px
            if (newWidth > 200 && newWidth < 800) {
                setFileExplorerWidth(newWidth)
            }
        }

        const handleMouseUp = () => {
            setIsResizing(false)
        }

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove)
            document.addEventListener('mouseup', handleMouseUp)
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isResizing])

    if (loading) {
        return (
            <div className="workspace-loading">
                <div className="spinner spinner-lg" />
            </div>
        )
    }

    if (!project) {
        return (
            <div className="workspace-error">
                <p>Project not found</p>
                <button className="btn" onClick={() => navigate('/')}>Go Home</button>
            </div>
        )
    }

    return (
        <div className="workspace-container">
            {/* Sidebar */}
            <ChatSidebar
                project={project}
                chats={chats}
                currentChatId={currentChat?.id}
                onNewChat={handleNewChat}
                onSelectChat={handleSelectChat}
                onDeleteChat={handleDeleteChat}
                onOpenSettings={() => setShowSettings(true)}
                onGoHome={() => navigate('/')}
            />

            {/* Main content */}
            <main className="workspace-main">
                {currentChat ? (
                    <ChatInterface
                        chat={currentChat}
                        project={project}
                        settings={settings!}
                        onChatUpdate={handleChatUpdate}
                        onToggleFiles={() => setShowFileExplorer(!showFileExplorer)}
                        showFileExplorer={showFileExplorer}
                    />
                ) : (
                    <div className="workspace-empty">
                        <div className="empty-content">
                            <div className="empty-icon">
                                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                                    <rect x="8" y="8" width="48" height="48" rx="8" stroke="currentColor" strokeWidth="2" />
                                    <path d="M20 28L28 36L44 20" stroke="url(#checkGradient)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                                    <defs>
                                        <linearGradient id="checkGradient" x1="20" y1="20" x2="44" y2="36">
                                            <stop stopColor="#8b5cf6" />
                                            <stop offset="1" stopColor="#06b6d4" />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <h2>Ready to code with AI</h2>
                            <p className="text-secondary">Start a new chat to begin coding on <strong>{project.name}</strong></p>
                            <button className="btn btn-primary btn-lg" onClick={handleNewChat}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                Start New Chat
                            </button>
                        </div>

                        <div className="quick-actions">
                            <button className="quick-action" onClick={() => setShowFileExplorer(true)}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path d="M2 5V15C2 15.5523 2.44772 16 3 16H17C17.5523 16 18 15.5523 18 15V7C18 6.44772 17.5523 6 17 6H10L8 4H3C2.44772 4 2 4.44772 2 5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                                </svg>
                                <span>Browse Files</span>
                            </button>
                            <button className="quick-action" onClick={() => setShowSettings(true)}>
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path d="M10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13Z" stroke="currentColor" strokeWidth="1.5" />
                                    <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.657 4.343L14.243 5.757M5.757 14.243L4.343 15.657M15.657 15.657L14.243 14.243M5.757 5.757L4.343 4.343" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                <span>Settings</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* File explorer panel */}
            {showFileExplorer && (
                <>
                    <div
                        className={`resize-handle ${isResizing ? 'active' : ''}`}
                        onMouseDown={() => setIsResizing(true)}
                    />
                    <aside className="workspace-files" style={{ width: fileExplorerWidth }}>
                        <FileExplorer
                            projectPath={project.folderPath}
                            onClose={() => setShowFileExplorer(false)}
                        />
                    </aside>
                </>
            )}

            {/* Settings modal */}
            {showSettings && settings && (
                <SettingsPanel
                    settings={settings}
                    onChange={handleSettingsChange}
                    onClose={() => setShowSettings(false)}
                />
            )}

            {chatPendingDelete && (
                <ActionDialog
                    title="Delete chat?"
                    message="This chat and all of its messages will be removed."
                    confirmLabel="Delete"
                    danger
                    onCancel={() => setChatPendingDelete(null)}
                    onConfirm={confirmDeleteChat}
                />
            )}
        </div>
    )
}
