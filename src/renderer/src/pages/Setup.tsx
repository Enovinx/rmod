import { useState } from 'react'
import './Setup.css'

interface SetupProps {
    onComplete: (settings: { provider: 'openrouter' | 'ollama'; openRouterKey?: string; ollamaUrl?: string }) => void
}

export default function Setup({ onComplete }: SetupProps) {
    const [step, setStep] = useState(0) // 0 = API Key, 1-4 = Onboarding Cards
    const [provider, setProvider] = useState<'openrouter' | 'ollama'>('openrouter')
    const [apiKey, setApiKey] = useState('')
    const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSetupSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        setLoading(true)
        setError('')

        try {
            if (provider === 'openrouter') {
                if (!apiKey.trim()) {
                    throw new Error('Please enter your OpenRouter API key')
                }

                if (!apiKey.startsWith('sk-')) {
                    throw new Error('Invalid API key format. OpenRouter keys start with "sk-"')
                }

                const response = await window.api.ai.fetch('https://openrouter.ai/api/v1/models', {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                })

                if (!response.success) {
                    throw new Error('Invalid API key')
                }
            } else {
                if (!ollamaUrl.trim()) {
                    throw new Error('Please enter your Ollama URL')
                }

                // Try to format domain
                let urlToTest = ollamaUrl.trim();
                if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
                    urlToTest = 'http://' + urlToTest;
                }

                // Ensure no trailing slash for consistent testing
                if (urlToTest.endsWith('/')) {
                    urlToTest = urlToTest.slice(0, -1);
                }

                setOllamaUrl(urlToTest);

                const response = await window.api.ai.fetch(`${urlToTest}/api/tags`)

                if (!response.success) {
                    throw new Error('Could not connect to Ollama. Please ensure it is running.')
                }
            }

            // Move to next step instead of completing immediately
            setStep(1)
        } catch (err: any) {
            setError(err.message || 'Validation failed. Please check your settings and try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleNext = () => {
        if (step < 4) {
            setStep(step + 1)
        } else {
            onComplete({
                provider,
                ...(provider === 'openrouter' ? { openRouterKey: apiKey } : { ollamaUrl })
            })
        }
    }

    const renderApiKeyStep = () => (
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
                <h1 className="gradient-text">RMod</h1>
            </div>

            <p className="setup-subtitle">
                AI-powered coding assistant for Roblox development
            </p>

            <form onSubmit={handleSetupSubmit} className="setup-form">
                <div className="provider-selector" style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px' }}>
                    <button
                        type="button"
                        className={`btn ${provider === 'openrouter' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1 }}
                        onClick={() => { setProvider('openrouter'); setError(''); }}
                    >
                        OpenRouter
                    </button>
                    <button
                        type="button"
                        className={`btn ${provider === 'ollama' ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ flex: 1 }}
                        onClick={() => { setProvider('ollama'); setError(''); }}
                    >
                        Ollama (Local)
                    </button>
                </div>

                {provider === 'openrouter' ? (
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
                ) : (
                    <div className="form-group">
                        <label htmlFor="ollamaUrl">Ollama URL</label>
                        <input
                            id="ollamaUrl"
                            type="text"
                            className="input"
                            placeholder="http://localhost:11434"
                            value={ollamaUrl}
                            onChange={(e) => setOllamaUrl(e.target.value)}
                            disabled={loading}
                        />
                        <p className="form-hint">
                            Ensure Ollama is running and accessible. Default is `http://localhost:11434`.
                        </p>
                    </div>
                )}

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
    )

    const renderOnboardingCard = () => {
        let title = ''
        let content: React.ReactNode = null
        let icon = ''

        switch (step) {
            case 1:
                title = 'Enable Studio Script Sync'
                icon = '🔄'
                content = (
                    <div className="onboarding-card-content">
                        <p>To use this app effectively with Roblox Studio, you need to enable script synchronization.</p>
                        <p>Please follow the instructions in the beta announcement:</p>
                        <a
                            href="https://devforum.roblox.com/t/studio-script-sync-now-in-beta/4065468/47"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-card"
                        >
                            <span className="link-icon">📄</span>
                            <span>Studio Script Sync - Setup Guide</span>
                        </a>
                    </div>
                )
                break
            case 2:
                title = 'AI & The Environment'
                icon = '🌱'
                content = (
                    <div className="onboarding-card-content">
                        <p>Large Language Models require significant energy. Please use responsibly.</p>
                        <p>Consider donating to offset carbon emissions:</p>
                        <a
                            href="https://www.mamaplantatree.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-card"
                        >
                            <span className="link-icon">🌳</span>
                            <span>Mama Plant a Tree</span>
                        </a>
                    </div>
                )
                break
            case 3:
                title = 'About the Creator'
                icon = '👨‍💻'
                content = (
                    <div className="onboarding-card-content">
                        <p>This application was created by <strong>@Enovinx</strong>.</p>
                        <p>Follow for updates and more tools!</p>
                    </div>
                )
                break
            case 4:
                title = 'Have Fun!'
                icon = '🚀'
                content = (
                    <div className="onboarding-card-content">
                        <p>You're all set to build amazing Roblox games with the power of AI.</p>
                        <p>Let's start coding!</p>
                    </div>
                )
                break
        }

        return (
            <div className="setup-content animate-slide-up onboarding-step">
                <div className="onboarding-icon">{icon}</div>
                <h2 className="onboarding-title">{title}</h2>
                {content}

                <div className="onboarding-actions">
                    <div className="step-indicators">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`} />
                        ))}
                    </div>
                    <button className="btn btn-primary btn-lg" onClick={handleNext}>
                        {step === 4 ? 'Let\'s Go!' : 'Next'}
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="setup-container">
            <div className="setup-background">
                <div className="gradient-orb orb-1" />
                <div className="gradient-orb orb-2" />
                <div className="gradient-orb orb-3" />
            </div>

            {step === 0 ? renderApiKeyStep() : renderOnboardingCard()}
        </div>
    )
}
