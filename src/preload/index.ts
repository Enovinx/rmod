import { contextBridge, ipcRenderer } from 'electron'

// Types
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
    theme: 'dark' | 'light'
    hasCompletedSetup: boolean
}

// API exposed to renderer
const api = {
    // File operations
    files: {
        read: (filePath: string): Promise<FileResult> => ipcRenderer.invoke('file:read', filePath),
        write: (filePath: string, content: string): Promise<{ success: boolean; error?: string }> =>
            ipcRenderer.invoke('file:write', filePath, content),
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
        create: (project: { name: string; folderPath: string }): Promise<Project> =>
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
            ipcRenderer.invoke('app:getPath', name)
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
