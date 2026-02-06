import { useState } from 'react'
import './Setup.css'

interface SetupProps {
    onComplete: (key: string) => void
}

export default function Setup({ onComplete }: SetupProps) {
    const [step, setStep] = useState(0) // 0 = API Key, 1-4 = Onboarding Cards
    const [apiKey, setApiKey] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleApiKeySubmit = async (e: React.FormEvent) => {
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

            // Move to next step instead of completing immediately
            setStep(1)
        } catch {
            setError('Could not validate API key. Please check and try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleNext = () => {
        if (step < 4) {
            setStep(step + 1)
        } else {
            onComplete(apiKey)
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

            <form onSubmit={handleApiKeySubmit} className="setup-form">
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
