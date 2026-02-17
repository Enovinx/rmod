import { ipcMain, dialog, app } from 'electron'
import { readFile, writeFile, unlink, readdir, stat, mkdir } from 'fs/promises'
import { join, relative, basename } from 'path'
import { existsSync } from 'fs'
import Store from 'electron-store'

interface Project {
    id: string
    name: string
    folderPath: string
    createdAt: string
    lastOpenedAt: string
}

interface Chat {
    id: string
    projectId: string
    title: string
    messages: Message[]
    createdAt: string
}

interface Message {
    id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    reasoning?: string
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
    timestamp: string
}

interface ToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
}

interface ToolResult {
    toolCallId: string
    result: unknown
}

interface Checkpoint {
    id: string
    chatId: string
    messageIndex: number
    files: { path: string; content: string }[]
    createdAt: string
}

interface ModelPreset {
    id: string
    name: string
    modelId: string
    temperature: number
    maxTokens: number
}

interface Settings {
    openRouterKey: string
    activeModelPreset: string
    modelPresets: ModelPreset[]
    theme:
        | 'graphite'
        | 'midnight'
        | 'nord'
        | 'sunset'
        | 'forest'
        | 'ocean'
        | 'rose'
        | 'amber'
        | 'violet'
        | 'terminal'
    hasCompletedSetup: boolean
}

let store: Store<{
    projects: Project[]
    chats: Chat[]
    checkpoints: Checkpoint[]
    settings: Settings
}>

