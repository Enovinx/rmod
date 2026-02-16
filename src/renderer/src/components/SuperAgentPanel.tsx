import type { SuperAgentPlan } from '../types'
import './SuperAgentPanel.css'

interface SuperAgentPanelProps {
    plan: SuperAgentPlan
    onCancel: () => void
    variant?: 'full' | 'dock'
    showCancelButton?: boolean
}

export default function SuperAgentPanel({ plan, onCancel, variant = 'full', showCancelButton = true }: SuperAgentPanelProps) {
    const completedCount = plan.tasks.filter(t => t.status === 'completed').length
    const progress = plan.tasks.length > 0 ? (completedCount / plan.tasks.length) * 100 : 0
    const activeTaskIndex = plan.tasks.findIndex(task => task.status === 'in-progress')
    const nextPendingTaskIndex = plan.tasks.findIndex(task => task.status === 'pending')
    const displayActiveTaskIndex = activeTaskIndex !== -1 ? activeTaskIndex : nextPendingTaskIndex
    const currentTaskLabel = displayActiveTaskIndex !== -1
        ? plan.tasks[displayActiveTaskIndex].description
        : 'Waiting for next task...'

    const getDisplayStatus = (taskStatus: SuperAgentPlan['tasks'][number]['status'], index: number) => {
        if (taskStatus === 'pending' && index === displayActiveTaskIndex) {
            return 'in-progress'
        }

        return taskStatus
    }

    const renderTaskIcon = (status: ReturnType<typeof getDisplayStatus>) => {
        if (status === 'completed') {
            return (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            )
        }

        if (status === 'in-progress') {
            return <div className="spinner spinner-sm" />
        }

        if (status === 'failed') {
            return (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
            )
        }

        return null
    }

    const renderTaskItem = (task: SuperAgentPlan['tasks'][number], index: number) => {
        const displayStatus = getDisplayStatus(task.status, index)

        return (
            <div key={task.id} className={`task-item ${displayStatus}`}>
                <div className="task-checkbox">{renderTaskIcon(displayStatus)}</div>
                <div className="task-content">
                    <span className="task-number">{index + 1}.</span>
                    <span className="task-description">{task.description}</span>
                </div>
            </div>
        )
    }

    if (variant === 'dock') {
        return (
            <div className="super-agent-panel super-agent-dock">
                <div className="dock-header-row">
                    <div className="panel-title">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M8 1L9.545 4.13L13 4.635L10.5 7.07L11.09 10.5L8 8.885L4.91 10.5L5.5 7.07L3 4.635L6.455 4.13L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        </svg>
                        <span>Super Agent Progress</span>
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={onCancel}>Stop</button>
                </div>

                <div className="dock-current-task">
                    <span className="label">Current:</span>
                    <span>{currentTaskLabel}</span>
                </div>

                <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
                <div className="progress-text">{completedCount} of {plan.tasks.length} tasks completed</div>

                <div className="tasks-list dock-tasks-list">
                    {plan.tasks.map(renderTaskItem)}
                </div>
            </div>
        )
    }

    return (
        <div className="super-agent-panel">
            <div className="panel-header">
                <div className="panel-title">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1L9.545 4.13L13 4.635L10.5 7.07L11.09 10.5L8 8.885L4.91 10.5L5.5 7.07L3 4.635L6.455 4.13L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    <span>Super Agent Plan</span>
                </div>
                {showCancelButton && (
                    <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                        Cancel
                    </button>
                )}
            </div>

            <div className="panel-goal">
                <span className="label">Goal:</span>
                <span>{plan.goal}</span>
            </div>

            <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-text">
                {completedCount} of {plan.tasks.length} tasks completed
            </div>

            <div className="tasks-list">
                {plan.tasks.map(renderTaskItem)}
            </div>

            {plan.estimatedCost && (
                <div className="cost-estimate">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M7 4V7M7 9V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    <span>Estimated cost: ~${plan.estimatedCost.toFixed(4)}</span>
                </div>
            )}
        </div>
    )
}
