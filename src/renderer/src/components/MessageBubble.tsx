import type { Message } from '../types'
import './MessageBubble.css'

interface MessageBubbleProps {
    message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user'
    const isTool = message.role === 'tool'

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
        <div className={`message-bubble ${isUser ? 'user-message' : 'assistant-message'}`}>
            {!isUser && (
                <div className="message-avatar">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M5 6L8 4L11 6V10L8 12L5 10V6Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                </div>
            )}
            <div className="message-content">
                {renderContent(message.content)}

                {message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="tool-calls">
                        {message.toolCalls.map(tool => (
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

                {message.toolResults && message.toolResults.length > 0 && (
                    <div className="tool-results">
                        {message.toolResults.map(result => (
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

function renderContent(content: string) {
    // Simple markdown-like rendering
    const lines = content.split('\n')
    const elements: JSX.Element[] = []
    let inCodeBlock = false
    let codeContent: string[] = []
    let codeLanguage = ''

    lines.forEach((line, i) => {
        if (line.startsWith('```')) {
            if (inCodeBlock) {
                elements.push(
                    <pre key={i} className="code-block">
                        <code className={codeLanguage}>{codeContent.join('\n')}</code>
                    </pre>
                )
                codeContent = []
                inCodeBlock = false
            } else {
                inCodeBlock = true
                codeLanguage = line.slice(3).trim()
            }
        } else if (inCodeBlock) {
            codeContent.push(line)
        } else if (line.startsWith('# ')) {
            elements.push(<h3 key={i} className="md-h1">{line.slice(2)}</h3>)
        } else if (line.startsWith('## ')) {
            elements.push(<h4 key={i} className="md-h2">{line.slice(3)}</h4>)
        } else if (line.startsWith('- ')) {
            elements.push(<li key={i} className="md-li">{line.slice(2)}</li>)
        } else if (line.trim() === '') {
            elements.push(<br key={i} />)
        } else {
            // Handle inline code
            const parts = line.split(/(`[^`]+`)/g)
            elements.push(
                <p key={i} className="md-p">
                    {parts.map((part, j) =>
                        part.startsWith('`') && part.endsWith('`')
                            ? <code key={j} className="inline-code">{part.slice(1, -1)}</code>
                            : part
                    )}
                </p>
            )
        }
    })

    return <div className="message-text">{elements}</div>
}
