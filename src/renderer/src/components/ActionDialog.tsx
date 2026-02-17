import './ActionDialog.css'

interface ActionDialogProps {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    showCancel?: boolean
    danger?: boolean
    onConfirm: () => void
    onCancel: () => void
}

export default function ActionDialog({
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    showCancel = true,
    danger = false,
    onConfirm,
    onCancel
}: ActionDialogProps) {
    return (
        <div className="modal-backdrop action-dialog-backdrop" onClick={onCancel}>
            <div className="modal action-dialog" onClick={e => e.stopPropagation()}>
                <div className="action-dialog-header">
                    <h3>{title}</h3>
                </div>
                <p className="action-dialog-message">{message}</p>
                <div className="action-dialog-actions">
                    {showCancel && (
                        <button className="btn btn-sm" onClick={onCancel}>
                            {cancelLabel}
                        </button>
                    )}
                    <button className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={onConfirm}>
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
