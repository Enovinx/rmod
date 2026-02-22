// Project
export interface Project {
    id: string
    name: string
    folderPath: string
    syncMode: 'filesystem'
    createdAt: string
    lastOpenedAt: string
}

// Chat & Messages
export interface Chat {
    id: string
    projectId: string
    title: string
    messages: Message[]
    createdAt: string
}

export interface Message {
    id: string
    role: 'user' | 'assistant' | 'system' | 'tool'
    content: string
    reasoning?: string
    toolCalls?: ToolCall[]
    toolResults?: ToolResult[]
    timestamp: string
    isStreaming?: boolean
}

export interface ToolCall {
    id: string
    name: string
    arguments: Record<string, unknown>
}

export interface ToolResult {
    toolCallId: string
    result: unknown
    error?: string
}

// Checkpoints
export interface Checkpoint {
    id: string
    chatId: string
    messageIndex: number
    files: { path: string; content: string; encoding?: 'base64' | 'utf-8' }[]
    createdAt: string
}

// Settings
export interface ModelPreset {
    id: string
    name: string
    modelId: string
    temperature: number
    maxTokens: number
}

export type ThemeId =
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

export interface Settings {
    openRouterKey: string
    activeModelPreset: string
    modelPresets: ModelPreset[]
    theme: ThemeId
    hasCompletedSetup: boolean
    hasSeenModelWalkthrough: boolean
}

// File system
export interface FileEntry {
    path: string
    name: string
    isDirectory: boolean
    size: number
    children?: FileEntry[]
}

export interface SearchMatch {
    path: string
    name: string
    lineNumber?: number
    lineContent?: string
}

// Agent
export interface AgentState {
    isRunning: boolean
    currentStep: number
    totalSteps?: number
    currentAction?: string
    error?: string
}

export interface SuperAgentPlan {
    id: string
    goal: string
    tasks: SuperAgentTask[]
    estimatedCost?: number
    createdAt: string
}

export interface SuperAgentTask {
    id: string
    description: string
    status: 'pending' | 'in-progress' | 'completed' | 'failed'
    result?: string
}

export interface SuperAgentPlanTaskPayload {
    id: string
    title?: string
    description: string
}
