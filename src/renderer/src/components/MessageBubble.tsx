import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import type { Message } from '../types'
import './MessageBubble.css'

interface MessageBubbleProps {
    message: Message
    showAvatar?: boolean
}

const TABLE_ROW_REGEX = /^\s*\|.*\|\s*$/
const TABLE_DIVIDER_REGEX = /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/


const INLINE_MENTION_REGEX = /(^|[\s(])@([A-Za-z0-9._/-]+)/g
const MENTION_LINK_PREFIX = 'https://mentions.rmod.local/'

function annotateMentions(content: string): string {
    return content.replace(INLINE_MENTION_REGEX, (_, prefix: string, name: string) => {
        return `${prefix}[@${name}](${MENTION_LINK_PREFIX}${name})`
    })
}

type MarkdownSegment =
    | { type: 'markdown'; content: string }
    | { type: 'table'; headers: string[]; rows: string[][] }

function splitTableCells(row: string): string[] {
    return row
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim())
}

function normalizeCollapsedTableBlocks(content: string): string {
    const lines = content.split('\n')
    const normalized: string[] = []
    let isInCodeFence = false

    lines.forEach(line => {
        if (line.trim().startsWith('```')) {
            isInCodeFence = !isInCodeFence
            normalized.push(line)
            return
        }

        if (!isInCodeFence && line.includes('||') && line.includes('|')) {
            normalized.push(...line.split(/\s*\|\|\s*/))
            return
        }

        normalized.push(line)
    })

    return normalized.join('\n')
}

function parseMarkdownSegments(content: string): MarkdownSegment[] {
    const normalizedContent = normalizeCollapsedTableBlocks(content)
    const lines = normalizedContent.split('\n')
    const segments: MarkdownSegment[] = []
    const markdownBuffer: string[] = []
    let index = 0
    let isInCodeFence = false

    const flushMarkdownBuffer = () => {
        if (markdownBuffer.length === 0) {
            return
        }

        segments.push({ type: 'markdown', content: markdownBuffer.join('\n').trimEnd() })
        markdownBuffer.length = 0
    }

    while (index < lines.length) {
        const line = lines[index]

        if (line.trim().startsWith('```')) {
            isInCodeFence = !isInCodeFence
            markdownBuffer.push(line)
            index += 1
            continue
        }

        if (!isInCodeFence && index + 1 < lines.length && TABLE_ROW_REGEX.test(line) && TABLE_DIVIDER_REGEX.test(lines[index + 1])) {
            flushMarkdownBuffer()

            const headers = splitTableCells(line)
            const columnCount = headers.length
            const rows: string[][] = []
            index += 2

            while (index < lines.length && TABLE_ROW_REGEX.test(lines[index])) {
                const row = splitTableCells(lines[index]).slice(0, columnCount)
                while (row.length < columnCount) {
                    row.push('')
                }
                rows.push(row)
                index += 1
            }

            segments.push({ type: 'table', headers, rows })
            continue
        }

        markdownBuffer.push(line)
        index += 1
    }

    flushMarkdownBuffer()

    return segments
}

const markdownComponents = {
    code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || '')
        return !inline && match ? (
            <code className={className} {...props}>
                {children}
            </code>
        ) : (
            <code className="inline-code" {...props}>
                {children}
            </code>
        )
    },
    a({ href, children, ...props }: any) {
        if (typeof href === 'string' && href.startsWith(MENTION_LINK_PREFIX)) {
            return <span className="mention-token">{children}</span>
        }

        return <a href={href} {...props}>{children}</a>
    }
}

