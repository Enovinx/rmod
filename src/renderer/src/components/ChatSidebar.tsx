import type { Project, Chat } from '../types'
import './ChatSidebar.css'

interface ChatSidebarProps {
    project: Project
    chats: Chat[]
    currentChatId?: string
    onNewChat: () => void
    onSelectChat: (chat: Chat) => void
    onDeleteChat: (chatId: string) => void
    onOpenSettings: () => void
    onGoHome: () => void
}

export default function ChatSidebar({
    project,
    chats,
    currentChatId,
    onNewChat,
    onSelectChat,
    onDeleteChat,
    onOpenSettings,
    onGoHome
}: ChatSidebarProps) {
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (days === 0) return 'Today'
        if (days === 1) return 'Yesterday'
        if (days < 7) return `${days}d ago`
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }

    const getChatTitle = (chat: Chat) => {
        if (chat.messages.length === 0) return 'New Chat'
        const firstUserMsg = chat.messages.find(m => m.role === 'user')
        if (firstUserMsg) {
            return firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
        }
        return chat.title
    }

    return (
        <aside className="chat-sidebar">
            <div className="sidebar-header">
                <button className="btn btn-ghost btn-icon" onClick={onGoHome} title="Back to projects">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M11 14L6 9L11 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
                <div className="sidebar-project">
                    <span className="project-name truncate">{project.name}</span>
                </div>
                <button className="btn btn-ghost btn-icon" onClick={onOpenSettings} title="Settings">
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M9 11.5C10.3807 11.5 11.5 10.3807 11.5 9C11.5 7.61929 10.3807 6.5 9 6.5C7.61929 6.5 6.5 7.61929 6.5 9C6.5 10.3807 7.61929 11.5 9 11.5Z" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M9 2V3.5M9 14.5V16M16 9H14.5M3.5 9H2M14.066 3.934L13.005 4.995M4.995 13.005L3.934 14.066M14.066 14.066L13.005 13.005M4.995 4.995L3.934 3.934" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            <div className="sidebar-new-chat">
                <button className="btn btn-primary new-chat-btn" onClick={onNewChat}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M7 2V12M2 7H12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                    New Chat
                </button>
            </div>

            <div className="sidebar-chats">
                {chats.length === 0 ? (
                    <div className="sidebar-empty">
                        <p className="text-muted text-sm">No chats yet</p>
                    </div>
                ) : (
                    <div className="chat-list">
                        {chats.map(chat => (
                            <div
                                key={chat.id}
                                className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
                                onClick={() => onSelectChat(chat)}
                            >
                                <div className="chat-item-content">
                                    <span className="chat-title truncate">{getChatTitle(chat)}</span>
                                    <span className="chat-date text-muted">{formatDate(chat.createdAt)}</span>
                                </div>
                                <button
                                    className="chat-delete btn btn-ghost btn-icon"
                                    onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }}
                                    title="Delete chat"
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    </svg>
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </aside>
    )
}
