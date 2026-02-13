import { HfInference } from "@huggingface/inference";
import {
    buildAnalyzePrompt,
    buildQuestionsPrompt,
    buildEvaluatePrompt,
    buildReportPrompt,
    buildModeDetectionPrompt,
    buildCodingQuestionsPrompt,
    buildCodeEvalPrompt,
    buildConversationalEvalPrompt,
    buildFollowUpPrompt,
    buildTransitionPrompt,
    buildIntroPrompt,
    buildWrapUpPrompt,
    humanizeResponse,
} from "../utils/prompts";

// ─── Model fallback chain: conversational first, code-focused last ──────────
const MODELS = [
    "mistralai/Mistral-7B-Instruct-v0.3",
    "HuggingFaceH4/zephyr-7b-beta",
    "Qwen/Qwen2.5-Coder-32B-Instruct",
];

// Code-specific chain (Qwen is better for code generation)
const CODE_MODELS = [
    "Qwen/Qwen2.5-Coder-32B-Instruct",
    "mistralai/Mistral-7B-Instruct-v0.3",
];

function getClient() {
    const key = import.meta.env.VITE_HF_TOKEN;
    if (!key) throw new Error("VITE_HF_TOKEN is not set in .env.local");
    return new HfInference(key);
}

/**
 * Call HuggingFace model with retry + fallback chain.
 */
async function callModel(systemPrompt, userPrompt, modelChain = MODELS) {
    const client = getClient();
    let lastError = null;

    for (const model of modelChain) {
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
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error("Request timed out")), 30000)
                    ),
                ]);

                const text = response.choices?.[0]?.message?.content?.trim();
                if (!text) throw new Error("Empty response");

                const parsed = extractJSON(text);
                return humanizeResponse(parsed);
            } catch (err) {
                lastError = err;
                console.warn(`Model ${model} attempt ${attempt + 1} failed:`, err.message);
                if (attempt < 1) {
                    await new Promise((r) => setTimeout(r, (attempt + 1) * 1000));
                }
            }
        }
        console.warn(`Switching from ${model} to next fallback...`);
    }

    throw new Error(
        `All models failed. Last error: ${lastError?.message || "Unknown error"}. Please try again.`
    );
}

/**
 * Extract JSON from model response.
 */
function extractJSON(text) {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) {
        try { return JSON.parse(fenced[1].trim()); } catch { }
    }
    try { return JSON.parse(text); } catch { }
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

// ─── Coding Mode Functions ───────────────────────────────────────────────────

export async function detectModes(text) {
    const { system, user } = buildModeDetectionPrompt(text);
    return callModel(system, user);
}

export async function generateCodingQuestions(content, config) {
    const { system, user } = buildCodingQuestionsPrompt(content, config);
    return callModel(system, user, CODE_MODELS);
}

export async function evaluateCode(question, code, testResults, language) {
    const { system, user } = buildCodeEvalPrompt(question, code, testResults, language);
    return callModel(system, user, CODE_MODELS);
}

// ─── Conversational Interview Functions ──────────────────────────────────────

export async function respondToAnswer(question, answer, history, context) {
    const { system, user } = buildConversationalEvalPrompt(question, answer, history, context);
    return callModel(system, user);
}

export async function generateFollowUp(question, answer, previousFollowUps) {
    const { system, user } = buildFollowUpPrompt(question, answer, previousFollowUps);
    return callModel(system, user);
}

export async function generateTransition(fromPhase, toPhase, performance) {
    const { system, user } = buildTransitionPrompt(fromPhase, toPhase, performance);
    return callModel(system, user);
}

export async function generateIntro(topics, difficulty, questionCount) {
    const { system, user } = buildIntroPrompt(topics, difficulty, questionCount);
    return callModel(system, user);
}

export async function generateWrapUp(scores, topics) {
    const { system, user } = buildWrapUpPrompt(scores, topics);
    return callModel(system, user);
}
