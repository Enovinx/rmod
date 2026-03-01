import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { readFile, writeFile, unlink, readdir, stat, mkdir } from 'fs/promises'
import { join, relative, basename, dirname } from 'path'
import { existsSync } from 'fs'
import Store from 'electron-store'

interface Project {
    id: string
    name: string
    folderPath: string
    syncMode: 'filesystem'
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
    files: { path: string; content: string; encoding?: 'base64' | 'utf-8' }[]
    createdAt: string
}

const CHECKPOINT_IGNORED_DIRS = new Set([
    '.git',
    '.idea',
    '.vscode',
    'node_modules',
    'dist',
    'build',
    '.next'
])

async function collectCheckpointFiles(projectPath: string): Promise<Checkpoint['files']> {
    const files: Checkpoint['files'] = []

    async function visit(dirPath: string): Promise<void> {
        const entries = await readdir(dirPath, { withFileTypes: true })

        for (const entry of entries) {
            const fullPath = join(dirPath, entry.name)
            const relativePath = relative(projectPath, fullPath).replace(/\\/g, '/')

            if (entry.isDirectory()) {
                if (!CHECKPOINT_IGNORED_DIRS.has(entry.name)) {
                    await visit(fullPath)
                }
                continue
            }

            if (!entry.isFile()) {
                continue
            }

            try {
                const content = await readFile(fullPath)
                files.push({
                    path: relativePath,
                    content: content.toString('base64'),
                    encoding: 'base64'
                })
            } catch {
                // Skip unreadable files
            }
        }
    }

    await visit(projectPath)
    return files
}

interface ModelPreset {
    id: string
    name: string
    modelId: string
    temperature: number
    maxTokens: number
}

interface Settings {
    provider: 'openrouter' | 'ollama'
    openRouterKey: string
    ollamaUrl: string
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
    hasSeenModelWalkthrough: boolean
    checkpointRetentionDays: number
}

let store: Store<{
    projects: Project[]
    chats: Chat[]
    checkpoints: Checkpoint[]
    settings: Settings
}>

