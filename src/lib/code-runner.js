/**
 * Sandboxed code execution for interview coding questions.
 * Runs JavaScript in a Web Worker, with timeout protection.
 */

// ─── JavaScript Execution via Web Worker ─────────────────────────────────────

function createWorkerBlob(code, testCases, fnName) {
    const workerCode = `
        // Block dangerous globals
        self.fetch = undefined;
        self.XMLHttpRequest = undefined;
        self.importScripts = undefined;
        self.WebSocket = undefined;

        try {
            // Execute user code to define the function
            ${code}

            // Run test cases
            const results = [];
            const testCases = ${JSON.stringify(testCases)};

            for (const tc of testCases) {
                try {
                    // Parse inputs
                    const args = JSON.parse('[' + tc.input + ']');
                    const expected = JSON.parse(tc.expected);

                    // Call the function
                    const actual = ${fnName}(...args);

                    // Compare
                    const pass = JSON.stringify(actual) === JSON.stringify(expected);
                    results.push({
                        input: tc.input,
                        expected: tc.expected,
                        actual: JSON.stringify(actual),
                        pass,
                        description: tc.description || ''
                    });
                } catch (err) {
                    results.push({
                        input: tc.input,
                        expected: tc.expected,
                        actual: 'Error: ' + err.message,
                        pass: false,
                        description: tc.description || ''
                    });
                }
            }

            self.postMessage({ success: true, results });
        } catch (err) {
            self.postMessage({ success: false, error: err.message });
        }
    `;
    return new Blob([workerCode], { type: "application/javascript" });
}

/**
 * Run JavaScript code against test cases in a sandboxed Web Worker.
 * @param {string} code - User's JavaScript code
 * @param {Array} testCases - [{input, expected, description}]
 * @param {string} fnName - Name of the function to test
 * @param {number} timeout - Max execution time in ms (default 10s)
 * @returns {Promise<{passed, failed, total, results, error}>}
 */
export function runJavaScript(code, testCases, fnName, timeout = 10000) {
    return new Promise((resolve) => {
        const blob = createWorkerBlob(code, testCases, fnName);
        const url = URL.createObjectURL(blob);
        const worker = new Worker(url);

        const timer = setTimeout(() => {
            worker.terminate();
            URL.revokeObjectURL(url);
            resolve({
                passed: 0,
                failed: testCases.length,
                total: testCases.length,
                results: testCases.map((tc) => ({
                    ...tc,
                    actual: "Timeout — code took too long (possible infinite loop)",
                    pass: false,
                })),
                error: "Execution timed out after 10 seconds",
            });
        }, timeout);

        worker.onmessage = (e) => {
            clearTimeout(timer);
            worker.terminate();
            URL.revokeObjectURL(url);

            if (e.data.success) {
                const results = e.data.results;
                const passed = results.filter((r) => r.pass).length;
                resolve({
                    passed,
                    failed: results.length - passed,
                    total: results.length,
                    results,
                    error: null,
                });
            } else {
                resolve({
                    passed: 0,
                    failed: testCases.length,
                    total: testCases.length,
                    results: [],
                    error: e.data.error,
                });
            }
        };

        worker.onerror = (err) => {
            clearTimeout(timer);
            worker.terminate();
            URL.revokeObjectURL(url);
            resolve({
                passed: 0,
                failed: testCases.length,
                total: testCases.length,
                results: [],
                error: err.message || "Worker execution error",
            });
        };
    });
}

// ─── Python Execution via Pyodide (lazy-loaded) ──────────────────────────────

let pyodideInstance = null;

async function loadPyodide() {
    if (pyodideInstance) return pyodideInstance;

    // Load Pyodide from CDN
    if (!window.loadPyodide) {
        const script = document.createElement("script");
        script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
        document.head.appendChild(script);
        await new Promise((resolve, reject) => {
            script.onload = resolve;
            script.onerror = reject;
        });
    }

    pyodideInstance = await window.loadPyodide();
    return pyodideInstance;
}

/**
 * Run Python code against test cases using Pyodide.
 */
export async function runPython(code, testCases, fnName, timeout = 15000) {
    try {
        const pyodide = await Promise.race([
            loadPyodide(),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Pyodide load timeout")), timeout)
            ),
        ]);

        const results = [];

        for (const tc of testCases) {
            try {
                // Run user code + test
                const testScript = `
${code}

import json
_args = json.loads('[${tc.input}]')
_result = ${fnName}(*_args)
json.dumps(_result)
`;
                const actual = pyodide.runPython(testScript);
                const expected = tc.expected.trim();
                const actualClean = actual.trim().replace(/^['"]|['"]$/g, "");
                const expectedClean = expected.replace(/^['"]|['"]$/g, "");

                results.push({
                    input: tc.input,
                    expected: tc.expected,
                    actual: actualClean,
                    pass: actualClean === expectedClean,
                    description: tc.description || "",
                });
            } catch (err) {
                results.push({
                    input: tc.input,
                    expected: tc.expected,
                    actual: `Error: ${err.message}`,
                    pass: false,
                    description: tc.description || "",
                });
            }
        }

        const passed = results.filter((r) => r.pass).length;
        return { passed, failed: results.length - passed, total: results.length, results, error: null };
    } catch (err) {
        return {
            passed: 0,
            failed: testCases.length,
            total: testCases.length,
            results: [],
            error: err.message,
        };
    }
}

// ─── Unified Runner ──────────────────────────────────────────────────────────

/**
 * Run code against test cases (auto-detects language).
 */
export async function runTests(code, language, testCases, fnName) {
    const lang = (language || "javascript").toLowerCase();

    if (lang === "python" || lang === "py") {
        return runPython(code, testCases, fnName);
    }

    // Default to JavaScript
    return runJavaScript(code, testCases, fnName);
}
