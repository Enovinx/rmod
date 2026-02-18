import { useState, useEffect, CSSProperties, useRef, useMemo } from 'react'
import type { Project, Chat } from '../types'
import './ProjectCard.css'
import { seedFromString, generatePixelPattern } from '../utils/pixelArt'

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

    // Background and Parallax Logic
    const cardRef = useRef<HTMLDivElement>(null)
    const [bgImage, setBgImage] = useState<string>('')
    const [parallaxStyle, setParallaxStyle] = useState<CSSProperties>({})

    // Generate the pixel pattern based on project name and theme
    useEffect(() => {
        const seed = seedFromString(project.name)

        // We need to wait for styles to be applied or just read them directly
        // Reading from computed styles to get current theme colors
        const getColors = () => {
            const style = getComputedStyle(document.documentElement)
            const themeColors = [
                style.getPropertyValue('--bg-tertiary').trim(),
                style.getPropertyValue('--accent-primary').trim(),
                style.getPropertyValue('--accent-secondary').trim(),
                style.getPropertyValue('--text-muted').trim(),
                style.getPropertyValue('--text-accent').trim()
            ].filter(Boolean)

            // Fallback palette if we don't find enough colors
            if (themeColors.length < 2) {
                return ['#1e293b', '#3b82f6', '#60a5fa', '#94a3b8']
            }
            return themeColors
        }

        const colors = getColors()

        try {
            // Create a small pixel art (16x16 is enough for pixelated look)
            const dataUrl = generatePixelPattern(seed, colors, 16, 16)
            setBgImage(dataUrl)
        } catch (e) {
            console.error("Failed to generate pattern", e)
        }
    }, [project.name]) // Re-generate if project name changes (unlikely) or theme changes (we might want to listen to theme changes)

    // Listen for theme changes to regenerate format
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
                    // Regenerate
                    const seed = seedFromString(project.name)
                    const style = getComputedStyle(document.documentElement)
                    const colors = [
                        style.getPropertyValue('--bg-tertiary').trim(),
                        style.getPropertyValue('--accent-primary').trim(),
                        style.getPropertyValue('--accent-secondary').trim(),
                        style.getPropertyValue('--text-muted').trim(),
                        style.getPropertyValue('--text-accent').trim()
                    ].filter(Boolean)

                    const finalColors = colors.length < 2 ? ['#1e293b', '#3b82f6', '#60a5fa', '#94a3b8'] : colors

                    if (finalColors.length) {
                        setBgImage(generatePixelPattern(seed, finalColors, 16, 16))
                    }
                }
            })
        })

        observer.observe(document.documentElement, { attributes: true })
        return () => observer.disconnect()
    }, [project.name])

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current) return

        const rect = cardRef.current.getBoundingClientRect()
        const x = e.clientX - rect.left // x position within the element.
        const y = e.clientY - rect.top  // y position within the element.

        // Calculate percentage from center
        const xPct = (x / rect.width) - 0.5
        const yPct = (y / rect.height) - 0.5

        // Parallax movement amount (in pixels)
        const moveX = xPct * 20
        const moveY = yPct * 20

        setParallaxStyle({
            transform: `translate(${moveX}px, ${moveY}px) scale(1.2)`, // Scale up to prevent edges from showing
        })
    }

    const handleMouseLeave = () => {
        setParallaxStyle({
            transform: 'translate(0, 0) scale(1.2)',
            transition: 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)'
        })
    }

    return (
        <div
            className="project-card animate-slide-up"
            style={style}
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div
                className="project-card-bg"
                style={{
                    backgroundImage: `url(${bgImage})`,
                    ...parallaxStyle
                }}
            />
            <div className="project-card-content">
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
        </div>

    )
}
