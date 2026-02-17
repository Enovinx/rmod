import { useState, useEffect, CSSProperties } from 'react'
import type { Project, Chat } from '../types'
import './ProjectCard.css'

interface ProjectCardProps {
    project: Project
    onOpen: () => void
    onDelete: () => void
    style?: CSSProperties
}

export default function ProjectCard({ project, onOpen, onDelete, style }: ProjectCardProps) {
    const [recentChats, setRecentChats] = useState<Chat[]>([])
    const [showMenu, setShowMenu] = useState(false)

    useEffect(() => {
        loadRecentChats()
    }, [project.id])

    const loadRecentChats = async () => {
        try {
            const chats = await window.api.chats.list(project.id)
            setRecentChats(chats.slice(0, 3))
        } catch (error) {
            console.error('Failed to load chats:', error)
        }
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (days === 0) return 'Today'
        if (days === 1) return 'Yesterday'
        if (days < 7) return `${days} days ago`
        return date.toLocaleDateString()
    }

    const getFolderName = (path: string) => {
        return path.split(/[/\\]/).pop() || path
    }

    const getChatPreviewTitle = (chat: Chat) => {
        const firstUserMessage = chat.messages.find((message) => message.role === 'user' && message.content.trim().length > 0)
        if (firstUserMessage) {
            const preview = firstUserMessage.content.trim()
            return preview.slice(0, 50) + (preview.length > 50 ? '...' : '')
        }

        return chat.title
    }

    return (
        <div className="project-card animate-slide-up" style={style}>
            <div className="project-card-header">
                <div className="project-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                        <path
                            d="M3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9C21 7.89543 20.1046 7 19 7H12L10 5H5C3.89543 5 3 5.89543 3 7Z"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>
                <div className="project-info">
                    <h3 className="project-name">{project.name}</h3>
                    <p className="project-path truncate">{getFolderName(project.folderPath)}</p>
                </div>
                <div className="project-menu-wrapper">
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={(e) => {
                            e.stopPropagation()
                            setShowMenu(!showMenu)
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="3" r="1.5" fill="currentColor" />
                            <circle cx="8" cy="8" r="1.5" fill="currentColor" />
                            <circle cx="8" cy="13" r="1.5" fill="currentColor" />
                        </svg>
                    </button>
                    {showMenu && (
                        <div className="project-menu">
                            <button onClick={(e) => { e.stopPropagation(); onDelete(); setShowMenu(false); }}>
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M2 4H12M5 4V3C5 2.44772 5.44772 2 6 2H8C8.55228 2 9 2.44772 9 3V4M11 4V11C11 11.5523 10.5523 12 10 12H4C3.44772 12 3 11.5523 3 11V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                Delete Project
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="project-card-body" onClick={onOpen}>
                {recentChats.length > 0 ? (
                    <div className="recent-chats">
                        <span className="recent-label">Recent chats</span>
                        {recentChats.map(chat => (
                            <div key={chat.id} className="recent-chat-item">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M1 3C1 1.89543 1.89543 1 3 1H9C10.1046 1 11 1.89543 11 3V7C11 8.10457 10.1046 9 9 9H5L2.5 11V9H3C1.89543 9 1 8.10457 1 7V3Z" stroke="currentColor" strokeWidth="1.2" />
                                </svg>
                                <span className="truncate">{getChatPreviewTitle(chat)}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="no-chats">
                        <span className="text-muted">No chats yet</span>
                    </div>
                )}
            </div>

            <div className="project-card-footer">
                <span className="text-muted text-sm">Opened {formatDate(project.lastOpenedAt)}</span>
                <button className="btn btn-sm" onClick={onOpen}>
                    Open
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6H10M7 3L10 6L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            </div>
        </div>
    )
}