function purgeExpiredCheckpoints(retentionDays: number): Checkpoint[] {
    const checkpoints = store.get('checkpoints')
    const safeRetentionDays = Math.max(1, Math.floor(retentionDays))
    const maxAgeMs = safeRetentionDays * 24 * 60 * 60 * 1000
    const cutoffTime = Date.now() - maxAgeMs

    const filtered = checkpoints.filter((checkpoint) => {
        const createdAt = new Date(checkpoint.createdAt).getTime()
        return Number.isFinite(createdAt) && createdAt >= cutoffTime
    })

    if (filtered.length !== checkpoints.length) {
        store.set('checkpoints', filtered)
    }

    return filtered
}

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
                provider: 'openrouter',
                openRouterKey: '',
                ollamaUrl: 'http://localhost:11434',
                activeModelPreset: 'balanced',
                modelPresets: [
                    {
                        id: 'powerful',
                        name: 'GLM-5 (Powerful)',
                        modelId: 'z-ai/glm-5',
                        temperature: 0.7,
                        maxTokens: 16384
                    },
                    {
                        id: 'balanced',
                        name: 'MiniMax M2.5 (Balanced)',
                        modelId: 'minimax/minimax-m2.5',
                        temperature: 0.7,
                        maxTokens: 16384
                    },
                    {
                        id: 'fast',
                        name: 'Gemini 3 Flash (Fast)',
                        modelId: 'google/gemini-3-flash-preview',
                        temperature: 0.7,
                        maxTokens: 16384
                    }
                ],
                theme: 'graphite',
                hasCompletedSetup: false,
                hasSeenModelWalkthrough: false,
                checkpointRetentionDays: 30
            }
        }
    })

    console.log('Store initialized at:', store.path)

    const initialSettings = store.get('settings')
    if (!Number.isFinite(initialSettings.checkpointRetentionDays)) {
        store.set('settings', {
            ...initialSettings,
            checkpointRetentionDays: 30
        })
    }
    purgeExpiredCheckpoints(store.get('settings').checkpointRetentionDays)

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
            notifyFileTreeChanged(dirname(filePath))

            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle('file:mkdir', async (_, dirPath: string) => {
        try {
            await mkdir(dirPath, { recursive: true })
            notifyFileTreeChanged(dirPath)
            return { success: true }
        } catch (error) {
            return { success: false, error: String(error) }
        }
    })

    ipcMain.handle('file:delete', async (_, filePath: string) => {
        try {
            await unlink(filePath)
            notifyFileTreeChanged(dirname(filePath))

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
        const nextSettings = { ...current, ...settings }
        const retentionDays = Number(nextSettings.checkpointRetentionDays)
        nextSettings.checkpointRetentionDays = Number.isFinite(retentionDays)
            ? Math.max(1, Math.floor(retentionDays))
            : 30
        store.set('settings', nextSettings)

        purgeExpiredCheckpoints(nextSettings.checkpointRetentionDays)
        return store.get('settings')
    })

    // Project operations
    ipcMain.handle('projects:list', () => {
        return store.get('projects')
    })

    ipcMain.handle('projects:create', async (_, project: Omit<Project, 'id' | 'createdAt' | 'lastOpenedAt'>) => {
        const projects = store.get('projects')
        const id = crypto.randomUUID()
        const newProject: Project = {
            ...project,
            id,
            folderPath: project.folderPath,
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

    ipcMain.handle('projects:delete', async (_, id: string) => {
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
        const checkpoints = purgeExpiredCheckpoints(store.get('settings').checkpointRetentionDays)
        return checkpoints.filter((cp) => cp.chatId === chatId)
    })

    ipcMain.handle(
        'checkpoints:create',
        async (_, chatId: string, messageIndex: number, projectPath: string) => {
            const checkpoints = purgeExpiredCheckpoints(store.get('settings').checkpointRetentionDays)

            const files = await collectCheckpointFiles(projectPath)

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
            const existingFiles = await collectCheckpointFiles(projectPath)
            const checkpointFileSet = new Set(checkpoint.files.map((file) => file.path))

            for (const file of existingFiles) {
                if (!checkpointFileSet.has(file.path)) {
                    await unlink(join(projectPath, file.path))
                }
            }

            for (const file of checkpoint.files) {
                const fullPath = join(projectPath, file.path)
                const dir = dirname(fullPath)
                if (!existsSync(dir)) {
                    await mkdir(dir, { recursive: true })
                }
                const encoding = file.encoding ?? 'utf-8'
                if (encoding === 'base64') {
                    await writeFile(fullPath, Buffer.from(file.content, 'base64'))
                } else {
                    await writeFile(fullPath, file.content, 'utf-8')
                }
            }
            notifyFileTreeChanged(projectPath)
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

    // AI/Network operations - uses Node.js http/https to fully bypass CORS
    ipcMain.handle('ai:fetch', async (_, url: string, options?: { headers?: Record<string, string>; method?: string; body?: string }) => {
        const http = require('http')
        const https = require('https')

        return new Promise((resolve) => {
            try {
                const parsed = new URL(url)
                const client = parsed.protocol === 'https:' ? https : http

                const reqOptions: any = {
                    hostname: parsed.hostname,
                    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                    path: parsed.pathname + parsed.search,
                    method: options?.method || 'GET',
                    headers: options?.headers || {}
                }

                const req = client.request(reqOptions, (res: any) => {
                    const chunks: Buffer[] = []
                    res.on('data', (chunk: Buffer) => chunks.push(chunk))
                    res.on('end', () => {
                        const body = Buffer.concat(chunks).toString('utf-8')
                        if (res.statusCode < 200 || res.statusCode >= 300) {
                            resolve({ success: false, status: res.statusCode, error: body || res.statusMessage })
                            return
                        }
                        try {
                            const data = JSON.parse(body)
                            resolve({ success: true, data })
                        } catch {
                            resolve({ success: true, text: body })
                        }
                    })
                })

                req.on('error', (err: any) => {
                    console.error('ai:fetch error:', err)
                    resolve({ success: false, error: err.message || String(err) })
                })

                if (options?.body) {
                    req.write(options.body)
                }
                req.end()
            } catch (error: any) {
                console.error('ai:fetch error:', error)
                resolve({ success: false, error: error.message || String(error) })
            }
        })
    })

    const activeStreams = new Map<string, { abort: () => void }>()

    ipcMain.handle('ai:chatStream', async (event, params: {
        requestId: string
        url: string
        headers: Record<string, string>
        body: any
    }) => {
        const http = require('http')
        const https = require('https')

        const { requestId, url, headers, body } = params
        const webContents = event.sender

        return new Promise((resolve) => {
            try {
                const parsed = new URL(url)
                const client = parsed.protocol === 'https:' ? https : http

                const reqOptions: any = {
                    hostname: parsed.hostname,
                    port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
                    path: parsed.pathname + parsed.search,
                    method: 'POST',
                    headers: {
                        ...headers,
                        'Content-Type': 'application/json'
                    }
                }

                const req = client.request(reqOptions, (res: any) => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        const chunks: Buffer[] = []
                        res.on('data', (chunk: Buffer) => chunks.push(chunk))
                        res.on('end', () => {
                            const errorText = Buffer.concat(chunks).toString('utf-8')
                            activeStreams.delete(requestId)
                            resolve({ success: false, status: res.statusCode, error: errorText || res.statusMessage })
                        })
                        return
                    }

                    // Stream is ready, resolve immediately
                    resolve({ success: true })

                    res.on('data', (chunk: Buffer) => {
                        if (!webContents.isDestroyed()) {
                            webContents.send(`ai:stream:chunk:${requestId}`, chunk.toString('utf-8'))
                        }
                    })

                    res.on('end', () => {
                        activeStreams.delete(requestId)
                        if (!webContents.isDestroyed()) {
                            webContents.send(`ai:stream:done:${requestId}`)
                        }
                    })

                    res.on('error', (err: any) => {
                        activeStreams.delete(requestId)
                        if (!webContents.isDestroyed()) {
                            webContents.send(`ai:stream:error:${requestId}`, err.message || String(err))
                        }
                    })
                })

                req.on('error', (err: any) => {
                    activeStreams.delete(requestId)
                    console.error('ai:chatStream error:', err)
                    resolve({ success: false, error: err.message || String(err) })
                })

                activeStreams.set(requestId, {
                    abort: () => {
                        req.destroy()
                        activeStreams.delete(requestId)
                    }
                })

                req.write(JSON.stringify(body))
                req.end()
            } catch (error: any) {
                activeStreams.delete(requestId)
                console.error('ai:chatStream error:', error)
                resolve({ success: false, error: error.message || String(error) })
            }
        })
    })

    ipcMain.handle('ai:chatStream:abort', (_, requestId: string) => {
        const stream = activeStreams.get(requestId)
        if (stream) {
            stream.abort()
            return true
        }
        return false
    })
}
const notifyFileTreeChanged = (projectPath: string): void => {
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send('files:changed', { projectPath })
    }
}
