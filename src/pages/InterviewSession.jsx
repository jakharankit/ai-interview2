import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useInterview } from '../context/InterviewContext'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import { useSpeechSynthesis } from '../hooks/useSpeechSynthesis'
import { evaluateCode } from '../lib/gemini'
import { evaluateAndDecide, getIntro, getWrapUp, getSkipResponse } from '../lib/conversation'
import AIOrb from '../components/AIOrb'
import CodeEditor from '../components/CodeEditor'

/* ─── Helpers ─── */
function toSnakeCase(name) {
    return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}
function getStarterCode(fnName, lang) {
    const sn = toSnakeCase(fnName)
    const l = (lang || 'python').toLowerCase()
    if (l === 'python' || l === 'py') return `def ${sn}(data):\n    # Write your solution here\n    pass\n`
    if (l === 'java') return `public static Object ${fnName}(Object data) {\n    // Write your solution here\n    return null;\n}\n`
    return `function ${fnName}(data) {\n  // Write your solution here\n}\n`
}

/* ─── Components ─── */
const SidebarNav = ({ active }) => (
    <aside className="w-64 bg-card-light dark:bg-card-dark border-r border-slate-200 dark:border-slate-800 flex flex-col h-full flex-shrink-0 z-20 hidden md:flex">
        <div className="p-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                <span className="material-icons">psychology</span>
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">TalentAI</span>
        </div>
        <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto">
            {[
                { name: 'Dashboard', icon: 'dashboard', to: '/' },
                { name: 'Active Session', icon: 'video_camera_front', to: '#', active: true },
                { name: 'History', icon: 'history', to: '/results' },
                { name: 'Reports', icon: 'analytics', to: '#' },
                { name: 'Documents', icon: 'folder_open', to: '#' },
            ].map(item => (
                <Link key={item.name} to={item.to} className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors group ${item.active
                        ? 'bg-primary/10 text-primary-dark dark:text-primary'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}>
                    <span className={`material-icons text-[20px] ${item.active ? 'text-primary' : 'group-hover:text-primary transition-colors'}`}>
                        {item.icon}
                    </span>
                    <span className={`text-sm ${item.active ? 'font-semibold' : 'font-medium'}`}>{item.name}</span>
                </Link>
            ))}
        </nav>
        <div className="p-4 mt-auto border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                    <span className="material-icons text-sm">person</span>
                </div>
                <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">Alex Morgan</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">Candidate</span>
                </div>
            </div>
        </div>
    </aside>
)

const ProgressSidebar = ({ progress, currentPhase, timeCheck, feedback, onEndSession }) => (
    <aside className="w-full md:w-80 lg:w-96 flex-shrink-0 p-4 md:p-8 md:pl-0 flex flex-col gap-6 z-20 relative hidden lg:flex">
        <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 class="font-semibold text-slate-900 dark:text-white">Session Progress</h3>
                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">{progress}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mb-6 overflow-hidden">
                <div className="bg-primary h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="space-y-4">
                {/* Steps */}
                <div className="flex items-start gap-3 opacity-50">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-dark text-xs font-bold flex-shrink-0">
                        <span className="material-icons text-sm">check</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Introduction</p>
                        <p className="text-xs text-slate-500">Completed</p>
                    </div>
                </div>
                <div className="flex items-start gap-3 relative">
                    <div className="absolute left-3 top-6 bottom-[-24px] w-px bg-slate-200 dark:bg-slate-700"></div>
                    <div className="w-6 h-6 rounded-full border-2 border-primary bg-background-light dark:bg-background-dark flex items-center justify-center text-primary text-xs font-bold flex-shrink-0 z-10">
                        {progress > 10 ? '2' : '1'}
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{currentPhase}</p>
                        <p className="text-xs text-primary font-medium animate-pulse">In progress...</p>
                    </div>
                </div>
            </div>
        </div>

        {/* Live Feedback */}
        <div className="bg-card-light dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-white">Live Feedback</h3>
                <span className="material-icons text-primary text-lg">info</span>
            </div>
            {feedback && (
                <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-4">
                    <div className="flex gap-2 items-start">
                        <span className="material-icons text-primary text-sm mt-0.5">lightbulb</span>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug">{feedback}</p>
                    </div>
                </div>
            )}
            <div className="mt-auto pt-6 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Speaking Time</span>
                    <span className="text-slate-900 dark:text-white font-mono">{timeCheck}</span>
                </div>
            </div>
        </div>

        <button onClick={onEndSession} className="w-full py-3 rounded-lg border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors font-medium text-sm flex items-center justify-center gap-2 mt-auto">
            <span className="material-icons text-lg">logout</span>
            End Interview Session
        </button>
    </aside>
)

