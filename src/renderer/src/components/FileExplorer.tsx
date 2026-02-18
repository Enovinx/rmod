import { useState, useEffect } from 'react'
import type { FileEntry } from '../types'
import './FileExplorer.css'

interface FileExplorerProps {
    projectPath: string
    projectId: string
    syncMode: 'filesystem' | 'plugin'
    onClose: () => void
}

export default function FileExplorer({ projectPath, projectId, syncMode, onClose }: FileExplorerProps) {
    const [files, setFiles] = useState<FileEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedFile, setSelectedFile] = useState<string | null>(null)
    const [fileContent, setFileContent] = useState<string | null>(null)
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['.']))

    useEffect(() => {
        loadFiles()
    }, [projectPath, projectId, syncMode])

    // Listen for plugin file updates
    useEffect(() => {
        if (syncMode === 'plugin') {
            const removeListener = window.api.plugin.onFilesUpdated((pid) => {
                if (pid === projectId) {
                    loadFiles()
                }
            })
            return removeListener
        }
    }, [syncMode, projectId])

    const loadFiles = async () => {
        try {
            let filesList: any[] = []

            if (syncMode === 'plugin') {
                filesList = await window.api.plugin.getFiles(projectId)
            } else {
                const result = await window.api.files.list(projectPath, true)
                if (result.success && result.files) {
                    filesList = result.files
                }
            }

            // Build tree structure
            const tree = buildTree(filesList)
            setFiles(tree)
        } catch (error) {
            console.error('Failed to load files:', error)
        } finally {
            setLoading(false)
        }
    }

    const buildTree = (flatFiles: { path: string; name: string; isDirectory: boolean; size: number }[]): FileEntry[] => {
        const root: FileEntry[] = []
        const pathMap = new Map<string, FileEntry>()

        // Sort so directories come first, then by name
        const sorted = [...flatFiles].sort((a, b) => {
            if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
            return a.name.localeCompare(b.name)
        })

        for (const file of sorted) {
            const entry: FileEntry = {
                path: file.path,
                name: file.name,
                isDirectory: file.isDirectory,
                size: file.size,
                children: file.isDirectory ? [] : undefined
            }
            pathMap.set(file.path, entry)

            const parts = file.path.split('/')
            if (parts.length === 1) {
                root.push(entry)
            } else {
                const parentPath = parts.slice(0, -1).join('/')
                const parent = pathMap.get(parentPath)
                if (parent && parent.children) {
                    parent.children.push(entry)
                }
            }
        }

        return root
    }

    const toggleFolder = (path: string) => {
        const newExpanded = new Set(expandedFolders)
        if (newExpanded.has(path)) {
            newExpanded.delete(path)
        } else {
            newExpanded.add(path)
        }
        setExpandedFolders(newExpanded)
    }

    const handleFileClick = async (file: FileEntry) => {
        // Toggle folder
        if (file.isDirectory) {
            const newExpanded = new Set(expandedFolders)
            if (newExpanded.has(file.path)) {
                newExpanded.delete(file.path)
            } else {
                newExpanded.add(file.path)
            }
            setExpandedFolders(newExpanded)
            return
        }

        // Select file
        setSelectedFile(file.path)

        // Read file content
        try {
            let content = ''

            if (syncMode === 'plugin') {
                const result = await window.api.plugin.readFile(projectId, file.path)
                if (result.success) content = result.content || ''
            } else {
                const result = await window.api.files.read(`${projectPath}/${file.path}`)
                if (result.success) content = result.content || ''
            }

            setFileContent(content)
        } catch (error) {
            console.error('Failed to read file:', error)
            setFileContent('Error reading file')
        }
    }

    const getFileIcon = (name: string, isDirectory: boolean) => {
        if (isDirectory) return '📁'
        const ext = name.split('.').pop()?.toLowerCase()
        switch (ext) {
            case 'lua':
            case 'luau':
                return '🔷'
            case 'json':
                return '📋'
            case 'toml':
            case 'yaml':
                return '⚙️'
            case 'md':
            case 'txt':
                return '📝'
            default:
                return '📄'
        }
    }

    const renderTree = (entries: FileEntry[], depth = 0) => {
        return entries.map(entry => (
            <div key={entry.path}>
                <div
                    className={`file-item ${selectedFile === entry.path ? 'selected' : ''}`}
                    style={{ paddingLeft: `${depth * 16 + 8}px` }}
                    onClick={() => handleFileClick(entry)}
                >
                    {entry.isDirectory && (
                        <span className={`folder-arrow ${expandedFolders.has(entry.path) ? 'expanded' : ''}`}>
                            ▶
                        </span>
                    )}
                    <span className="file-icon">{getFileIcon(entry.name, entry.isDirectory)}</span>
                    <span className="file-name truncate">{entry.name}</span>
                </div>
                {entry.isDirectory && entry.children && expandedFolders.has(entry.path) && (
                    renderTree(entry.children, depth + 1)
                )}
            </div>
        ))
    }

    return (
        <div className="file-explorer">
            <div className="file-explorer-header">
                <h3>Files</h3>
                <button className="btn btn-ghost btn-icon" onClick={onClose}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 3L11 11M11 3L3 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                </button>
            </div>

            {loading ? (
                <div className="file-explorer-loading">
                    <div className="spinner" />
                </div>
            ) : (
                <div className="file-tree">
                    {files.length === 0 ? (
                        <div className="file-empty">
                            <p className="text-muted">No files found</p>
                        </div>
                    ) : (
                        renderTree(files)
                    )}
                </div>
            )}

            {selectedFile && fileContent !== null && (
                <div className="file-preview">
                    <div className="file-preview-header">
                        <span className="truncate">{selectedFile}</span>
                        <button className="btn btn-ghost btn-icon" onClick={() => { setSelectedFile(null); setFileContent(null); }}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                    </div>
                    <pre className="file-preview-content">
                        <code>{fileContent}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}
