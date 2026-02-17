import { useEffect, useState } from 'react'
import './Walkthrough.css'

interface WalkthroughProps {
    targetId: string
    title: string
    message: string
    onComplete: () => void
}

export default function Walkthrough({ targetId, title, message, onComplete }: WalkthroughProps) {
    const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const updateCoords = () => {
            const element = document.getElementById(targetId)
            if (element) {
                const rect = element.getBoundingClientRect()
                setCoords({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height
                })
                setIsVisible(true)
            }
        }

        updateCoords()
        window.addEventListener('resize', updateCoords)

        // Short delay to ensure layout is ready
        const timer = setTimeout(updateCoords, 100)

        return () => {
            window.removeEventListener('resize', updateCoords)
            clearTimeout(timer)
        }
    }, [targetId])

    if (!coords || !isVisible) return null

    return (
        <div className="walkthrough-overlay">
            <div
                className="walkthrough-highlight"
                style={{
                    top: coords.top - 4,
                    left: coords.left - 4,
                    width: coords.width + 8,
                    height: coords.height + 8
                }}
            />
            <div
                className="walkthrough-tooltip"
                style={{
                    top: coords.top + coords.height + 12,
                    left: Math.max(16, Math.min(window.innerWidth - 316, coords.left + coords.width / 2 - 150))
                }}
            >
                <div className="tooltip-arrow" style={{ left: coords.left - Math.max(16, Math.min(window.innerWidth - 316, coords.left + coords.width / 2 - 150)) + coords.width / 2 }} />
                <h3>{title}</h3>
                <p>{message}</p>
                <button className="btn btn-primary btn-sm" onClick={onComplete}>
                    Got it!
                </button>
            </div>
        </div>
    )
}
