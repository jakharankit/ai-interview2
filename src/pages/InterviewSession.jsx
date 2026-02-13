import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInterview } from '../context/InterviewContext'
import { evaluateAnswer } from '../lib/gemini'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'

/* ─── Voice Mode Sub-component ─── */
function VoiceMode({ transcript, interimTranscript, isListening, onStart, onStop }) {
    return (
        <div className="flex-1 relative rounded-2xl bg-gradient-to-b from-transparent to-slate-50 overflow-hidden flex flex-col items-center justify-center min-h-[400px]">
            <div className="voice-container w-full h-full absolute inset-0 z-0">
                <div className="wave-layer"></div>
                <div className="wave-layer"></div>
                <div className="wave-layer"></div>
                <div className="wave-layer"></div>
                <div className="core-pulse"></div>
            </div>
            <div className="z-10 flex flex-col items-center gap-8 mt-auto mb-16 w-full px-8">
                {/* Live transcript */}
                {(transcript || interimTranscript) && (
                    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 max-w-lg w-full border border-slate-200 shadow-sm">
                        <p className="text-sm text-slate-700">{transcript}<span className="text-slate-400">{interimTranscript}</span></p>
                    </div>
                )}
                <div className="text-center space-y-2 bg-white/50 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/20">
                    <p className="text-lg font-medium text-slate-700">
                        {isListening ? 'Listening to your answer...' : 'Click the mic to start speaking'}
                    </p>
                    <p className="text-sm text-slate-500 animate-pulse">
                        {isListening ? 'Speak naturally, take your time.' : 'Voice input ready'}
                    </p>
                </div>
                <button
                    onClick={isListening ? onStop : onStart}
                    className={`w-20 h-20 rounded-full text-white flex items-center justify-center transition-all shadow-xl z-20 cursor-pointer ${isListening
                            ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30 mic-button-active'
                            : 'bg-primary hover:bg-primary-dark shadow-primary/30'
                        }`}
                    title={isListening ? 'Stop Recording' : 'Start Recording'}
                >
                    <span className="material-icons-round text-4xl">{isListening ? 'stop' : 'mic'}</span>
                </button>
            </div>
        </div>
    )
}

/* ─── Text Answer Mode Sub-component ─── */
function TextMode({ answer, setAnswer }) {
    return (
        <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                <span className="material-icons-round text-slate-400 text-sm">edit_note</span>
                <span className="text-sm font-medium text-slate-600">Type your answer</span>
            </div>
            <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer here... Be as detailed as you can."
                className="flex-1 p-6 text-slate-800 resize-none focus:outline-none text-base leading-relaxed min-h-[300px]"
            />
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex justify-between text-xs text-slate-400">
                <span>{answer.length} characters</span>
                <span>{answer.split(/\s+/).filter(Boolean).length} words</span>
            </div>
        </div>
    )
}

