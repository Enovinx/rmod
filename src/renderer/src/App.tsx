import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Home from './pages/Home'
import ProjectWorkspace from './pages/ProjectWorkspace'
import Setup from './pages/Setup'
import type { Settings } from './types'

export default function App() {
    const [settings, setSettings] = useState<Settings | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        try {
            const s = await window.api.settings.get()
            setSettings(s)
        } catch (error) {
            console.error('Failed to load settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSetupComplete = async (key: string) => {
        const updated = await window.api.settings.set({
            openRouterKey: key,
            hasCompletedSetup: true
        })
        setSettings(updated)
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center" style={{ height: '100vh' }}>
                <div className="spinner spinner-lg" />
            </div>
        )
    }

    // Show setup if first time
    if (settings && !settings.hasCompletedSetup) {
        return <Setup onComplete={handleSetupComplete} />
    }

    return (
        <BrowserRouter>
            <div className="app-container" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
                {/* Drag region for titlebar */}
                <div className="titlebar-drag-region" style={{
                    background: 'var(--bg-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 'var(--spacing-md)'
                }}>
                    <span className="text-sm font-semibold gradient-text no-drag">Roblox Vibe Code</span>
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/project/:projectId" element={<ProjectWorkspace />} />
                        <Route path="/project/:projectId/chat/:chatId" element={<ProjectWorkspace />} />
                    </Routes>
                </div>
            </div>
        </BrowserRouter>
    )
}