export function registerIpcHandlers(): void {
    store = new Store<{
        projects: Project[]
        chats: Chat[]
        checkpoints: Checkpoint[]
        settings: Settings
    }>({
        defaults: {
            projects: [],
            chats: [],
            checkpoints: [],
            settings: {
                openRouterKey: '',
                activeModelPreset: 'default',
                modelPresets: [
                    {
                        id: 'default',
                        name: 'Default (Claude 3.5 Sonnet)',
                        modelId: 'anthropic/claude-3.5-sonnet',
                        temperature: 0.7,
                        maxTokens: 4096
                    },
                    {
                        id: 'fast',
                        name: 'Fast (Claude 3 Haiku)',
                        modelId: 'anthropic/claude-3-haiku',
                        temperature: 0.7,
                        maxTokens: 4096
                    },
                    {
                        id: 'powerful',
                        name: 'Powerful (Claude 3 Opus)',
                        modelId: 'anthropic/claude-3-opus',
                        temperature: 0.7,
                        maxTokens: 4096
                    }
                ],
                theme: 'graphite',
                hasCompletedSetup: false
            }
        }
    })

    console.log('Store initialized at:', store.path)
    // File operations
    ipcMain.handle('file:read', async (_, filePath: string) => {
        try {
            const content = await readFile(filePath, 'utf-8')
            return { success: true, content }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle('file:write', async (_, filePath: string, content: string) => {
        try {
            const dir = join(filePath, '..')
            if (!existsSync(dir)) {
                await mkdir(dir, { recursive: true })
            }
            await writeFile(filePath, content, 'utf-8')
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle('file:delete', async (_, filePath: string) => {
        try {
            await unlink(filePath)
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle('file:exists', async (_, filePath: string) => {
        return existsSync(filePath)
    })

    ipcMain.handle('file:list', async (_, dirPath: string, recursive = false) => {
        try {
            const results: { path: string; name: string; isDirectory: boolean; size: number }[] = []

            async function scanDir(currentPath: string): Promise<void> {
                const entries = await readdir(currentPath, { withFileTypes: true })
                for (const entry of entries) {
                    const fullPath = join(currentPath, entry.name)
                    const relativePath = relative(dirPath, fullPath)
                    const stats = await stat(fullPath)

                    results.push({
                        path: relativePath.replace(/\\/g, '/'),
                        name: entry.name,
                        isDirectory: entry.isDirectory(),
                        size: stats.size
                    })

                    if (recursive && entry.isDirectory()) {
                        await scanDir(fullPath)
                    }
                }
            }

            await scanDir(dirPath)
            return { success: true, files: results }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle(
        'file:search',
        async (_, dirPath: string, query: string, options?: { extensions?: string[] }) => {
            try {
                const results: { path: string; name: string; lineNumber?: number; lineContent?: string }[] =
                    []
                const queryLower = query.toLowerCase()

                async function searchDir(currentPath: string): Promise<void> {
                    const entries = await readdir(currentPath, { withFileTypes: true })
                    for (const entry of entries) {
                        const fullPath = join(currentPath, entry.name)
                        const relativePath = relative(dirPath, fullPath)

                        if (entry.isDirectory()) {
                            await searchDir(fullPath)
                        } else {
                            // Check extension filter
                            if (options?.extensions) {
                                const ext = entry.name.split('.').pop()?.toLowerCase()
                                if (!ext || !options.extensions.includes(ext)) continue
                            }

                            // Search in filename
                            if (entry.name.toLowerCase().includes(queryLower)) {
                                results.push({
                                    path: relativePath.replace(/\\/g, '/'),
                                    name: entry.name
                                })
                            }

                            // Search in content for text files
                            const textExts = ['lua', 'luau', 'json', 'txt', 'md', 'yaml', 'toml']
                            const ext = entry.name.split('.').pop()?.toLowerCase()
                            if (ext && textExts.includes(ext)) {
                                try {
                                    const content = await readFile(fullPath, 'utf-8')
                                    const lines = content.split('\n')
                                    for (let i = 0; i < lines.length; i++) {
                                        if (lines[i].toLowerCase().includes(queryLower)) {
                                            results.push({
                                                path: relativePath.replace(/\\/g, '/'),
                                                name: entry.name,
                                                lineNumber: i + 1,
                                                lineContent: lines[i].trim().substring(0, 100)
                                            })
                                        }
                                    }
                                } catch {
                                    // Skip files that can't be read
                                }
                            }
                        }
                    }
                }

                await searchDir(dirPath)
                return { success: true, results: results.slice(0, 100) }
            } catch (error) {
                return { success: false, error: String(error) }
            }
        }
    )

    // Dialog operations
    ipcMain.handle('dialog:selectFolder', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory']
        })
        if (result.canceled) return { success: false, canceled: true }
        return { success: true, path: result.filePaths[0] }
    })

    // Settings operations
    ipcMain.handle('settings:get', () => {
        return store.get('settings')
    })

    ipcMain.handle('settings:set', (_, settings: Partial<Settings>) => {
        const current = store.get('settings')
        store.set('settings', { ...current, ...settings })
        return store.get('settings')
    })

    // Project operations
    ipcMain.handle('projects:list', () => {
        return store.get('projects')
    })

    ipcMain.handle('projects:create', (_, project: Omit<Project, 'id' | 'createdAt' | 'lastOpenedAt'>) => {
        const projects = store.get('projects')
        const newProject: Project = {
            ...project,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            lastOpenedAt: new Date().toISOString()
        }
        store.set('projects', [...projects, newProject])
        return newProject
    })

    ipcMain.handle('projects:update', (_, id: string, updates: Partial<Project>) => {
        const projects = store.get('projects')
        const index = projects.findIndex((p) => p.id === id)
        if (index === -1) return null
        projects[index] = { ...projects[index], ...updates }
        store.set('projects', projects)
        return projects[index]
    })

    ipcMain.handle('projects:delete', (_, id: string) => {
        const projects = store.get('projects')
        store.set(
            'projects',
            projects.filter((p) => p.id !== id)
        )
        // Also delete associated chats and checkpoints
        const chats = store.get('chats')
        const chatIds = chats.filter((c) => c.projectId === id).map((c) => c.id)
        store.set(
            'chats',
            chats.filter((c) => c.projectId !== id)
        )
        const checkpoints = store.get('checkpoints')
        store.set(
            'checkpoints',
            checkpoints.filter((cp) => !chatIds.includes(cp.chatId))
        )
        return true
    })

    // Chat operations
    ipcMain.handle('chats:list', (_, projectId: string) => {
        const chats = store.get('chats')
        return chats.filter((c) => c.projectId === projectId)
    })

    ipcMain.handle('chats:get', (_, chatId: string) => {
        const chats = store.get('chats')
        return chats.find((c) => c.id === chatId) || null
    })

    ipcMain.handle('chats:create', (_, projectId: string, title: string) => {
        const chats = store.get('chats')
        const newChat: Chat = {
            id: crypto.randomUUID(),
            projectId,
            title,
            messages: [],
            createdAt: new Date().toISOString()
        }
        store.set('chats', [...chats, newChat])
        return newChat
    })

    ipcMain.handle('chats:update', (_, chatId: string, updates: Partial<Chat>) => {
        const chats = store.get('chats')
        const index = chats.findIndex((c) => c.id === chatId)
        if (index === -1) return null
        chats[index] = { ...chats[index], ...updates }
        store.set('chats', chats)
        return chats[index]
    })

    ipcMain.handle('chats:addMessage', (_, chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
        const chats = store.get('chats')
        const index = chats.findIndex((c) => c.id === chatId)
        if (index === -1) return null
        const newMessage: Message = {
            ...message,
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString()
        }
        chats[index].messages.push(newMessage)
        store.set('chats', chats)
        return newMessage
    })

    ipcMain.handle('chats:delete', (_, chatId: string) => {
        const chats = store.get('chats')
        store.set(
            'chats',
            chats.filter((c) => c.id !== chatId)
        )
        const checkpoints = store.get('checkpoints')
        store.set(
            'checkpoints',
            checkpoints.filter((cp) => cp.chatId !== chatId)
        )
        return true
    })

    // Checkpoint operations
    ipcMain.handle('checkpoints:list', (_, chatId: string) => {
        const checkpoints = store.get('checkpoints')
        return checkpoints.filter((cp) => cp.chatId === chatId)
    })

    ipcMain.handle(
        'checkpoints:create',
        async (_, chatId: string, messageIndex: number, projectPath: string) => {
            const checkpoints = store.get('checkpoints')

            // Capture current state of all files
            const files: { path: string; content: string }[] = []

            async function captureFiles(dirPath: string): Promise<void> {
                const entries = await readdir(dirPath, { withFileTypes: true })
                for (const entry of entries) {
                    const fullPath = join(dirPath, entry.name)
                    const relativePath = relative(projectPath, fullPath)

                    if (entry.isDirectory()) {
                        await captureFiles(fullPath)
                    } else {
                        const ext = entry.name.split('.').pop()?.toLowerCase()
                        const codeExts = ['lua', 'luau', 'json', 'toml', 'yaml', 'txt', 'md']
                        if (ext && codeExts.includes(ext)) {
                            try {
                                const content = await readFile(fullPath, 'utf-8')
                                files.push({ path: relativePath.replace(/\\/g, '/'), content })
                            } catch {
                                // Skip unreadable files
                            }
                        }
                    }
                }
            }

            await captureFiles(projectPath)

            const newCheckpoint: Checkpoint = {
                id: crypto.randomUUID(),
                chatId,
                messageIndex,
                files,
                createdAt: new Date().toISOString()
            }

            store.set('checkpoints', [...checkpoints, newCheckpoint])
            return newCheckpoint
        }
    )

    ipcMain.handle('checkpoints:restore', async (_, checkpointId: string, projectPath: string) => {
        const checkpoints = store.get('checkpoints')
        const checkpoint = checkpoints.find((cp) => cp.id === checkpointId)
        if (!checkpoint) return { success: false, error: 'Checkpoint not found' }

        try {
            for (const file of checkpoint.files) {
                const fullPath = join(projectPath, file.path)
                const dir = join(fullPath, '..')
                if (!existsSync(dir)) {
                    await mkdir(dir, { recursive: true })
                }
                await writeFile(fullPath, file.content, 'utf-8')
            }
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle('checkpoints:delete', (_, checkpointId: string) => {
        const checkpoints = store.get('checkpoints')
        store.set(
            'checkpoints',
            checkpoints.filter((cp) => cp.id !== checkpointId)
        )
        return true
    })

    // App info
    ipcMain.handle('app:getPath', (_, name: 'userData' | 'home' | 'temp') => {
        return app.getPath(name)
    })

    ipcMain.handle('app:wipeData', () => {
        store.clear()
        app.relaunch()
        app.exit()
    })
}
