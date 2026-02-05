import { useState } from 'react'
import './CreateProjectModal.css'

interface CreateProjectModalProps {
    onClose: () => void
    onCreate: (name: string, folderPath: string) => void
}

export default function CreateProjectModal({ onClose, onCreate }: CreateProjectModalProps) {
    const [name, setName] = useState('')
    const [folderPath, setFolderPath] = useState('')
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

        if (!folderPath) {
            setError('Please select a project folder')
            return
        }

        onCreate(name.trim(), folderPath)
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
