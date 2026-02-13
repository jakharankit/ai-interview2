import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Custom hook for Web Speech API speech recognition (voice input).
 * Works in Chrome and Edge.
 */
export function useSpeechRecognition(options = {}) {
    const { continuous = true, interimResults = true, lang = "en-US" } = options;

    const [transcript, setTranscript] = useState("");
    const [interimTranscript, setInterimTranscript] = useState("");
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);

    const isSupported =
        typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

    useEffect(() => {
        if (!isSupported) return;

        const SpeechRecognitionAPI =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognitionAPI();

        recognition.continuous = continuous;
        recognition.interimResults = interimResults;
        recognition.lang = lang;

        recognition.onresult = (event) => {
            let finalText = "";
            let interim = "";

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalText += result[0].transcript;
                } else {
                    interim += result[0].transcript;
                }
            }

            if (finalText) {
                setTranscript((prev) => prev + finalText);
            }
            setInterimTranscript(interim);
        };

        recognition.onerror = (event) => {
            if (event.error !== "aborted") {
                setError(`Speech recognition error: ${event.error}`);
            }
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
            setInterimTranscript("");
        };

        recognitionRef.current = recognition;

        return () => recognition.abort();
    }, [isSupported, continuous, interimResults, lang]);

    const start = useCallback(() => {
        if (!recognitionRef.current || !isSupported) {
            setError("Speech recognition is not supported in this browser.");
            return;
        }
        setError(null);
        try {
            recognitionRef.current.start();
            setIsListening(true);
        } catch (e) {
            if (e instanceof DOMException && e.name === "InvalidStateError") {
                setIsListening(true);
            } else {
                setError("Failed to start speech recognition.");
            }
        }
    }, [isSupported]);

    const stop = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
        }
    }, []);

    const reset = useCallback(() => {
        setTranscript("");
        setInterimTranscript("");
        setError(null);
    }, []);

    return {
        transcript,
        interimTranscript,
        isListening,
        isSupported,
        start,
        stop,
        reset,
        error,
    };
}
