import { useState } from 'react'
import './Setup.css'

interface SetupProps {
    onComplete: (key: string) => void
}

export default function Setup({ onComplete }: SetupProps) {
    const [apiKey, setApiKey] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!apiKey.trim()) {
            setError('Please enter your OpenRouter API key')
            return
        }

        if (!apiKey.startsWith('sk-')) {
            setError('Invalid API key format. OpenRouter keys start with "sk-"')
            return
        }

        setLoading(true)
        setError('')

        try {
            // Test the API key
            const response = await fetch('https://openrouter.ai/api/v1/models', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            })

            if (!response.ok) {
                throw new Error('Invalid API key')
            }

            onComplete(apiKey)
        } catch {
            setError('Could not validate API key. Please check and try again.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="setup-container">
            <div className="setup-background">
                <div className="gradient-orb orb-1" />
                <div className="gradient-orb orb-2" />
                <div className="gradient-orb orb-3" />
            </div>

            <div className="setup-content animate-slide-up">
                <div className="setup-logo">
                    <svg viewBox="0 0 48 48" fill="none" className="logo-icon">
                        <rect x="4" y="4" width="40" height="40" rx="8" fill="url(#logoGradient)" />
                        <path
                            d="M16 20L24 16L32 20V28L24 32L16 28V20Z"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinejoin="round"
                        />
                        <path d="M24 16V32" stroke="white" strokeWidth="2" />
                        <path d="M16 20L32 28" stroke="white" strokeWidth="2" />
                        <path d="M32 20L16 28" stroke="white" strokeWidth="2" />
                        <defs>
                            <linearGradient id="logoGradient" x1="4" y1="4" x2="44" y2="44">
                                <stop stopColor="#8b5cf6" />
                                <stop offset="1" stopColor="#06b6d4" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <h1 className="gradient-text">Roblox Vibe Code</h1>
                </div>

                <p className="setup-subtitle">
                    AI-powered coding assistant for Roblox development
                </p>

                <form onSubmit={handleSubmit} className="setup-form">
                    <div className="form-group">
                        <label htmlFor="apiKey">OpenRouter API Key</label>
                        <input
                            id="apiKey"
                            type="password"
                            className="input"
                            placeholder="sk-or-v1-..."
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            disabled={loading}
                        />
                        <p className="form-hint">
                            Get your API key at{' '}
                            <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                                openrouter.ai/keys
                            </a>
                        </p>
                    </div>

                    {error && <div className="error-message">{error}</div>}

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg setup-submit"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner spinner-sm" />
                                Validating...
                            </>
                        ) : (
                            'Get Started'
                        )}
                    </button>
                </form>

                <div className="setup-features">
                    <div className="feature">
                        <span className="feature-icon">🤖</span>
                        <span>AI Coding Agent</span>
                    </div>
                    <div className="feature">
                        <span className="feature-icon">📁</span>
                        <span>File Management</span>
                    </div>
                    <div className="feature">
                        <span className="feature-icon">⏪</span>
                        <span>Checkpoints</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
