import express from 'express'
import type { Server } from 'http'
import { BrowserWindow } from 'electron'
import { mkdir, writeFile, readFile, unlink, readdir, stat, rm } from 'fs/promises'
import { join, dirname, relative, sep } from 'path'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null

export function setMainWindow(window: BrowserWindow) {
    mainWindow = window
}

interface PluginCommand {
    id: number
    action: 'create' | 'update' | 'delete'
    target: string
    className?: string
    source?: string
}

interface ProjectServer {
    server: Server
    storagePath: string     // Local mirror directory
    commands: PluginCommand[]
    nextCommandId: number
    port: number
    filePaths: Set<string>
}

const servers = new Map<string, ProjectServer>()

/**
 * Start a plugin Express server for a project on the given port.
 */
export function startPluginServer(projectId: string, port: number, storagePath?: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
        // Stop existing server for this project if any
        if (servers.has(projectId)) {
            await stopPluginServer(projectId)
        }

        // Ensure storage path exists
        if (storagePath) {
            if (!existsSync(storagePath)) {
                await mkdir(storagePath, { recursive: true })
            }
        } else {
            // Fallback or error if critical? For now allow but it will fail file ops.
            // Ideally we should enforce storagePath.
            console.warn(`[plugin:${projectId}] No storage path provided, file operations may fail.`)
        }

        const app = express()
        app.use(express.json({ limit: '50mb' })) // Increase limit for snapshots

        const projectServer: ProjectServer = {
            server: null as any,
            storagePath: storagePath || '',
            commands: [],
            nextCommandId: 1,
            port,
            filePaths: new Set()
        }

        // Reserve the spot immediately to prevent race conditions
        servers.set(projectId, projectServer)

        // Populate known files from disk
        if (projectServer.storagePath && existsSync(projectServer.storagePath)) {
            try {
                async function scan(currentPath: string) {
                    const entries = await readdir(currentPath, { withFileTypes: true })
                    for (const entry of entries) {
                        const fullPath = join(currentPath, entry.name)
                        // calculated relative path using strictly forward slashes
                        const relPath = relative(projectServer.storagePath, fullPath).split(sep).join('/')

                        if (!entry.isDirectory()) {
                            projectServer.filePaths.add(relPath)
                        } else {
                            await scan(fullPath)
                        }
                    }
                }
                await scan(projectServer.storagePath)
            } catch (err) {
                console.error(`[plugin:${projectId}] Failed to scan initial files:`, err)
            }
        }

        // Plugin reports file changes from Studio
        app.post('/changes', async (req, res) => {
            const body = req.body
            // console.log(`[plugin:${projectId}] change received`)

            if (!projectServer.storagePath) {
                res.status(500).send('No storage path configured')
                return
            }

            try {
                // Accept both single change and array of files
                if (body && Array.isArray(body.files)) {
                    for (const file of body.files) {
                        if (file.path && typeof file.content === 'string') {
                            await saveFileToStorage(projectServer.storagePath, file.path, file.content)
                            projectServer.filePaths.add(file.path)
                        }
                    }
                } else if (body && body.path && typeof body.content === 'string') {
                    await saveFileToStorage(projectServer.storagePath, body.path, body.content)
                    projectServer.filePaths.add(body.path)
                }

                res.sendStatus(200)

                if (mainWindow) {
                    mainWindow.webContents.send('plugin:files-updated', projectId)
                }
            } catch (err) {
                console.error(`[plugin:${projectId}] Error saving changes:`, err)
                res.status(500).send(String(err))
            }
        })

        // Handle snapshot (initial project sync)
        app.post('/snapshot', async (req, res) => {
            // console.log(`[plugin:${projectId}] snapshot received`)
            const body = req.body

            if (!projectServer.storagePath) {
                res.status(500).send('No storage path configured')
                return
            }

            try {
                // Determine if we should clear existing? Yes, snapshot implies full state.
                // But let's be careful not to delete user created things if not in snapshot?
                // Usually snapshot is "current state of Studio".
                // Safest to clear.
                // await rm(projectServer.storagePath, { recursive: true, force: true })
                // await mkdir(projectServer.storagePath, { recursive: true })
                // Actually, clearing might lose un-synced work if Studio just connected.
                // Let's just overwrite for now.

                if (body && Array.isArray(body.files)) {
                    for (const file of body.files) {
                        if (file.path && typeof file.content === 'string') {
                            await saveFileToStorage(projectServer.storagePath, file.path, file.content)
                            projectServer.filePaths.add(file.path)
                        }
                    }
                }
                res.sendStatus(200)

                if (mainWindow) {
                    mainWindow.webContents.send('plugin:files-updated', projectId)
                }
            } catch (err) {
                console.error(`[plugin:${projectId}] Error processing snapshot:`, err)
                res.status(500).send(String(err))
            }
        })

        // Plugin polls for pending commands
        app.get('/commands', (_req, res) => {
            res.json(projectServer.commands)
        })

        // Internal: push a command to the plugin queue
        app.post('/push-command', (req, res) => {
            const cmd: PluginCommand = {
                ...req.body,
                id: projectServer.nextCommandId++
            }
            projectServer.commands.push(cmd)
            res.json({ ok: true, id: cmd.id })
        })

        const server = app.listen(port, '127.0.0.1', () => {
            console.log(`[plugin:${projectId}] Listening on http://127.0.0.1:${port}`)
            projectServer.server = server
            // Map entry already set, just updating server instance
            resolve()
        })

        server.on('error', (err) => {
            console.error(`[plugin:${projectId}] Server error:`, err)
            servers.delete(projectId) // Cleanup on failure
            reject(err)
        })
    })
}

