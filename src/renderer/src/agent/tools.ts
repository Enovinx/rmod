// Simple path join for browser context
function joinPath(base: string, ...parts: string[]): string {
    const allParts = [base, ...parts]
    return allParts
        .join('/')
        .replace(/\\/g, '/')
        .replace(/\/+/g, '/')
}

export function getTools() {
    return [
        {
            type: 'function',
            function: {
                name: 'create_plan',
                description: 'Create a structured execution plan before implementation. Use after exploring the project.',
                parameters: {
                    type: 'object',
                    properties: {
                        summary: {
                            type: 'string',
                            description: 'High-level summary of the intended implementation'
                        },
                        filesToCreate: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Relative file paths that need to be created'
                        },
                        implementationNotes: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Implementation approach notes'
                        },
                        tasks: {
                            type: 'array',
                            description: 'Checklist tasks in JSON form for later tracking',
                            items: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string' },
                                    description: { type: 'string' }
                                },
                                required: ['id', 'description']
                            }
                        }
                    },
                    required: ['summary', 'tasks']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'update_task_status',
                description: 'Update a planned checklist task status while executing the approved plan.',
                parameters: {
                    type: 'object',
                    properties: {
                        taskId: {
                            type: 'string',
                            description: 'Task id from the approved plan JSON checklist'
                        },
                        status: {
                            type: 'string',
                            enum: ['in-progress', 'completed', 'failed'],
                            description: 'New status for this task'
                        },
                        note: {
                            type: 'string',
                            description: 'Optional note about this update'
                        }
                    },
                    required: ['taskId', 'status']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'read_file',
                description: 'Read the contents of a file. Returns the file contents as a string.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Relative path to the file from the project root'
                        }
                    },
                    required: ['path']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'write_file',
                description: 'Create a new file or overwrite an existing file with the given content.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Relative path where the file should be created/written'
                        },
                        content: {
                            type: 'string',
                            description: 'The content to write to the file'
                        }
                    },
                    required: ['path', 'content']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'edit_file',
                description: 'Edit an existing file by replacing specific content. Use this for targeted edits.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Relative path to the file to edit'
                        },
                        old_content: {
                            type: 'string',
                            description: 'The exact content to find and replace (must match exactly)'
                        },
                        new_content: {
                            type: 'string',
                            description: 'The new content to replace the old content with'
                        }
                    },
                    required: ['path', 'old_content', 'new_content']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'delete_file',
                description: 'Delete a file from the project.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Relative path to the file to delete'
                        }
                    },
                    required: ['path']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'list_directory',
                description: 'List the contents of a directory. Returns file and folder names.',
                parameters: {
                    type: 'object',
                    properties: {
                        path: {
                            type: 'string',
                            description: 'Relative path to the directory (use "." for project root)'
                        },
                        recursive: {
                            type: 'boolean',
                            description: 'Whether to list contents recursively (default: false)'
                        }
                    },
                    required: ['path']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'search_files',
                description: 'Search for files by name or content. Returns matching file paths and snippets.',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: 'The search query (searches in filenames and file contents)'
                        },
                        extensions: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Optional: limit search to specific file extensions (e.g., ["lua", "luau"])'
                        }
                    },
                    required: ['query']
                }
            }
        }
    ]
}

interface ToolResult {
    success: boolean
    data?: any
    error?: string
}

export async function executeToolCall(
    toolName: string,
    args: Record<string, any>,
    projectPath: string
): Promise<ToolResult> {
    try {
        switch (toolName) {
            case 'read_file': {
                const filePath = joinPath(projectPath, args.path)
                const result = await window.api.files.read(filePath)
                if (result.success) {
                    return { success: true, data: result.content }
                }
                return { success: false, error: result.error || 'Failed to read file' }
            }

            case 'create_plan': {
                return {
                    success: true,
                    data: {
                        message: 'Plan draft recorded. Present it to the user for review before implementation.',
                        plan: args
                    }
                }
            }

            case 'update_task_status': {
                return {
                    success: true,
                    data: {
                        message: `Task ${args.taskId} marked as ${args.status}`,
                        taskId: args.taskId,
                        status: args.status,
                        note: args.note
                    }
                }
            }

            case 'write_file': {
                const filePath = joinPath(projectPath, args.path)
                const result = await window.api.files.write(filePath, args.content)
                if (result.success) {
                    return { success: true, data: `File written successfully: ${args.path}` }
                }
                return { success: false, error: result.error || 'Failed to write file' }
            }

            case 'edit_file': {
                const filePath = joinPath(projectPath, args.path)
                // First read the file
                const readResult = await window.api.files.read(filePath)
                if (!readResult.success) {
                    return { success: false, error: readResult.error || 'Failed to read file for editing' }
                }

                const content = readResult.content!
                if (!content.includes(args.old_content)) {
                    return {
                        success: false,
                        error: 'Could not find the specified content to replace. Make sure it matches exactly.'
                    }
                }

                const newContent = content.replace(args.old_content, args.new_content)
                const writeResult = await window.api.files.write(filePath, newContent)
                if (writeResult.success) {
                    return { success: true, data: `File edited successfully: ${args.path}` }
                }
                return { success: false, error: writeResult.error || 'Failed to save edited file' }
            }

            case 'delete_file': {
                const filePath = joinPath(projectPath, args.path)
                const result = await window.api.files.delete(filePath)
                if (result.success) {
                    return { success: true, data: `File deleted: ${args.path}` }
                }
                return { success: false, error: result.error || 'Failed to delete file' }
            }

            case 'list_directory': {
                const dirPath = args.path === '.' ? projectPath : joinPath(projectPath, args.path)
                const result = await window.api.files.list(dirPath, args.recursive || false)
                if (result.success && result.files) {
                    const formatted = result.files.map(f =>
                        `${f.isDirectory ? '📁' : '📄'} ${f.path}`
                    ).join('\n')
                    return { success: true, data: formatted || 'Directory is empty' }
                }
                return { success: false, error: result.error || 'Failed to list directory' }
            }

            case 'search_files': {
                const result = await window.api.files.search(projectPath, args.query, {
                    extensions: args.extensions
                })
                if (result.success && result.results) {
                    if (result.results.length === 0) {
                        return { success: true, data: 'No matches found' }
                    }
                    const formatted = result.results.slice(0, 20).map(r => {
                        if (r.lineNumber) {
                            return `📄 ${r.path}:${r.lineNumber} - ${r.lineContent}`
                        }
                        return `📄 ${r.path}`
                    }).join('\n')
                    return {
                        success: true,
                        data: `Found ${result.results.length} matches:\n${formatted}`
                    }
                }
                return { success: false, error: result.error || 'Search failed' }
            }

            default:
                return { success: false, error: `Unknown tool: ${toolName}` }
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Tool execution failed'
        }
    }
}
