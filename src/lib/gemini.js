import { HfInference } from "@huggingface/inference";
import {
    buildAnalyzePrompt,
    buildQuestionsPrompt,
    buildEvaluatePrompt,
    buildReportPrompt,
    humanizeResponse,
} from "../utils/prompts";

// ─── Model fallback chain: conversational first, code-focused last ──────────
const MODELS = [
    "mistralai/Mistral-7B-Instruct-v0.3",
    "HuggingFaceH4/zephyr-7b-beta",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
];

function getClient() {
    const key = import.meta.env.VITE_HF_TOKEN;
    if (!key) throw new Error("VITE_HF_TOKEN is not set in .env.local");
    return new HfInference(key);
}

/**
 * Call HuggingFace model with retry + fallback chain.
 * Tries each model in order, retries up to 2 times per model.
 */
async function callModel(systemPrompt, userPrompt) {
    const client = getClient();
    let lastError = null;

    for (const model of MODELS) {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const response = await Promise.race([
                    client.chatCompletion({
                        model,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt },
                        ],
                        max_tokens: 4096,
                        temperature: 0.8,
                        top_p: 0.9,
                    }),
                    // 30 second timeout
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Request timed out")), 30000)
                    ),
                ]);

                const text = response.choices?.[0]?.message?.content?.trim();
                if (!text) throw new Error("Empty response");

                // Extract JSON from response
                const parsed = extractJSON(text);
                return humanizeResponse(parsed);
            } catch (err) {
                lastError = err;
                console.warn(
                    `Model ${model} attempt ${attempt + 1} failed:`,
                    err.message
                );

                // Wait before retry (exponential backoff: 1s, 2s)
                if (attempt < 1) {
                    await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
                }
            }
        }
        // Model exhausted retries, try next model
        console.warn(`Switching from ${model} to next fallback...`);
    }

    throw new Error(
        `All models failed. Last error: ${lastError?.message || "Unknown error"}. Please try again.`
    );
}

/**
 * Extract JSON from model response — handles fences, extra text, etc.
 */
function extractJSON(text) {
    // Try markdown fenced JSON
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
        try { return JSON.parse(fenced[1].trim()); } catch { }
    }

    // Try direct parse
    try { return JSON.parse(text); } catch { }

    // Try extracting array or object
    const jsonMatch = text.match(/(\[[\s\S]*\])/) || text.match(/(\{[\s\S]*\})/);
    if (jsonMatch) {
        try { return JSON.parse(jsonMatch[1]); } catch { }
    }

    throw new Error("Could not parse response as JSON");
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function analyzeContent(text) {
    const { system, user } = buildAnalyzePrompt(text);
    return callModel(system, user);
}

export async function generateQuestions(content, config) {
    const { system, user } = buildQuestionsPrompt(content, config);
    return callModel(system, user);
}

export async function evaluateAnswer(question, userAnswer, context) {
    const { system, user } = buildEvaluatePrompt(question, userAnswer, context);
    return callModel(system, user);
}

export async function generateReport(sessionData) {
    const { questions, answers, evaluations, settings } = sessionData;

    const qaPairs = questions.map((q, i) => ({
        question: q.question,
        type: q.type,
        difficulty: q.difficulty,
        topic: q.topic,
        userAnswer: answers[i] || "(skipped)",
        score: evaluations[i]?.score ?? 0,
    }));

    const { system, user } = buildReportPrompt(qaPairs, settings, questions.length);
    return callModel(system, user);
}
