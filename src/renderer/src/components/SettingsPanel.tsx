import { useEffect, useRef, useState } from 'react'
import type { Settings, ModelPreset } from '../types'
import { THEME_OPTIONS } from '../theme'
import ActionDialog from './ActionDialog'
import './SettingsPanel.css'

interface SettingsPanelProps {
    settings: Settings
    onChange: (updates: Partial<Settings>) => void
    onClose: () => void
}

export default function SettingsPanel({ settings, onChange, onClose }: SettingsPanelProps) {
    const [showApiKey, setShowApiKey] = useState(false)
    const [newPresetName, setNewPresetName] = useState('')
    const [newPresetModel, setNewPresetModel] = useState('')
    const [showAddPreset, setShowAddPreset] = useState(false)
    const [showWipeConfirm, setShowWipeConfirm] = useState(false)
    const [showThemeDropdown, setShowThemeDropdown] = useState(false)
    const [ollamaModels, setOllamaModels] = useState<{ id: string; name: string; isCloud: boolean }[]>([])
    const [loadingOllama, setLoadingOllama] = useState(false)
    const [ollamaError, setOllamaError] = useState('')
    const themeDropdownRef = useRef<HTMLDivElement>(null)

    const selectedTheme = THEME_OPTIONS.find(theme => theme.id === settings.theme) ?? THEME_OPTIONS[0]

    const fetchOllamaModels = async (rawUrl: string) => {
        setLoadingOllama(true)
        setOllamaError('')

        try {
            let urlToTest = rawUrl.trim()
            if (!urlToTest.startsWith('http://') && !urlToTest.startsWith('https://')) {
                urlToTest = 'http://' + urlToTest
            }
            if (urlToTest.endsWith('/')) {
                urlToTest = urlToTest.slice(0, -1)
            }

            const response = await window.api.ai.fetch(`${urlToTest}/api/tags`)
            if (!response.success) throw new Error(response.error || 'Could not connect')

            const data = response.data || {}
            const models = Array.isArray(data.models)
                ? data.models.map((m: any) => ({
                    id: m.name,
                    name: m.name,
                    isCloud: typeof m.name === 'string' && m.name.includes('-cloud')
                }))
                : []

            setOllamaModels(models)

            if (models.length > 0 && !models.find(m => m.id === settings.activeModelPreset)) {
                onChange({ activeModelPreset: models[0].id })
            }
        } catch (err) {
            if (err instanceof Error) {
                console.error('Could not fetch Ollama models:', err.message)
            }
            setOllamaError('Could not connect')
            setOllamaModels([])
        } finally {
            setLoadingOllama(false)
        }
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!themeDropdownRef.current) return
            if (!themeDropdownRef.current.contains(event.target as Node)) {
                setShowThemeDropdown(false)
            }
        }

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setShowThemeDropdown(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        document.addEventListener('keydown', handleEscape)

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.removeEventListener('keydown', handleEscape)
        }
    }, [])

    const handleApiKeyChange = (key: string) => {
        onChange({ openRouterKey: key })
    }

    const handleProviderChange = (provider: 'openrouter' | 'ollama') => {
        if (provider === 'ollama' && !settings.ollamaUrl?.trim()) {
            onChange({ provider, ollamaUrl: 'http://localhost:11434' })
        } else {
            onChange({ provider })
        }
    }

    const handleOllamaUrlChange = (url: string) => {
        onChange({ ollamaUrl: url })
    }

    useEffect(() => {
        if (settings.provider === 'ollama') {
            if (!settings.ollamaUrl?.trim()) {
                onChange({ ollamaUrl: 'http://localhost:11434' })
                return () => { }
            }

            // We use a small timeout to let the user finish typing before trying to fetch
            const timer = setTimeout(() => {
                fetchOllamaModels(settings.ollamaUrl)
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [settings.provider, settings.ollamaUrl])

    const handlePresetChange = (presetId: string) => {
        onChange({ activeModelPreset: presetId })
    }

    const handleCheckpointRetentionChange = (days: number) => {
        if (!Number.isFinite(days)) return
        onChange({ checkpointRetentionDays: Math.min(365, Math.max(1, Math.floor(days))) })
    }

    const handleAddPreset = () => {
        if (!newPresetName || !newPresetModel) return

        const newPreset: ModelPreset = {
            id: crypto.randomUUID(),
            name: newPresetName,
            modelId: newPresetModel,
            temperature: 0.7,
            maxTokens: 4096
        }

        onChange({
            modelPresets: [...settings.modelPresets, newPreset],
            activeModelPreset: newPreset.id
        })

        setNewPresetName('')
        setNewPresetModel('')
        setShowAddPreset(false)
    }

    const handleDeletePreset = (presetId: string) => {
        if (settings.modelPresets.length <= 1) return // Keep at least one preset

        const newPresets = settings.modelPresets.filter(p => p.id !== presetId)
        const newActive = settings.activeModelPreset === presetId
            ? newPresets[0].id
            : settings.activeModelPreset

        onChange({
            modelPresets: newPresets,
            activeModelPreset: newActive
        })
    }

    const popularModels = [
        { id: 'z-ai/glm-5', name: 'GLM-5' },
        { id: 'minimax/minimax-m2.5', name: 'MiniMax M2.5' },
        { id: 'google/gemini-3-flash-preview', name: 'Gemini 3 Flash' },
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'openai/gpt-4o', name: 'GPT-4o' },
        { id: 'google/gemini-pro-1.5', name: 'Gemini Pro 1.5' },
        { id: 'meta-llama/llama-3.1-70b-instruct', name: 'Llama 3.1 70B' }
    ]

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Settings</h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                    </button>
                </div>

                <div className="settings-content">
                    {/* Provider Selection */}
                    <section className="settings-section">
                        <h3>Model Provider</h3>
                        <div className="provider-selector" style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px' }}>
                            <button
                                type="button"
                                className={`btn ${settings.provider === 'openrouter' ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ flex: 1 }}
                                onClick={() => handleProviderChange('openrouter')}
                            >
                                OpenRouter
                            </button>
                            <button
                                type="button"
                                className={`btn ${settings.provider === 'ollama' ? 'btn-primary' : 'btn-ghost'}`}
                                style={{ flex: 1 }}
                                onClick={() => handleProviderChange('ollama')}
                            >
                                Ollama (Local)
                            </button>
                        </div>
                    </section>

                    {/* API Key / Ollama URL */}
                    {settings.provider === 'openrouter' ? (
                        <section className="settings-section">
                            <h3>OpenRouter API Key</h3>
                            <div className="api-key-input">
                                <input
                                    type={showApiKey ? 'text' : 'password'}
                                    className="input"
                                    value={settings.openRouterKey}
                                    onChange={e => handleApiKeyChange(e.target.value)}
                                    placeholder="sk-or-v1-..."
                                />
                                <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => setShowApiKey(!showApiKey)}
                                    title={showApiKey ? 'Hide' : 'Show'}
                                >
                                    {showApiKey ? '👁️' : '👁️‍🗨️'}
                                </button>
                            </div>
                            <p className="form-hint">
                                <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                                    Get your API key →
                                </a>
                            </p>
                        </section>
                    ) : (
                        <section className="settings-section">
                            <h3>Ollama URL</h3>
                            <div className="api-key-input">
                                <input
                                    type="text"
                                    className="input"
                                    value={settings.ollamaUrl || 'http://localhost:11434'}
                                    onChange={e => handleOllamaUrlChange(e.target.value)}
                                    placeholder="http://localhost:11434"
                                />
                            </div>
                            <p className="form-hint">
                                Local URL where your Ollama instance is running.
                            </p>
                        </section>
                    )}

                    {/* Model Presets */}
                    <section className="settings-section">
                        <h3>Theme</h3>
                        <div className="theme-select-wrap" ref={themeDropdownRef}>
                            <button
                                className={`input theme-select-button ${showThemeDropdown ? 'open' : ''}`}
                                type="button"
                                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                                aria-haspopup="listbox"
                                aria-expanded={showThemeDropdown}
                            >
                                <span>{selectedTheme.name}</span>
                                <span className="theme-select-chevron" aria-hidden="true" />
                            </button>

                            {showThemeDropdown && (
                                <div className="theme-dropdown" role="listbox" aria-label="Select theme">
                                    {THEME_OPTIONS.map(theme => (
                                        <button
                                            key={theme.id}
                                            type="button"
                                            className={`theme-dropdown-item ${theme.id === settings.theme ? 'active' : ''}`}
                                            role="option"
                                            aria-selected={theme.id === settings.theme}
                                            onClick={() => {
                                                onChange({ theme: theme.id as Settings['theme'] })
                                                setShowThemeDropdown(false)
                                            }}
                                        >
                                            {theme.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Model Presets */}
                    {settings.provider === 'openrouter' ? (
                        <section className="settings-section">
                            <div className="section-header">
                                <h3>Model Presets</h3>
                                <button
                                    className="btn btn-sm"
                                    onClick={() => setShowAddPreset(!showAddPreset)}
                                >
                                    + Add
                                </button>
                            </div>

                            {showAddPreset && (
                                <div className="add-preset-form">
                                    <input
                                        type="text"
                                        className="input"
                                        placeholder="Preset name"
                                        value={newPresetName}
                                        onChange={e => setNewPresetName(e.target.value)}
                                    />
                                    <input
                                        list="model-presets"
                                        className="input"
                                        value={newPresetModel}
                                        onChange={e => setNewPresetModel(e.target.value)}
                                        placeholder="Select or enter model ID..."
                                    />
                                    <datalist id="model-presets">
                                        {popularModels.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </datalist>

                                    <div className="add-preset-actions">
                                        <button className="btn btn-sm" onClick={() => setShowAddPreset(false)}>
                                            Cancel
                                        </button>
                                        <button
                                            className="btn btn-sm btn-primary"
                                            onClick={handleAddPreset}
                                            disabled={!newPresetName || !newPresetModel}
                                        >
                                            Add Preset
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="presets-list">
                                {settings.modelPresets.map(preset => (
                                    <div
                                        key={preset.id}
                                        className={`preset-item ${preset.id === settings.activeModelPreset ? 'active' : ''}`}
                                        onClick={() => handlePresetChange(preset.id)}
                                    >
                                        <div className="preset-radio">
                                            <div className="radio-outer">
                                                {preset.id === settings.activeModelPreset && <div className="radio-inner" />}
                                            </div>
                                        </div>
                                        <div className="preset-info">
                                            <span className="preset-name">{preset.name}</span>
                                            <span className="preset-model text-muted">{preset.modelId}</span>
                                        </div>
                                        {settings.modelPresets.length > 1 && (
                                            <button
                                                className="btn btn-ghost btn-icon preset-delete"
                                                onClick={e => { e.stopPropagation(); handleDeletePreset(preset.id); }}
                                            >
                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                    <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <p className="form-hint">Be aware that some model providers will collect your data for training. Look at the model on openrouter for more information, so you can decide which are suitable for your project.</p>
                            </div>
                        </section>
                    ) : (
                        <section className="settings-section">
                            <div className="section-header">
                                <h3>Available Ollama Models</h3>
                                {loadingOllama && <div className="spinner spinner-sm" />}
                            </div>

                            {ollamaError && (
                                <p className="text-danger text-sm mb-2">{ollamaError}</p>
                            )}

                            {!ollamaError && ollamaModels.length === 0 && !loadingOllama && (
                                <p className="text-secondary text-sm mb-2">No models found. Make sure Ollama is running and you are signed in if you want to use cloud models.</p>
                            )}

                            <div className="presets-list">
                                {ollamaModels.map(model => (
                                    <div
                                        key={model.id}
                                        className={`preset-item ${model.id === settings.activeModelPreset ? 'active' : ''}`}
                                        onClick={() => handlePresetChange(model.id)}
                                    >
                                        <div className="preset-radio">
                                            <div className="radio-outer">
                                                {model.id === settings.activeModelPreset && <div className="radio-inner" />}
                                            </div>
                                        </div>
                                        <div className="preset-info">
                                            <div className="preset-line">
                                            <span className="preset-name">{model.name}</span>
                                            {model.isCloud && <span className="preset-cloud-badge">Cloud</span>}
                                        </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="settings-section">
                        <h3>Auto-Rollback Retention</h3>
                        <div className="retention-input-row">
                            <input
                                type="number"
                                min={1}
                                max={365}
                                className="input retention-input"
                                value={settings.checkpointRetentionDays}
                                onChange={e => handleCheckpointRetentionChange(Number(e.target.value))}
                            />
                            <span className="text-muted text-sm">days</span>
                        </div>
                        <p className="form-hint">
                            Auto-rollback saves older than this are deleted automatically.
                        </p>
                    </section>

                    {/* About */}
                    <section className="settings-section">
                        <h3>About</h3>
                        <p className="text-secondary text-sm">
                            RMod v1.0.0<br />
                            Unofficial AI-powered coding assistant for Roblox development.
                            Created by @Enovinx.
                        </p>
                    </section>

                    {/* Danger Zone */}
                    <section className="settings-section">
                        <h3 className="text-danger">Danger Zone</h3>
                        <p className="text-secondary text-sm mb-2">
                            Resetting the application will wipe all projects, chats, and settings. This cannot be undone.
                        </p>
                        <button
                            className="btn btn-danger btn-sm"
                            onClick={() => setShowWipeConfirm(true)}
                        >
                            Wipe RMod Data
                        </button>
                    </section>
                </div>
            </div>

            {showWipeConfirm && (
                <ActionDialog
                    title="Wipe all RMod data?"
                    message="This will permanently remove all projects, chats, and settings. This action cannot be undone."
                    confirmLabel="Wipe Data"
                    danger
                    onCancel={() => setShowWipeConfirm(false)}
                    onConfirm={() => window.api.app.wipeData()}
                />
            )}
        </div>
    )
}
