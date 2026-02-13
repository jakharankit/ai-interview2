import * as pdfjsLib from "pdfjs-dist";

// Use the bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
).toString();

/**
 * Extract text from all pages of a PDF file.
 * @param {File} file - The PDF File object from an input or drop event.
 * @returns {Promise<{text: string, metadata: object, chunks: string[]}>}
 */
export async function parsePDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Extract text from every page
    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item) => item.str).join(" ");
        pageTexts.push(pageText);
    }

    const fullText = pageTexts.join("\n\n");

    // Metadata
    const info = await pdf.getMetadata().catch(() => ({}));
    const metadata = {
        title: info?.info?.Title || file.name.replace(/\.pdf$/i, ""),
        author: info?.info?.Author || "Unknown",
        pageCount: pdf.numPages,
        fileName: file.name,
        fileSize: file.size,
    };

    // Chunk the text for LLM processing (~2000 tokens ≈ ~8000 chars)
    const chunks = chunkContent(fullText, 8000);

    return { text: fullText, metadata, chunks };
}

/**
 * Split text into chunks at paragraph boundaries.
 */
function chunkContent(text, maxChars = 8000) {
    if (text.length <= maxChars) return [text];

    const chunks = [];
    const paragraphs = text.split(/\n\s*\n/);
    let current = "";

    for (const para of paragraphs) {
        if (current.length + para.length + 2 > maxChars && current.length > 0) {
            chunks.push(current.trim());
            current = "";
        }
        current += para + "\n\n";
    }

    if (current.trim()) {
        chunks.push(current.trim());
    }

    return chunks.length > 0 ? chunks : [text.slice(0, maxChars)];
}
