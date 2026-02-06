import { useState } from 'react'
import type { Settings, ModelPreset } from '../types'
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

    const handleApiKeyChange = (key: string) => {
        onChange({ openRouterKey: key })
    }

    const handlePresetChange = (presetId: string) => {
        onChange({ activeModelPreset: presetId })
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
        { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
        { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
        { id: 'openai/gpt-4-turbo', name: 'GPT-4 Turbo' },
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
                    {/* API Key */}
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

                    {/* Model Presets */}
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
                        </div>
                    </section>

                    {/* About */}
                    <section className="settings-section">
                        <h3>About</h3>
                        <p className="text-secondary text-sm">
                            RMod v1.0.0<br />
                            AI-powered coding assistant for Roblox development
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
                            onClick={() => {
                                if (confirm('Are you sure you want to wipe all data and reset RMod? This cannot be undone.')) {
                                    window.api.app.wipeData()
                                }
                            }}
                        >
                            Wipe RMod Data
                        </button>
                    </section>
                </div>
            </div>
        </div>
    )
}
