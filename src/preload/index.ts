import { contextBridge, ipcRenderer } from 'electron'

// Types
interface AiFetchResult {
    success: boolean
    data?: any
    text?: string
    status?: number
    error?: string
}

interface AiChatStreamParams {
    requestId: string
    url: string
    headers: Record<string, string>
    body: any
}
interface FileResult {
    success: boolean
    content?: string
    error?: string
}

interface FileListResult {
    success: boolean
    files?: { path: string; name: string; isDirectory: boolean; size: number }[]
    error?: string
}

interface SearchResult {
    success: boolean
    results?: { path: string; name: string; lineNumber?: number; lineContent?: string }[]
    error?: string
}

interface FolderResult {
    success: boolean
    path?: string
    canceled?: boolean
}

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

// API exposed to renderer
const api = {
    // File operations
    files: {
        read: (filePath: string): Promise<FileResult> => ipcRenderer.invoke('file:read', filePath),
        write: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('file:write', filePath, content),
        mkdir: (dirPath: string): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('file:mkdir', dirPath),
        delete: (filePath: string): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('file:delete', filePath),
        exists: (filePath: string): Promise<boolean> => ipcRenderer.invoke('file:exists', filePath),
        list: (dirPath: string, recursive?: boolean): Promise<FileListResult> =>
            ipcRenderer.invoke('file:list', dirPath, recursive),
        search: (
            dirPath: string,
            query: string,
            options?: { extensions?: string[] }
        ): Promise<SearchResult> => ipcRenderer.invoke('file:search', dirPath, query, options)
    },

    events: {
        onFilesChanged: (callback: (event: { projectPath: string }) => void): (() => void) => {
            const listener = (_: Electron.IpcRendererEvent, payload: { projectPath: string }) => {
                callback(payload)
            }
            ipcRenderer.on('files:changed', listener)
            return () => {
                ipcRenderer.removeListener('files:changed', listener)
            }
        }
    },

    // Dialog operations
    dialogs: {
        selectFolder: (): Promise<FolderResult> => ipcRenderer.invoke('dialog:selectFolder')
    },

    // Settings operations
    settings: {
        get: (): Promise<Settings> => ipcRenderer.invoke('settings:get'),
        set: (settings: Partial<Settings>): Promise<Settings> =>
            ipcRenderer.invoke('settings:set', settings)
    },

    // Project operations
    projects: {
        list: (): Promise<Project[]> => ipcRenderer.invoke('projects:list'),
        create: (project: { name: string; folderPath: string; syncMode: 'filesystem' }): Promise<Project> =>
            ipcRenderer.invoke('projects:create', project),
        update: (id: string, updates: Partial<Project>): Promise<Project | null> =>
            ipcRenderer.invoke('projects:update', id, updates),
        delete: (id: string): Promise<boolean> => ipcRenderer.invoke('projects:delete', id)
    },

    // Chat operations
    chats: {
        list: (projectId: string): Promise<Chat[]> => ipcRenderer.invoke('chats:list', projectId),
        get: (chatId: string): Promise<Chat | null> => ipcRenderer.invoke('chats:get', chatId),
        create: (projectId: string, title: string): Promise<Chat> =>
            ipcRenderer.invoke('chats:create', projectId, title),
        update: (chatId: string, updates: Partial<Chat>): Promise<Chat | null> =>
            ipcRenderer.invoke('chats:update', chatId, updates),
        addMessage: (
            chatId: string,
            message: Omit<Message, 'id' | 'timestamp'>
        ): Promise<Message | null> => ipcRenderer.invoke('chats:addMessage', chatId, message),
        delete: (chatId: string): Promise<boolean> => ipcRenderer.invoke('chats:delete', chatId)
    },

    // Checkpoint operations
    checkpoints: {
        list: (chatId: string): Promise<Checkpoint[]> => ipcRenderer.invoke('checkpoints:list', chatId),
        create: (
            chatId: string,
            messageIndex: number,
            projectPath: string
        ): Promise<Checkpoint> => ipcRenderer.invoke('checkpoints:create', chatId, messageIndex, projectPath),
        restore: (
            checkpointId: string,
            projectPath: string
        ): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('checkpoints:restore', checkpointId, projectPath),
        delete: (checkpointId: string): Promise<boolean> =>
            ipcRenderer.invoke('checkpoints:delete', checkpointId)
    },

    // App utilities
    app: {
        getPath: (name: 'userData' | 'home' | 'temp'): Promise<string> =>
            ipcRenderer.invoke('app:getPath', name),
        wipeData: (): Promise<void> => ipcRenderer.invoke('app:wipeData')
    },

    // AI/Network operations
    ai: {
        fetch: (url: string, options?: { headers?: Record<string, string>; method?: string; body?: string }): Promise<AiFetchResult> =>
            ipcRenderer.invoke('ai:fetch', url, options),
        chatStream: (params: AiChatStreamParams): Promise<{ success: boolean; status?: number; error?: string }> =>
            ipcRenderer.invoke('ai:chatStream', params),
        abortChatStream: (requestId: string): Promise<boolean> =>
            ipcRenderer.invoke('ai:chatStream:abort', requestId),
        onChatStreamChunk: (requestId: string, callback: (chunk: string) => void): (() => void) => {
            const channel = `ai:stream:chunk:${requestId}`
            const listener = (_: any, chunk: string) => callback(chunk)
            ipcRenderer.on(channel, listener)
            return () => ipcRenderer.removeListener(channel, listener)
        },
        onChatStreamDone: (requestId: string, callback: () => void): (() => void) => {
            const channel = `ai:stream:done:${requestId}`
            const listener = () => callback()
            ipcRenderer.once(channel, listener)
            return () => ipcRenderer.removeListener(channel, listener)
        },
        onChatStreamError: (requestId: string, callback: (error: string) => void): (() => void) => {
            const channel = `ai:stream:error:${requestId}`
            const listener = (_: any, error: string) => callback(error)
            ipcRenderer.once(channel, listener)
            return () => ipcRenderer.removeListener(channel, listener)
        }
    }

}

// Type declaration for window.api
export type ElectronAPI = typeof api

// Expose to renderer
if (process.contextIsolated) {
    contextBridge.exposeInMainWorld('api', api)
} else {
    // @ts-ignore
    window.api = api
}
