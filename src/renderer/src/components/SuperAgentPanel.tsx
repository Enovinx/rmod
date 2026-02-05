import type { SuperAgentPlan } from '../types'
import './SuperAgentPanel.css'

interface SuperAgentPanelProps {
    plan: SuperAgentPlan
    onCancel: () => void
}

export default function SuperAgentPanel({ plan, onCancel }: SuperAgentPanelProps) {
    const completedCount = plan.tasks.filter(t => t.status === 'completed').length
    const progress = (completedCount / plan.tasks.length) * 100

    return (
        <div className="super-agent-panel">
            <div className="panel-header">
                <div className="panel-title">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M8 1L9.545 4.13L13 4.635L10.5 7.07L11.09 10.5L8 8.885L4.91 10.5L5.5 7.07L3 4.635L6.455 4.13L8 1Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    </svg>
                    <span>Super Agent Plan</span>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={onCancel}>
                    Cancel
                </button>
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
                {plan.tasks.map((task, index) => (
                    <div key={task.id} className={`task-item ${task.status}`}>
                        <div className="task-checkbox">
                            {task.status === 'completed' && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            )}
                            {task.status === 'in-progress' && (
                                <div className="spinner spinner-sm" />
                            )}
                            {task.status === 'failed' && (
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M3 3L9 9M9 3L3 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            )}
                        </div>
                        <div className="task-content">
                            <span className="task-number">{index + 1}.</span>
                            <span className="task-description">{task.description}</span>
                        </div>
                    </div>
                ))}
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