/* ─── Main Component ─── */
export default function InterviewSession() {
    const {
        state, submitAnswer, setEvaluation, nextQuestion, setCode, setTestResults,
        addMessage, setAIState, setPhase, incrementFollowUp, resetFollowUp
    } = useInterview()
    const navigate = useNavigate()
    const { questions, currentIndex, evaluations, settings, conversationHistory, followUpCount, aiState } = state

    // State
    const [phase, setFlowPhase] = useState('intro') // intro, asking, evaluating, responding, done
    const [aiText, setAiText] = useState('')
    const [inputText, setInputText] = useState('')
    const [currentFollowUp, setCurrentFollowUp] = useState(null)
    const [showCodeEditor, setShowCodeEditor] = useState(false)
    const [typingMode, setTypingMode] = useState(false)
    const hasStarted = useRef(false)

    // Tools
    const speech = useSpeechRecognition()
    const synth = useSpeechSynthesis()

    const currentQuestion = questions[currentIndex]
    const progress = questions.length > 0 ? Math.round(((currentIndex) / questions.length) * 100) : 0
    const isLastQuestion = currentIndex === questions.length - 1

    // Typewriter
    const useTypewriter = (text, speed = 25) => {
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
    const { displayed: typedText, done: typingDone } = useTypewriter(aiText, 25)

    // ─── Sync Logic ───
    useEffect(() => { if (questions.length === 0) navigate('/configure') }, [questions, navigate])
    useEffect(() => {
        if (synth.isSpeaking) setAIState('speaking')
        else if (aiState === 'speaking') setAIState('idle')
    }, [synth.isSpeaking])

    // ─── Start Session ───
    useEffect(() => {
        if (hasStarted.current || questions.length === 0) return
        hasStarted.current = true
            ; (async () => {
                setAIState('thinking')
                const topics = questions.map(q => q.topic).filter(Boolean)
                const intro = await getIntro(topics, settings?.difficulty, questions.length)
                addMessage('ai', intro)
                setAiText(intro)
                setAIState('speaking')
                setFlowPhase('intro')
                synth.speak(intro)
            })()
    }, [questions])

    // ─── Flow Control ───
    useEffect(() => {
        if (phase === 'intro' && typingDone && aiText) {
            const t = setTimeout(() => deliverQuestion(0), 1000)
            return () => clearTimeout(t)
        }
    }, [phase, typingDone, aiText])

    const deliverQuestion = useCallback((index) => {
        const q = questions[index]
        if (!q) return

        if (q.mode === 'coding') {
            const msg = "Time for a coding challenge."
            setAiText(msg)
            setAIState('speaking')
            setShowCodeEditor(true)
            setFlowPhase('asking')
            synth.speak(msg)
            return
        }

        setShowCodeEditor(false)
        addMessage('ai', q.question)
        setAiText(q.question)
        setAIState('speaking')
        setFlowPhase('asking')
        setCurrentFollowUp(null)
        synth.speak(q.question)
    }, [questions])

    const handleSubmit = useCallback(async () => {
        if (phase !== 'asking') return
        const answer = speech.isListening ? speech.transcript : inputText
        if (!answer?.trim()) return

        if (speech.isListening) speech.stop()
        synth.stop()
        setFlowPhase('evaluating')
        setAIState('thinking')
        addMessage('user', answer)
        submitAnswer(currentIndex, answer)
        setInputText('')

        const activeQ = currentFollowUp || currentQuestion?.question || ''
        const result = await evaluateAndDecide(activeQ, answer, conversationHistory, '', followUpCount, isLastQuestion && !currentFollowUp)

        setEvaluation(currentIndex, { score: result.score, feedback: result.response, strengths: [], improvements: [], modelAnswer: '' })
        setFlowPhase('responding')

        if (result.action === 'follow_up' && result.followUpQuestion) {
            incrementFollowUp()
            const txt = `${result.response}\n\n${result.followUpQuestion}`
            addMessage('ai', txt)
            setAiText(txt)
            setCurrentFollowUp(result.followUpQuestion)
            synth.speak(txt)
            setAIState('speaking')
            setTimeout(() => setFlowPhase('asking'), txt.length * 30 + 1000)
        } else {
            addMessage('ai', result.response)
            setAiText(result.response)
            synth.speak(result.response)
            setAIState('speaking')
            resetFollowUp()
            setCurrentFollowUp(null)

            if (!isLastQuestion) {
                setTimeout(() => {
                    nextQuestion()
                    deliverQuestion(currentIndex + 1)
                }, result.response.length * 30 + 1500)
            } else {
                setTimeout(async () => {
                    setAIState('thinking')
                    const wrapUp = await getWrapUp([8], []) // dummy scores for now
                    setAiText(wrapUp)
                    synth.speak(wrapUp)
                    setFlowPhase('done')
                    setTimeout(() => navigate('/results'), 5000)
                }, 2000)
            }
        }
    }, [phase, inputText, speech.transcript, currentIndex, currentQuestion, isLastQuestion])

    const handleSkip = useCallback(() => {
        // Logic for skipping
        if (!isLastQuestion) {
            nextQuestion()
            deliverQuestion(currentIndex + 1)
        }
    }, [currentIndex, isLastQuestion])

    // Code Submit
    const handleCodeSubmit = async (code, results, lang) => {
        // simplified for brevity
        handleSubmit()
    }

    if (!currentQuestion) return null

    return (
        <div className="bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-100 h-screen overflow-hidden flex font-display transition-colors duration-200">
            <SidebarNav active="Active Session" />

            <main className="flex-1 flex flex-col md:flex-row h-full overflow-hidden relative">
                <div className="flex-1 flex flex-col h-full relative p-4 md:p-8 lg:pr-4">
                    {/* Top Header */}
                    <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-20 relative">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Technical Interview</h1>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Session ID: #8823-TX • {settings?.difficulty || 'General'}</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                <button onClick={() => setShowCodeEditor(true)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${showCodeEditor ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                                    <span className="material-icons text-base">code</span> Coding Mode
                                </button>
                                <button onClick={() => setShowCodeEditor(false)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${!showCodeEditor ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}>
                                    <span className="material-icons text-base">record_voice_over</span> Theoretical
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className="z-20 relative bg-card-light dark:bg-card-dark rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 p-6 md:p-8 mb-4 overflow-hidden group max-w-4xl mx-auto w-full">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-primary"></div>
                        <div className="flex gap-4 items-start">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex-shrink-0 flex items-center justify-center text-primary mt-1">
                                <span className="material-icons">smart_toy</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Question {currentIndex + 1} of {questions.length}</span>
                                    <span className="text-xs text-slate-400">•</span>
                                    <span className="text-xs text-slate-400">{currentQuestion.topic}</span>
                                </div>
                                <h2 className="text-xl md:text-2xl font-semibold text-slate-800 dark:text-slate-100 leading-relaxed min-h-[60px]">
                                    {phase === 'intro' ? typedText : (aiText || currentQuestion.question)}
                                </h2>
                            </div>
                        </div>
                    </div>

                    {/* Dynamic Center Area */}
                    <div className="flex-1 relative rounded-2xl bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-900/50 overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
                        {showCodeEditor ? (
                            <CodeEditor
                                question={currentQuestion.question}
                                starterCode={currentQuestion.starterCode}
                                language="python"
                                onSubmit={handleCodeSubmit}
                            />
                        ) : typingMode ? (
                            <div className="w-full h-full p-4 flex flex-col">
                                <textarea
                                    className="flex-1 w-full p-6 bg-card-light dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 resize-none focus:ring-primary focus:border-primary transition-all"
                                    placeholder="Type your answer here..."
                                    value={inputText}
                                    onChange={e => setInputText(e.target.value)}
                                />
                                <div className="flex justify-end mt-4">
                                    <button onClick={handleSubmit} className="bg-primary hover:bg-primary-hover text-white px-6 py-2 rounded-lg font-medium transition-colors">Submit Answer</button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="voice-container w-full h-full absolute inset-0 z-0">
                                    <div className="wave-layer"></div>
                                    <div className="wave-layer"></div>
                                    <div className="wave-layer"></div>
                                    <div className="core-pulse"></div>
                                </div>
                                <div className="z-10 flex flex-col items-center gap-8 mt-auto mb-16">
                                    <div className="text-center space-y-2 bg-white/50 dark:bg-black/20 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/20 dark:border-white/5">
                                        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">
                                            {phase === 'evaluating' ? 'Thinking...' : phase === 'responding' ? 'Speaking...' : 'Listening...'}
                                        </p>
                                        <p className="text-sm text-slate-500 dark:text-slate-400">{speech.transcript || "Speak naturally, take your time."}</p>
                                    </div>
                                    <button
                                        onClick={() => speech.isListening ? speech.stop() : speech.start()}
                                        className={`w-20 h-20 rounded-full flex items-center justify-center transition-all group shadow-xl z-20 cursor-pointer ${speech.isListening ? 'bg-red-500 hover:bg-red-600 mic-button-active' : 'bg-primary hover:bg-primary-hover'}`}
                                    >
                                        <span className="material-icons text-4xl text-white">{speech.isListening ? 'stop' : 'mic'}</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Bottom Controls */}
                    <div className="flex justify-between items-center z-20 relative mt-4">
                        <button onClick={handleSkip} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            <span className="material-icons text-lg">skip_next</span> Skip for now
                        </button>
                        {!showCodeEditor && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setTypingMode(!typingMode)}
                                    className="px-6 py-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors bg-white dark:bg-card-dark"
                                >
                                    {typingMode ? 'Switch to Voice' : 'Type Answer Instead'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <ProgressSidebar
                    progress={progress}
                    currentPhase={currentQuestion.topic}
                    timeCheck="00:42"
                    feedback={evaluations[currentIndex]?.feedback}
                    onEndSession={() => navigate('/results')}
                />
            </main>
        </div>
    )
}