export default function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
    const isUser = message.role === 'user'
    const isTool = message.role === 'tool'
    const [showToolCalls, setShowToolCalls] = useState(false)
    const [showToolResults, setShowToolResults] = useState(false)
    const [showReasoning, setShowReasoning] = useState(false)

    const hasText = Boolean(message.content?.trim())
    const hasToolCalls = Boolean(message.toolCalls && message.toolCalls.length > 0)
    const hasToolResults = Boolean(message.toolResults && message.toolResults.length > 0)
    const composedThinking = message.reasoning?.trim() || ''
    const hasThinking = Boolean(composedThinking)
    const formattedContent = useMemo(() => parseMarkdownSegments(annotateMentions(message.content || '')), [message.content])
    const formattedThinking = useMemo(() => parseMarkdownSegments(annotateMentions(composedThinking)), [composedThinking])

    useEffect(() => {
        if (hasThinking) {
            setShowReasoning(true)
        }
    }, [hasThinking])

    if (isTool) {
        return (
            <div className="message-bubble tool-message">
                <div className="tool-header">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M10 3L4.5 8.5L2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>Tool executed</span>
                </div>
                <pre className="tool-content">{message.content}</pre>
            </div>
        )
    }

    return (
        <div className={`message-bubble ${isUser ? 'user-message' : 'assistant-message'} ${message.isStreaming ? 'streaming-message' : ''}`}>
            {!isUser && showAvatar && (
                <div className="message-avatar">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M5 6L8 4L11 6V10L8 12L5 10V6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                </div>
            )}
            <div className="message-content">
                {hasText && (
                    <div className="message-text">
                        {formattedContent.map((segment, index) =>
                            segment.type === 'markdown' ? (
                                <ReactMarkdown
                                    key={`content-markdown-${index}`}
                                    rehypePlugins={[rehypeHighlight]}
                                    components={markdownComponents}
                                >
                                    {segment.content}
                                </ReactMarkdown>
                            ) : (
                                <table key={`content-table-${index}`}>
                                    <thead>
                                        <tr>
                                            {segment.headers.map((header, cellIndex) => (
                                                <th key={`content-header-${cellIndex}`}>
                                                    <ReactMarkdown components={markdownComponents}>{header}</ReactMarkdown>
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {segment.rows.map((row, rowIndex) => (
                                            <tr key={`content-row-${rowIndex}`}>
                                                {row.map((cell, cellIndex) => (
                                                    <td key={`content-cell-${rowIndex}-${cellIndex}`}>
                                                        <ReactMarkdown components={markdownComponents}>{cell}</ReactMarkdown>
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )
                        )}
                    </div>
                )}

                {(hasToolCalls || hasToolResults || hasThinking) && (
                    <div className="message-steps">
                        {hasThinking && (
                            <button
                                type="button"
                                className={`step-toggle tooltip ${showReasoning ? 'is-open' : ''}`}
                                data-tooltip={showReasoning ? 'Hide thinking' : 'Show thinking notes'}
                                aria-label={showReasoning ? 'Hide thinking' : 'Show thinking'}
                                onClick={() => setShowReasoning(!showReasoning)}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M7 1.5C4.51472 1.5 2.5 3.51472 2.5 6C2.5 8.05843 3.88936 9.7911 5.75 10.3201V11.5H8.25V10.3201C10.1106 9.7911 11.5 8.05843 11.5 6C11.5 3.51472 9.48528 1.5 7 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                                    <path d="M5.5 12.5H8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                </svg>
                            </button>
                        )}
                        {hasToolCalls && (
                            <button
                                type="button"
                                className={`step-toggle tooltip ${showToolCalls ? 'is-open' : ''}`}
                                data-tooltip={showToolCalls ? 'Hide tool calls' : 'Show tool calls'}
                                aria-label={showToolCalls ? 'Hide tool calls' : 'Show tool calls'}
                                onClick={() => setShowToolCalls(!showToolCalls)}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M4 2.5H10L11.5 4V11.5H4V2.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                                    <path d="M4 4.5H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                    <path d="M4 7H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                                </svg>
                            </button>
                        )}
                        {hasToolResults && (
                            <button
                                type="button"
                                className={`step-toggle tooltip ${showToolResults ? 'is-open' : ''}`}
                                data-tooltip={showToolResults ? 'Hide tool results' : 'Show tool results'}
                                aria-label={showToolResults ? 'Hide tool results' : 'Show tool results'}
                                onClick={() => setShowToolResults(!showToolResults)}
                            >
                                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                    <path d="M3 7H6L7.5 9L9.5 5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                    <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
                                </svg>
                            </button>
                        )}
                    </div>
                )}

                {hasThinking && showReasoning && (
                    <div className="thinking-panel">
                        <div className="thinking-header">Thinking</div>
                        <div className="thinking-content">
                            {formattedThinking.map((segment, index) =>
                                segment.type === 'markdown' ? (
                                    <ReactMarkdown
                                    key={`thinking-markdown-${index}`}
                                    rehypePlugins={[rehypeHighlight]}
                                    components={markdownComponents}
                                >
                                    {segment.content}
                                </ReactMarkdown>
                                ) : (
                                    <table key={`thinking-table-${index}`}>
                                        <thead>
                                            <tr>
                                                {segment.headers.map((header, cellIndex) => (
                                                    <th key={`thinking-header-${cellIndex}`}><ReactMarkdown components={markdownComponents}>{header}</ReactMarkdown></th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {segment.rows.map((row, rowIndex) => (
                                                <tr key={`thinking-row-${rowIndex}`}>
                                                    {row.map((cell, cellIndex) => (
                                                        <td key={`thinking-cell-${rowIndex}-${cellIndex}`}><ReactMarkdown components={markdownComponents}>{cell}</ReactMarkdown></td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                            )}
                        </div>
                    </div>
                )}

                {hasToolCalls && showToolCalls && (
                    <div className="tool-calls">
                        <div className="tool-call-icons">
                            {message.toolCalls?.map((tool, index) => (
                                <div key={`${tool.id}-icon`} className="tool-call-icon tooltip" data-tooltip={tool.name} style={{ zIndex: message.toolCalls.length - index }}>
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M7 2L10 5M10 5L7 8M10 5H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                </div>
                            ))}
                        </div>
                        {message.toolCalls?.map(tool => (
                            <div key={tool.id} className="tool-call">
                                <div className="tool-call-header">
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M7 2L10 5M10 5L7 8M10 5H2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    <span className="tool-name">{tool.name}</span>
                                </div>
                                <pre className="tool-args">{JSON.stringify(tool.arguments, null, 2)}</pre>
                            </div>
                        ))}
                    </div>
                )}

                {hasToolResults && showToolResults && (
                    <div className="tool-results">
                        <div className="tool-result-icons">
                            {message.toolResults?.map((result, index) => (
                                <div
                                    key={`${result.toolCallId}-icon`}
                                    className={`tool-result-icon tooltip ${result.error ? 'error' : ''}`}
                                    data-tooltip={result.error ? 'Tool failed' : 'Tool output'}
                                    style={{ zIndex: message.toolResults.length - index }}
                                >
                                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                        <path d="M3 7H6L7.5 9L9.5 5H11" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                                        <rect x="2" y="2" width="8" height="8" rx="2" stroke="currentColor" strokeWidth="1.2" />
                                    </svg>
                                </div>
                            ))}
                        </div>
                        {message.toolResults?.map(result => (
                            <div key={result.toolCallId} className={`tool-result ${result.error ? 'error' : ''}`}>
                                <pre>{typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2)}</pre>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