/* ─── Feedback Panel ─── */
function FeedbackPanel({ evaluation, onNext }) {
    if (!evaluation) return null
    const scoreColor = evaluation.score >= 7 ? 'green' : evaluation.score >= 4 ? 'amber' : 'red'

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                    <span className="material-icons-round text-primary">assessment</span>
                    AI Feedback
                </h3>
                <span className={`text-2xl font-bold text-${scoreColor}-500`}>{evaluation.score}/10</span>
            </div>
            <p className="text-sm text-slate-600 mb-4">{evaluation.feedback}</p>

            {evaluation.modelAnswer && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-4">
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-1">Model Answer</p>
                    <p className="text-sm text-blue-900">{evaluation.modelAnswer}</p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
                {evaluation.strengths?.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">Strengths</p>
                        <ul className="space-y-1">
                            {evaluation.strengths.map((s, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                    <span className="material-icons-round text-green-500 text-xs mt-0.5">check</span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                {evaluation.improvements?.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Improvements</p>
                        <ul className="space-y-1">
                            {evaluation.improvements.map((imp, i) => (
                                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                                    <span className="material-icons-round text-amber-500 text-xs mt-0.5">arrow_forward</span>
                                    {imp}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <button
                onClick={onNext}
                className="w-full py-3 bg-primary hover:bg-primary-dark text-white font-bold rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
            >
                <span>Next Question</span>
                <span className="material-icons-round text-sm">arrow_forward</span>
            </button>
        </div>
    )
}

/* ─── Main Interview Session ─── */
export default function InterviewSession() {
    const { state, submitAnswer, setEvaluation, nextQuestion, setReport } = useInterview()
    const navigate = useNavigate()
    const { questions, currentIndex, answers, evaluations, settings } = state

    const [mode, setMode] = useState('text') // 'text' | 'voice'
    const [textAnswer, setTextAnswer] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [showFeedback, setShowFeedback] = useState(false)

    const speech = useSpeechRecognition()
    const synth = useSpeechSynthesis()

    const currentQuestion = questions[currentIndex]
    const progress = questions.length > 0 ? Math.round(((currentIndex + 1) / questions.length) * 100) : 0
    const isLastQuestion = currentIndex === questions.length - 1

    // Read question aloud when it changes (voice mode)
    useEffect(() => {
        if (mode === 'voice' && currentQuestion) {
            synth.speak(currentQuestion.question)
        }
    }, [currentIndex, mode])

    // Redirect if no questions loaded
    useEffect(() => {
        if (questions.length === 0) {
            navigate('/configure')
        }
    }, [questions, navigate])

    const handleSubmitAnswer = useCallback(async () => {
        const answer = mode === 'voice' ? speech.transcript : textAnswer
        if (!answer || answer.trim().length === 0) return

        setSubmitting(true)
        submitAnswer(currentIndex, answer)

        try {
            const evaluation = await evaluateAnswer(
                currentQuestion.question,
                answer,
                state.document?.text?.slice(0, 3000) || ''
            )
            setEvaluation(currentIndex, evaluation)
            setShowFeedback(true)
        } catch (err) {
            // Still proceed even if evaluation fails
            setEvaluation(currentIndex, {
                score: 5,
                feedback: 'Evaluation unavailable — answer recorded.',
                modelAnswer: '',
                strengths: [],
                improvements: [],
            })
            setShowFeedback(true)
        }
        setSubmitting(false)
        if (mode === 'voice') speech.stop()
    }, [mode, speech.transcript, textAnswer, currentIndex, currentQuestion, state.document])

    const handleNext = useCallback(() => {
        setShowFeedback(false)
        setTextAnswer('')
        speech.reset()

        if (isLastQuestion) {
            // Save session to history
            const historyEntry = {
                id: Date.now(),
                documentName: state.document?.metadata?.fileName || 'Interview',
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                score: Math.round(
                    evaluations.filter(Boolean).reduce((sum, e) => sum + (e?.score || 0), 0) /
                    Math.max(evaluations.filter(Boolean).length, 1) * 10
                ),
                questionCount: questions.length,
                difficulty: settings?.difficulty || 'medium',
                persona: settings?.persona || 'academic',
            }
            const history = JSON.parse(localStorage.getItem('interviewHistory') || '[]')
            history.unshift(historyEntry)
            localStorage.setItem('interviewHistory', JSON.stringify(history.slice(0, 50)))

            navigate('/results')
        } else {
            nextQuestion()
        }
    }, [isLastQuestion, evaluations, questions, settings, state.document, navigate, nextQuestion, speech])

    const handleSkip = useCallback(() => {
        submitAnswer(currentIndex, '(skipped)')
        setEvaluation(currentIndex, { score: 0, feedback: 'Question skipped.', modelAnswer: '', strengths: [], improvements: [] })
        handleNext()
    }, [currentIndex, handleNext])

    if (!currentQuestion) return null

    return (
        <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] md:h-screen overflow-hidden relative">
            {/* Left: Main Content */}
            <div className="flex-1 flex flex-col h-full overflow-y-auto relative p-4 md:p-8 lg:pr-4">
                {/* Title Bar */}
                <div className="mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">
                            Interview: {state.document?.metadata?.title || 'AI Session'}
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">
                            {settings?.persona} • {settings?.difficulty} difficulty • {questions.length} questions
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Mode Toggle */}
                        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                            <button
                                onClick={() => setMode('text')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'text' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <span className={`material-icons-round text-base ${mode === 'text' ? 'text-primary' : ''}`}>edit</span>
                                Text
                            </button>
                            <button
                                onClick={() => setMode('voice')}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'voice' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                <span className={`material-icons-round text-base ${mode === 'voice' ? 'text-primary' : ''}`}>mic</span>
                                Voice
                            </button>
                        </div>
                    </div>
                </div>

                {/* Question Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8 mb-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
                    <div className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary mt-1">
                            <span className="material-icons-round">smart_toy</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                                    Question {currentIndex + 1} of {questions.length}
                                </span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className="text-xs text-slate-400">{currentQuestion.type}</span>
                                <span className="text-xs text-slate-400">•</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${currentQuestion.difficulty === 'easy' ? 'bg-green-50 text-green-600' :
                                        currentQuestion.difficulty === 'hard' ? 'bg-red-50 text-red-600' :
                                            'bg-amber-50 text-amber-600'
                                    }`}>{currentQuestion.difficulty}</span>
                            </div>
                            <h2 className="text-xl md:text-2xl font-semibold text-slate-800 leading-relaxed">
                                {currentQuestion.question}
                            </h2>
                            {/* MCQ Options */}
                            {currentQuestion.type === 'mcq' && currentQuestion.options && (
                                <div className="mt-4 space-y-2">
                                    {currentQuestion.options.map((opt, i) => (
                                        <button
                                            key={i}
                                            onClick={() => setTextAnswer(opt)}
                                            className={`w-full text-left p-3 rounded-lg border-2 transition-all text-sm ${textAnswer === opt
                                                    ? 'border-primary bg-primary/5 text-primary font-medium'
                                                    : 'border-slate-100 bg-slate-50 hover:border-primary/30 text-slate-700'
                                                }`}
                                        >
                                            <span className="font-bold mr-2">{String.fromCharCode(65 + i)}.</span>
                                            {opt}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Feedback Panel */}
                {showFeedback && (
                    <FeedbackPanel
                        evaluation={evaluations[currentIndex]}
                        onNext={handleNext}
                    />
                )}

                {/* Answer Input (hidden during feedback) */}
                {!showFeedback && currentQuestion.type !== 'mcq' && (
                    <div className="flex-1 flex flex-col gap-4 mb-6 min-h-[300px]">
                        {mode === 'text' ? (
                            <TextMode answer={textAnswer} setAnswer={setTextAnswer} />
                        ) : (
                            <VoiceMode
                                transcript={speech.transcript}
                                interimTranscript={speech.interimTranscript}
                                isListening={speech.isListening}
                                onStart={speech.start}
                                onStop={speech.stop}
                            />
                        )}
                    </div>
                )}

                {/* Bottom Actions (hidden during feedback) */}
                {!showFeedback && (
                    <div className="flex justify-between items-center pb-4">
                        <button
                            onClick={handleSkip}
                            className="text-slate-500 hover:text-slate-700 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <span className="material-icons-round text-lg">skip_next</span>
                            Skip for now
                        </button>
                        <button
                            onClick={handleSubmitAnswer}
                            disabled={submitting || (!textAnswer.trim() && !speech.transcript.trim())}
                            className={`font-bold px-8 py-3 rounded-lg shadow-lg transition-all flex items-center gap-2 transform hover:-translate-y-0.5 ${submitting || (!textAnswer.trim() && !speech.transcript.trim())
                                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                                    : 'bg-primary hover:bg-primary-dark text-white shadow-primary/20 hover:shadow-primary/40'
                                }`}
                        >
                            {submitting ? (
                                <>
                                    <span className="material-icons-round text-sm animate-spin">sync</span>
                                    <span>Evaluating...</span>
                                </>
                            ) : (
                                <>
                                    <span>Submit Answer</span>
                                    <span className="material-icons-round text-sm">send</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Right Sidebar */}
            <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 p-4 md:p-8 md:pl-0 flex flex-col gap-6">
                {/* Session Progress */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-900">Session Progress</h3>
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">{progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
                        <div className="bg-primary h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
                    </div>
                    <div className="space-y-4">
                        {questions.map((q, i) => (
                            <div key={i} className={`flex items-start gap-3 ${i > currentIndex ? 'opacity-40' : i < currentIndex ? 'opacity-60' : ''}`}>
                                {i < currentIndex ? (
                                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                        <span className="material-icons-round text-sm">check</span>
                                    </div>
                                ) : i === currentIndex ? (
                                    <div className="w-6 h-6 rounded-full border-2 border-primary bg-gray-50 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                                        {i + 1}
                                    </div>
                                ) : (
                                    <div className="w-6 h-6 rounded-full border border-slate-300 flex items-center justify-center text-slate-400 text-xs font-medium flex-shrink-0">
                                        {i + 1}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className={`text-sm truncate ${i === currentIndex ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                                        {q.topic || q.type || `Q${i + 1}`}
                                    </p>
                                    {i === currentIndex && (
                                        <p className="text-xs text-primary font-medium animate-pulse">In progress...</p>
                                    )}
                                    {i < currentIndex && evaluations[i] && (
                                        <p className={`text-xs font-medium ${evaluations[i].score >= 7 ? 'text-green-500' : evaluations[i].score >= 4 ? 'text-amber-500' : 'text-red-500'}`}>
                                            Score: {evaluations[i].score}/10
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* End Session */}
                <Link to="/" className="w-full py-3 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors font-medium text-sm flex items-center justify-center gap-2">
                    <span className="material-icons-round text-lg">logout</span>
                    End Interview Session
                </Link>
            </aside>
        </div>
    )
}