/**
 * Stop the plugin server for a project.
 */
export function stopPluginServer(projectId: string): Promise<void> {
    return new Promise((resolve) => {
        const projectServer = servers.get(projectId)
        if (projectServer) {
            projectServer.server.close(() => {
                console.log(`[plugin:${projectId}] Server stopped`)
                servers.delete(projectId)
                resolve()
            })
        } else {
            resolve()
        }
    })
}

/**
 * Helper: Save file to storage path
 */
async function saveFileToStorage(storagePath: string, filePath: string, content: string) {
    const fullPath = join(storagePath, filePath)
    const dir = dirname(fullPath)
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true })
    }
    await writeFile(fullPath, content, 'utf-8')
}

/**
 * Get all virtual files for a project (for file explorer / list_directory).
 * Returns an array of { path, name, isDirectory, size } entries.
 */
export async function getPluginFiles(projectId: string): Promise<{ path: string; name: string; isDirectory: boolean; size: number }[]> {
    const projectServer = servers.get(projectId)
    if (!projectServer || !projectServer.storagePath) return []

    const results: { path: string; name: string; isDirectory: boolean; size: number }[] = []

    try {
        async function scan(currentPath: string) {
            const entries = await readdir(currentPath, { withFileTypes: true })
            for (const entry of entries) {
                const fullPath = join(currentPath, entry.name)
                // calculated relative path using strictly forward slashes
                const relPath = relative(projectServer.storagePath, fullPath).split(sep).join('/')

                results.push({
                    path: relPath,
                    name: entry.name,
                    isDirectory: entry.isDirectory(),
                    size: entry.isDirectory() ? 0 : (await stat(fullPath)).size
                })

                if (entry.isDirectory()) {
                    await scan(fullPath)
                }
            }
        }

        if (existsSync(projectServer.storagePath)) {
            await scan(projectServer.storagePath)
        }
    } catch (err) {
        console.error(`[plugin:${projectId}] Error listing files:`, err)
    }

    // Sort: directories first, then by path
    results.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
        return a.path.localeCompare(b.path)
    })

    return results
}

/**
 * Get the content of a virtual file.
 */
export async function getPluginFileContent(projectId: string, filePath: string): Promise<string | null> {
    const projectServer = servers.get(projectId)
    if (!projectServer || !projectServer.storagePath) return null
    try {
        const fullPath = join(projectServer.storagePath, filePath)
        return await readFile(fullPath, 'utf-8')
    } catch {
        return null
    }
}

/**
 * Push a write command and update the virtual file map.
 */
export async function pluginWriteFile(projectId: string, target: string, content: string, className?: string): Promise<void> {
    const projectServer = servers.get(projectId)
    if (!projectServer) throw new Error('Plugin server not running for this project')

    // Write to disk first
    if (projectServer.storagePath) {
        await saveFileToStorage(projectServer.storagePath, target, content)
    }

    const known = projectServer.filePaths.has(target)
    const action = known ? 'update' : 'create'

    // Determine className from file extension if not provided
    if (!className && action === 'create') {
        className = inferClassName(target)
    }

    const cmd: PluginCommand = {
        id: projectServer.nextCommandId++,
        action,
        target,
        source: content,
        ...(className && action === 'create' ? { className } : {})
    }

    projectServer.commands.push(cmd)
    projectServer.filePaths.add(target)
}

/**
 * Push a delete command and remove from the virtual file map.
 */
export async function pluginDeleteFile(projectId: string, target: string): Promise<void> {
    const projectServer = servers.get(projectId)
    if (!projectServer) throw new Error('Plugin server not running for this project')

    const cmd: PluginCommand = {
        id: projectServer.nextCommandId++,
        action: 'delete',
        target
    }

    projectServer.commands.push(cmd)

    if (projectServer.storagePath) {
        const fullPath = join(projectServer.storagePath, target)
        // If ipc.ts already deleted it, unlink might fail. catch error.
        try {
            await unlink(fullPath)
        } catch { }
    }

    if (projectServer.filePaths) {
        projectServer.filePaths.delete(target)
    }
}

/**
 * Infer a Roblox className from the file path / extension.
 */
function inferClassName(target: string): string {
    const lower = target.toLowerCase()
    if (lower.endsWith('.server.lua') || lower.endsWith('.server.luau')) return 'Script'
    if (lower.endsWith('.client.lua') || lower.endsWith('.client.luau')) return 'LocalScript'
    return 'ModuleScript'
}
