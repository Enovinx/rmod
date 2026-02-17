import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project, Settings } from '../types'
import ProjectCard from '../components/ProjectCard'
import CreateProjectModal from '../components/CreateProjectModal'
import SettingsPanel from '../components/SettingsPanel'
import ActionDialog from '../components/ActionDialog'
import Walkthrough from '../components/Walkthrough'
import { applyTheme } from '../theme'
import './Home.css'

export default function Home() {
    const navigate = useNavigate()
    const [projects, setProjects] = useState<Project[]>([])
    const [settings, setSettings] = useState<Settings | null>(null)
    const [loading, setLoading] = useState(true)
    const [showCreateModal, setShowCreateModal] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [projectPendingDelete, setProjectPendingDelete] = useState<string | null>(null)

    useEffect(() => {
        loadProjects()
        loadSettings()
    }, [])

    const loadProjects = async () => {
        try {
            const projectList = await window.api.projects.list()
            // Sort by most recently opened
            projectList.sort((a, b) =>
                new Date(b.lastOpenedAt).getTime() - new Date(a.lastOpenedAt).getTime()
            )
            setProjects(projectList)
        } catch (error) {
            console.error('Failed to load projects:', error)
        } finally {
            setLoading(false)
        }
    }

    const loadSettings = async () => {
        try {
            const s = await window.api.settings.get()
            setSettings(s)
        } catch (error) {
            console.error('Failed to load settings:', error)
        }
    }

    const handleSettingsChange = async (updates: Partial<Settings>) => {
        try {
            const updated = await window.api.settings.set(updates)
            if (updates.theme) {
                applyTheme(updated.theme)
            }
            setSettings(updated)
        } catch (error) {
            console.error('Failed to update settings:', error)
        }
    }

    const handleCreateProject = async (name: string, folderPath: string) => {
        try {
            const project = await window.api.projects.create({ name, folderPath })
            setProjects(prev => [project, ...prev])
            setShowCreateModal(false)
            navigate(`/project/${project.id}`)
        } catch (error) {
            console.error('Failed to create project:', error)
        }
    }

    const handleOpenProject = async (project: Project) => {
        // Update last opened time
        await window.api.projects.update(project.id, {
            lastOpenedAt: new Date().toISOString()
        })
        navigate(`/project/${project.id}`)
    }

    const handleDeleteProject = async (projectId: string) => {
        setProjectPendingDelete(projectId)
    }

    const confirmDeleteProject = async () => {
        if (!projectPendingDelete) return
        await window.api.projects.delete(projectPendingDelete)
        setProjects(prev => prev.filter(p => p.id !== projectPendingDelete))
        setProjectPendingDelete(null)
    }

    return (
        <div className="home-container">
            {/* Background decoration */}
            <div className="home-background">
                <div className="bg-grid" />
                <div className="bg-gradient" />
            </div>

            <div className="home-content">
                <header className="home-header">
                    <div>
                        <h1 className="text-2xl font-bold">Your Projects</h1>
                        <p className="text-secondary">Select a project or create a new one to get started</p>
                    </div>
                    <div className="header-actions">
                        <button
                            id="settings-button"
                            className="btn btn-ghost btn-icon"
                            onClick={() => setShowSettings(true)}
                            title="Settings"
                        >
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <path d="M10 13C11.6569 13 13 11.6569 13 10C13 8.34315 11.6569 7 10 7C8.34315 7 7 8.34315 7 10C7 11.6569 8.34315 13 10 13Z" stroke="currentColor" strokeWidth="1.5" />
                                <path d="M10 2V4M10 16V18M18 10H16M4 10H2M15.657 4.343L14.243 5.757M5.757 14.243L4.343 15.657M15.657 15.657L14.243 14.243M5.757 5.757L4.343 4.343" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                        </button>
                        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                            New Project
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div className="home-loading">
                        <div className="spinner spinner-lg" />
                    </div>
                ) : projects.length === 0 ? (
                    <div className="home-empty">
                        <div className="empty-icon">
                            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                                <rect x="8" y="12" width="48" height="40" rx="4" stroke="currentColor" strokeWidth="2" />
                                <path d="M8 20H56" stroke="currentColor" strokeWidth="2" />
                                <circle cx="14" cy="16" r="2" fill="currentColor" />
                                <circle cx="20" cy="16" r="2" fill="currentColor" />
                                <circle cx="26" cy="16" r="2" fill="currentColor" />
                                <path d="M24 36L32 28L40 36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M32 28V44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                        </div>
                        <h2>No projects yet</h2>
                        <p className="text-secondary">Create your first project to start coding with AI</p>
                        <button className="btn btn-primary btn-lg" onClick={() => setShowCreateModal(true)}>
                            Create Your First Project
                        </button>
                    </div>
                ) : (
                    <div className="projects-grid">
                        {projects.map((project, index) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                onOpen={() => handleOpenProject(project)}
                                onDelete={() => handleDeleteProject(project.id)}
                                style={{ animationDelay: `${index * 50}ms` }}
                            />
                        ))}
                    </div>
                )}
            </div>

            {showCreateModal && (
                <CreateProjectModal
                    onClose={() => setShowCreateModal(false)}
                    onCreate={handleCreateProject}
                />
            )}

            {showSettings && settings && (
                <SettingsPanel
                    settings={settings}
                    onClose={() => setShowSettings(false)}
                    onChange={handleSettingsChange}
                />
            )}

            {projectPendingDelete && (
                <ActionDialog
                    title="Delete project?"
                    message="Are you sure you want to delete this project? Chat history will also be deleted."
                    confirmLabel="Delete"
                    danger
                    onCancel={() => setProjectPendingDelete(null)}
                    onConfirm={confirmDeleteProject}
                />
            )}

            {!loading && settings && !settings.hasSeenModelWalkthrough && !showSettings && (
                <Walkthrough
                    targetId="settings-button"
                    title="Change Active Model"
                    message="You can switch between powerful, balanced, and fast models here at any time. We've set you up with the latest SOTA models!"
                    onComplete={() => handleSettingsChange({ hasSeenModelWalkthrough: true })}
                />
            )}
        </div>
    )
}
