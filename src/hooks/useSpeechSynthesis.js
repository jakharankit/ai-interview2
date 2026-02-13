import { useState, useCallback, useEffect, useRef } from "react";

/**
 * Custom hook for Web Speech API speech synthesis (voice output).
 * Cross-browser support.
 */
export function useSpeechSynthesis() {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [voices, setVoices] = useState([]);
    const [error, setError] = useState(null);
    const utteranceRef = useRef(null);

    const isSupported =
        typeof window !== "undefined" && "speechSynthesis" in window;

    useEffect(() => {
        if (!isSupported) return;

        const loadVoices = () => {
            const available = window.speechSynthesis.getVoices();
            setVoices(available);
        };

        loadVoices();
        window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

        return () => {
            window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
            window.speechSynthesis.cancel();
        };
    }, [isSupported]);

    const speak = useCallback(
        (text, options = {}) => {
            if (!isSupported) {
                setError("Speech synthesis not supported.");
                return;
            }

            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = options.rate ?? 1;
            utterance.pitch = options.pitch ?? 1;
            utterance.volume = options.volume ?? 1;

            if (options.voice) {
                utterance.voice = options.voice;
            } else {
                // Prefer a natural English voice
                const preferred = voices.find(
                    (v) => v.lang.startsWith("en") && v.name.includes("Google")
                ) || voices.find((v) => v.lang.startsWith("en"));
                if (preferred) utterance.voice = preferred;
            }

            utterance.onstart = () => setIsSpeaking(true);
            utterance.onend = () => setIsSpeaking(false);
            utterance.onerror = (e) => {
                setError(`Speech error: ${e.error}`);
                setIsSpeaking(false);
            };

            utteranceRef.current = utterance;
            window.speechSynthesis.speak(utterance);
        },
        [isSupported, voices]
    );

    const stop = useCallback(() => {
        if (isSupported) {
            window.speechSynthesis.cancel();
            setIsSpeaking(false);
        }
    }, [isSupported]);

    const pause = useCallback(() => {
        if (isSupported) window.speechSynthesis.pause();
    }, [isSupported]);

    const resume = useCallback(() => {
        if (isSupported) window.speechSynthesis.resume();
    }, [isSupported]);

    return {
        speak,
        stop,
        pause,
        resume,
        isSpeaking,
        isSupported,
        voices,
        error,
    };
}
