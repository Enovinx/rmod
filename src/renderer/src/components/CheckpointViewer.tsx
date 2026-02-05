import { useState, useEffect } from 'react'
import type { Checkpoint } from '../types'
import './CheckpointViewer.css'

interface CheckpointViewerProps {
    chatId: string
    projectPath: string
    onClose: () => void
    onRestore: () => void
}

export default function CheckpointViewer({ chatId, projectPath, onClose, onRestore }: CheckpointViewerProps) {
    const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([])
    const [loading, setLoading] = useState(true)
    const [restoring, setRestoring] = useState<string | null>(null)

    useEffect(() => {
        loadCheckpoints()
    }, [chatId])

    const loadCheckpoints = async () => {
        try {
            const cps = await window.api.checkpoints.list(chatId)
            setCheckpoints(cps.sort((a, b) =>
                new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            ))
        } catch (error) {
            console.error('Failed to load checkpoints:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleRestore = async (checkpoint: Checkpoint) => {
        if (!confirm('Restore this checkpoint? Current file changes will be overwritten.')) return

        setRestoring(checkpoint.id)
        try {
            const result = await window.api.checkpoints.restore(checkpoint.id, projectPath)
            if (result.success) {
                onRestore()
            } else {
                alert(`Failed to restore: ${result.error}`)
            }
        } catch (error) {
            console.error('Failed to restore:', error)
        } finally {
            setRestoring(null)
        }
    }

    const handleDelete = async (checkpointId: string) => {
        if (!confirm('Delete this checkpoint?')) return
        await window.api.checkpoints.delete(checkpointId)
        setCheckpoints(prev => prev.filter(cp => cp.id !== checkpointId))
    }

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr)
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        })
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal checkpoint-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Checkpoints</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <div className="checkpoint-content">
                    {loading ? (
                        <div className="checkpoint-loading">
                            <div className="spinner" />
                        </div>
                    ) : checkpoints.length === 0 ? (
                        <div className="checkpoint-empty">
                            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                                <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2" />
                                <path d="M24 14V24L30 30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            <p>No checkpoints yet</p>
                            <span className="text-muted">Checkpoints are created automatically before agent actions</span>
                        </div>
                    ) : (
                        <div className="checkpoint-list">
                            {checkpoints.map(checkpoint => (
                                <div key={checkpoint.id} className="checkpoint-item">
                                    <div className="checkpoint-info">
                                        <div className="checkpoint-time">
                                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                                <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                                                <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                            </svg>
                                            {formatDate(checkpoint.createdAt)}
                                        </div>
                                        <div className="checkpoint-files text-muted">
                                            {checkpoint.files.length} files saved
                                        </div>
                                    </div>
                                    <div className="checkpoint-actions">
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={() => handleRestore(checkpoint)}
                                            disabled={restoring !== null}
                                        >
                                            {restoring === checkpoint.id ? (
                                                <span className="spinner spinner-sm" />
                                            ) : (
                                                'Restore'
                                            )}
                                        </button>
                                        <button
                                            className="btn btn-sm btn-ghost"
                                            onClick={() => handleDelete(checkpoint.id)}
                                            disabled={restoring !== null}
                                        >
                                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                <path d="M2 4H10M4 4V3C4 2.44772 4.44772 2 5 2H7C7.55228 2 8 2.44772 8 3V4M9 4V9C9 9.55228 8.55228 10 8 10H4C3.44772 10 3 9.55228 3 9V4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="checkpoint-footer">
                    <span className="text-muted text-sm">
                        Checkpoints let you revert to previous file states
                    </span>
                </div>
            </div>
        </div>
    )
}
