import { HfInference } from "@huggingface/inference";

// Qwen2.5-Coder-32B is excellent for structured JSON output and instruction following
const MODEL = "Qwen/Qwen2.5-Coder-32B-Instruct";

function getClient() {
    const key = import.meta.env.VITE_HF_TOKEN;
    if (!key) throw new Error("VITE_HF_TOKEN is not set in .env.local");
    return new HfInference(key);
}

/**
 * Call HuggingFace model and parse JSON response.
 */
async function callModel(systemPrompt, userPrompt) {
    const client = getClient();

    const response = await client.chatCompletion({
        model: MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0.7,
    });

    const text = response.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response from model");

    // Extract JSON from response — handle markdown fences and extra text
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\])/) || text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text;

    try {
        return JSON.parse(jsonStr);
    } catch {
        // Last resort: try to find any JSON-like structure
        const fallback = text.match(/[\[{][\s\S]*[\]}]/);
        if (fallback) return JSON.parse(fallback[0]);
        throw new Error("Failed to parse model response as JSON");
    }
}

/**
 * Analyze PDF content — identify topics, themes, difficulty level.
 */
export async function analyzeContent(text) {
    const systemPrompt = `You are an expert content analyst. You MUST respond with ONLY valid JSON, no extra text.`;

    const userPrompt = `Analyze the following document and return a JSON object with these exact keys:
- "topics": array of main topics (strings)
- "themes": array of overarching themes (strings)
- "difficulty": overall difficulty ("easy" | "medium" | "hard")
- "keyTerms": array of important technical terms (strings)
- "summary": a 2-3 sentence summary

Document:
"""
${text.slice(0, 8000)}
"""

Respond with ONLY the JSON object, nothing else.`;

    return callModel(systemPrompt, userPrompt);
}

/**
 * Generate interview questions based on content and configuration.
 */
export async function generateQuestions(content, config) {
    const {
        difficulty = "mixed",
        count = 5,
        types = ["mcq", "open-ended"],
        persona = "quiz-master",
    } = config || {};

    const personaDescriptions = {
        "quiz-master": "a precise quiz master who asks clear, focused questions",
        academic: "a strict academic professor focused on theoretical knowledge",
        hr: "a professional HR recruiter focused on behavioral and soft skills",
        peer: "a friendly peer with a casual, collaborative approach",
    };

    const personaDesc = personaDescriptions[persona] || personaDescriptions["quiz-master"];

    const systemPrompt = `You are ${personaDesc}. You ask questions in simple, easy-to-understand language — like how a real interviewer would casually ask in conversation. Avoid overly formal or textbook-style wording. You MUST respond with ONLY a valid JSON array, no extra text.`;

    const userPrompt = `Based on this content, generate exactly ${count} interview questions.

IMPORTANT RULES:
- Use simple, everyday language. Instead of "Explain the significance of semantic HTML elements in modern web development", say "What are semantic HTML tags and why do we use them?"
- Questions should feel like a friendly interviewer asking them out loud
- Avoid jargon-heavy or overly academic phrasing
- Keep questions focused and clear — one concept per question
- Difficulty: ${difficulty}
- Question types: ${types.join(", ")}

Return a JSON array where each element has:
- "id": sequential number starting from 1
- "type": "mcq" | "open-ended" | "scenario"
- "question": the question text (simple, conversational language)
- "options": array of 4 strings (ONLY for MCQ, null for others)
- "correctAnswer": the correct answer text
- "difficulty": "easy" | "medium" | "hard"
- "topic": which topic this relates to
- "points": suggested points (easy=5, medium=10, hard=15)

Content:
"""
${content.slice(0, 6000)}
"""

Respond with ONLY the JSON array.`;

    return callModel(systemPrompt, userPrompt);
}

/**
 * Evaluate a user's answer to an interview question.
 */
