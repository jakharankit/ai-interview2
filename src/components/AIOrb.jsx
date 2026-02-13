import { useEffect, useState } from 'react'

/**
 * AI Orb — Perplexity voice-mode-style animated orb.
 * States: idle, thinking, speaking, listening
 */
export default function AIOrb({ state = 'idle', size = 120 }) {
    const [rings, setRings] = useState([])

    // Generate ripple rings when speaking
    useEffect(() => {
        if (state !== 'speaking') {
            setRings([])
            return
        }
        const interval = setInterval(() => {
            setRings(prev => {
                const now = Date.now()
                const filtered = prev.filter(r => now - r < 2000)
                return [...filtered, now].slice(-4)
            })
        }, 500)
        return () => clearInterval(interval)
    }, [state])

    return (
        <div className="ai-orb-container" style={{ width: size * 2.5, height: size * 2.5 }}>
            {/* Ripple rings (speaking state) */}
            {rings.map((id) => (
                <div key={id} className="ai-orb-ring" style={{
                    width: size,
                    height: size,
                    animationDuration: '2s',
                }} />
            ))}

            {/* Glow backdrop */}
            <div className={`ai-orb-glow ai-orb-glow--${state}`} style={{
                width: size * 1.8,
                height: size * 1.8,
            }} />

            {/* Main orb */}
            <div
                className={`ai-orb ai-orb--${state}`}
                style={{ width: size, height: size }}
                role="status"
                aria-label={`AI is ${state}`}
            >
                {/* Inner gradient sphere */}
                <div className="ai-orb-inner" />

                {/* State icon */}
                <span className="ai-orb-icon material-icons-round">
                    {state === 'thinking' ? 'psychology' :
                        state === 'speaking' ? 'graphic_eq' :
                            state === 'listening' ? 'mic' :
                                'smart_toy'}
                </span>
            </div>

            {/* State label */}
            <div className={`ai-orb-label ai-orb-label--${state}`}>
                {state === 'thinking' ? 'Thinking...' :
                    state === 'speaking' ? 'Speaking' :
                        state === 'listening' ? 'Listening...' :
                            ''}
            </div>
        </div>
    )
}
