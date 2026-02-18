import { useState } from 'react'
import './CreateProjectModal.css'

interface CreateProjectModalProps {
    onClose: () => void
    onCreate: (name: string, folderPath: string, syncMode: 'filesystem' | 'plugin', pluginPort?: number) => void
}

export default function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
    const [name, setName] = useState('')
    const [folderPath, setFolderPath] = useState('')
    const [syncMode, setSyncMode] = useState<'filesystem' | 'plugin'>('filesystem')
    const [pluginPort, setPluginPort] = useState(3000)
    const [error, setError] = useState('')

    const handleSelectFolder = async () => {
        const result = await window.api.dialogs.selectFolder()
        if (result.success && result.path) {
            setFolderPath(result.path)
            // Auto-fill name from folder if empty
            if (!name) {
                const folderName = result.path.split(/[/\\]/).pop()
                if (folderName) setName(folderName)
            }
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        if (!name.trim()) {
            setError('Please enter a project name')
            return
        }

        if (syncMode === 'filesystem' && !folderPath) {
            setError('Please select a project folder')
            return
        }

        if (syncMode === 'plugin' && (pluginPort < 1024 || pluginPort > 65535)) {
            setError('Port must be between 1024 and 65535')
            return
        }

        onCreate(
            name.trim(),
            syncMode === 'filesystem' ? folderPath : `plugin:${pluginPort}`,
            syncMode,
            syncMode === 'plugin' ? pluginPort : undefined
        )
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal create-project-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create New Project</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="projectName">Project Name</label>
                        <input
                            id="projectName"
                            type="text"
                            className="input"
                            placeholder="My Awesome Game"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                        />
                    </div>

                    {/* Sync Mode Toggle */}
                    <div className="form-group">
                        <label>Sync Mode</label>
                        <div className="sync-mode-toggle">
                            <button
                                type="button"
                                className={`sync-mode-btn ${syncMode === 'filesystem' ? 'active' : ''}`}
                                onClick={() => setSyncMode('filesystem')}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M2 4V12C2 12.5523 2.44772 13 3 13H13C13.5523 13 14 12.5523 14 12V6C14 5.44772 13.5523 5 13 5H8L6.5 3H3C2.44772 3 2 3.44772 2 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                                </svg>
                                Filesystem
                            </button>
                            <button
                                type="button"
                                className={`sync-mode-btn ${syncMode === 'plugin' ? 'active' : ''}`}
                                onClick={() => setSyncMode('plugin')}
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M5 1V4M11 1V4M5 12V15M11 12V15M1 5H4M1 11H4M12 5H15M12 11H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                    <rect x="4" y="4" width="8" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
                                </svg>
                                Plugin
                            </button>
                        </div>
                        <p className="form-hint sync-mode-hint">
                            {syncMode === 'filesystem'
                                ? 'Sync with a local folder on your computer'
                                : 'Sync directly with Roblox Studio via the RMod plugin'
                            }
                        </p>
                    </div>

                    {/* Filesystem mode: folder picker */}
                    {syncMode === 'filesystem' && (
                        <div className="form-group">
                            <label>Project Folder</label>
                            <p className="form-hint" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                Select the folder containing your Roblox code files (where Studio syncs to)
                            </p>
                            <div className="folder-select">
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Select a folder..."
                                    value={folderPath}
                                    readOnly
                                />
                                <button type="button" className="btn" onClick={handleSelectFolder}>
                                    Browse
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Plugin mode: port picker */}
                    {syncMode === 'plugin' && (
                        <div className="form-group">
                            <label htmlFor="pluginPort">Plugin Port</label>
                            <p className="form-hint" style={{ marginBottom: 'var(--spacing-sm)' }}>
                                Set the same port in both RMod and the Roblox Studio plugin
                            </p>
                            <input
                                id="pluginPort"
                                type="number"
                                className="input port-input"
                                min={1024}
                                max={65535}
                                value={pluginPort}
                                onChange={e => setPluginPort(parseInt(e.target.value) || 3000)}
                            />
                            <p className="form-hint plugin-services-hint">
                                Supports: ReplicatedStorage, StarterPlayerScripts, ServerScriptService
                            </p>
                        </div>
                    )}

                    {error && <div className="error-message">{error}</div>}

                    <div className="modal-actions">
                        <button type="button" className="btn" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            Create Project
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