export async function evaluateAnswer(question, userAnswer, context) {
    const systemPrompt = `You are a chill, friendly interviewer giving feedback after a practice round. Talk like a real person — not a grading rubric. You MUST respond with ONLY valid JSON.`;

    const userPrompt = `Question: "${question}"
Candidate said: "${userAnswer}"
${context ? `Topic context: "${context.slice(0, 2000)}"` : ""}

RULES:
- The answer can come from ANY source, not just the PDF. If it's correct, it's correct.
- Be generous with scoring. If they got the main idea right, that's a 7+.
- Only dock points for genuinely wrong or missing critical info.

Return JSON with these keys. I'm showing you GOOD vs BAD examples for each:

"score": 0-10

"feedback": (2-3 sentences, talk like a human)
  GOOD: "Yeah you've got the right idea! You know that dictionaries use key-value pairs and you showed how to access them. Just try to include a quick code example next time — it really helps show you can actually write it, not just explain it."
  BAD: "The candidate demonstrates understanding of dictionary concepts. However, the explanation lacks clarity and precision in terminology usage."

"modelAnswer": (how a real person would answer this in an interview — casual but correct, 2-4 sentences)
  GOOD: "I'd just create a dictionary like student = {101: 'Alice', 102: 'Bob'} where roll numbers are keys and names are values. To get a name, I'd do student[101] which gives me 'Alice'. Pretty simple — dictionaries are perfect for this kind of lookup."
  BAD: "To accomplish this task, one would utilize a Python dictionary data structure where the keys represent roll numbers and the values represent student names. The dictionary can be defined as follows..."

"strengths": array of 2-3 items
  GOOD: ["Knows what dictionaries are for", "Right approach to the problem"]
  BAD: ["Demonstrates understanding of dictionary data structures", "Recognizes the utility of key-value mapping"]

"improvements": array of 2-3 items
  GOOD: ["Show a quick code snippet like student = {1: 'John'}", "Use the term 'key-value pair' — interviewers love hearing that"]
  BAD: ["Employ precise technical terminology", "Structure explanation with clear syntax examples"]

"keywordsFound": technical terms they used
"keywordsMissed": technical terms they should've mentioned

Respond with ONLY the JSON.`;

    return callModel(systemPrompt, userPrompt);
}

/**
 * Generate a comprehensive performance report.
 */
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

    const systemPrompt = `You are a seasoned interview coach who has helped hundreds of candidates land top jobs. You write reports that feel personal and actionable — not generic corporate summaries. You MUST respond with ONLY valid JSON, no extra text.`;

    const userPrompt = `Review this interview session and write a performance report that feels like personal coaching feedback.

Session Info: ${settings?.difficulty || "mixed"} difficulty, ${questions.length} questions

Performance Data:
${JSON.stringify(qaPairs, null, 2)}

Return a JSON object with:
- "overallScore": number 0-100 (be realistic — 60-75 is average, 80+ is strong)
- "grade": letter grade (A+, A, B+, B, C+, C, D, F)
- "executiveSummary": 3-4 sentences written like a coach wrapping up a session. Be specific about what went well and what needs work. Example tone: "You showed solid foundational knowledge, especially in X. Where things got tricky was Y — but that's very fixable with some focused practice."
- "strengths": array of 3-5 specific strengths, written as natural observations (e.g., "Strong ability to break down complex problems step by step" not "Demonstrated problem decomposition skills")
- "weaknesses": array of 2-4 growth areas, framed constructively (e.g., "Could go deeper on edge cases and error handling" not "Lacks understanding of error handling")
- "recommendations": array of 3-5 concrete study tips (e.g., "Practice building small projects that use X — hands-on experience will really solidify these concepts" not "Study X more")
- "topicBreakdown": array of { "topic": string, "score": number 0-100, "questionsCount": number }
- "matchLevel": "Excellent Match" | "Good Match" | "Fair Match" | "Needs Improvement"

Respond with ONLY the JSON object.`;

    return callModel(systemPrompt, userPrompt);
}
