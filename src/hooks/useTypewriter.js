import { useState, useEffect } from 'react'

/**
 * Typewriter effect hook — reveals text character by character.
 * @param {string} text - Text to reveal
 * @param {number} speed - Milliseconds per character (default: 25)
 * @returns {{ displayed: string, done: boolean }}
 */
export function useTypewriter(text, speed = 25) {
    const [displayed, setDisplayed] = useState('')
    const [done, setDone] = useState(false)

    useEffect(() => {
        setDisplayed('')
        setDone(false)
        if (!text) { setDone(true); return }
        let i = 0
        const t = setInterval(() => {
            i++
            setDisplayed(text.slice(0, i))
            if (i >= text.length) { clearInterval(t); setDone(true) }
        }, speed)
        return () => clearInterval(t)
    }, [text, speed])

    return { displayed, done }
}
