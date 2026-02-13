import { useState, useCallback, lazy, Suspense } from 'react'
import { runTests } from '../lib/code-runner'

const Editor = lazy(() => import('@monaco-editor/react'))

const LANGUAGE_MAP = {
    javascript: { label: 'JavaScript', monacoId: 'javascript' },
    python: { label: 'Python', monacoId: 'python' },
    java: { label: 'Java', monacoId: 'java' },
    cpp: { label: 'C++', monacoId: 'cpp' },
}

export default function CodeEditor({
    question,
    starterCode = '',
    language = 'javascript',
    testCases = [],
    functionName = 'solution',
    hints = [],
    onSubmit,
    disabled = false,
}) {
    const [code, setCode] = useState(starterCode)
    const [selectedLang, setSelectedLang] = useState(language)
    const [testResults, setTestResults] = useState(null)
    const [running, setRunning] = useState(false)
    const [showHints, setShowHints] = useState(false)
    const [activeHint, setActiveHint] = useState(0)
    const [consoleOutput, setConsoleOutput] = useState('')

    const handleRun = useCallback(async () => {
        setRunning(true)
        setConsoleOutput('Running tests...')
        setTestResults(null)

        try {
            const results = await runTests(code, selectedLang, testCases, functionName)
            setTestResults(results)
            setConsoleOutput(
                results.error
                    ? `❌ Error: ${results.error}`
                    : `✅ ${results.passed}/${results.total} tests passed`
            )
        } catch (err) {
            setConsoleOutput(`❌ Error: ${err.message}`)
            setTestResults({ passed: 0, failed: testCases.length, total: testCases.length, results: [], error: err.message })
        } finally {
            setRunning(false)
        }
    }, [code, selectedLang, testCases, functionName])

    const handleSubmit = useCallback(() => {
        if (onSubmit) {
            onSubmit(code, testResults, selectedLang)
        }
    }, [code, testResults, selectedLang, onSubmit])

    return (
        <div className="flex flex-col gap-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between bg-slate-800 rounded-t-xl px-4 py-2">
                <div className="flex items-center gap-3">
                    <span className="material-icons-round text-primary text-lg">code</span>
                    <span className="text-white text-sm font-semibold">Code Editor</span>
                    <select
                        value={selectedLang}
                        onChange={(e) => setSelectedLang(e.target.value)}
                        className="bg-slate-700 text-slate-200 text-xs px-2 py-1 rounded border border-slate-600 focus:border-primary outline-none"
                    >
                        {Object.entries(LANGUAGE_MAP).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-2">
                    {hints.length > 0 && (
                        <button
                            onClick={() => setShowHints(!showHints)}
                            className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-700 transition-colors"
                        >
                            <span className="material-icons-round text-sm">lightbulb</span>
                            Hints
                        </button>
                    )}
                    <button
                        onClick={handleRun}
                        disabled={running || disabled}
                        className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-600 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
                    >
                        <span className="material-icons-round text-sm">
                            {running ? 'hourglass_empty' : 'play_arrow'}
                        </span>
                        {running ? 'Running...' : 'Run Code'}
                    </button>
                </div>
            </div>

            {/* Hints Panel */}
            {showHints && hints.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 -mt-2">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-amber-700">
                            💡 Hint {activeHint + 1} of {hints.length}
                        </span>
                        <div className="flex gap-1">
                            {hints.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => setActiveHint(i)}
                                    className={`w-5 h-5 rounded-full text-[10px] font-bold ${i === activeHint
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-amber-200 text-amber-700'
                                        }`}
                                >{i + 1}</button>
                            ))}
                        </div>
                    </div>
                    <p className="text-sm text-amber-800">{hints[activeHint]}</p>
                </div>
            )}

            {/* Monaco Editor */}
            <div className="border border-slate-200 rounded-lg overflow-hidden" style={{ height: '320px' }}>
                <Suspense fallback={
                    <div className="h-full flex items-center justify-center bg-slate-900 text-slate-400">
                        <span className="material-icons-round animate-spin mr-2">refresh</span>
                        Loading editor...
                    </div>
                }>
                    <Editor
                        height="320px"
                        language={LANGUAGE_MAP[selectedLang]?.monacoId || 'javascript'}
                        theme="vs-dark"
                        value={code}
                        onChange={(val) => setCode(val || '')}
                        options={{
                            fontSize: 14,
                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                            minimap: { enabled: false },
                            scrollBeyondLastLine: false,
                            lineNumbers: 'on',
                            roundedSelection: true,
                            padding: { top: 12 },
                            tabSize: 2,
                            automaticLayout: true,
                            wordWrap: 'on',
                            readOnly: disabled,
                        }}
                    />
                </Suspense>
            </div>

            {/* Console Output */}
            <div className="bg-slate-900 rounded-lg p-3 border border-slate-700">
                <div className="flex items-center gap-2 mb-2">
                    <span className="material-icons-round text-slate-500 text-sm">terminal</span>
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Output</span>
                </div>
                <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap min-h-[40px]">
                    {consoleOutput || 'Click "Run Code" to execute...'}
                </pre>
            </div>

            {/* Test Results */}
            {testResults && testResults.results?.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="font-semibold text-sm text-slate-700">Test Cases</span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${testResults.passed === testResults.total
                            ? 'bg-emerald-100 text-emerald-700'
                            : testResults.passed > 0
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                            {testResults.passed}/{testResults.total} Passed
                        </span>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {testResults.results.map((r, i) => (
                            <div key={i} className={`px-4 py-3 flex items-start gap-3 ${r.pass ? 'bg-emerald-50/30' : 'bg-red-50/30'}`}>
                                <span className={`material-icons-round text-lg mt-0.5 ${r.pass ? 'text-emerald-500' : 'text-red-500'}`}>
                                    {r.pass ? 'check_circle' : 'cancel'}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-500 mb-1">
                                        {r.description || `Test ${i + 1}`}
                                    </p>
                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                        <div>
                                            <span className="text-slate-400 block">Input</span>
                                            <code className="text-slate-700 font-mono">{r.input}</code>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block">Expected</span>
                                            <code className="text-emerald-700 font-mono">{r.expected}</code>
                                        </div>
                                        <div>
                                            <span className="text-slate-400 block">Got</span>
                                            <code className={`font-mono ${r.pass ? 'text-emerald-700' : 'text-red-600'}`}>{r.actual}</code>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Submit Button */}
            <button
                onClick={handleSubmit}
                disabled={disabled || !testResults}
                className="w-full py-3 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:shadow-none"
            >
                <span className="material-icons-round">send</span>
                Submit Solution
            </button>
        </div>
    )
}
