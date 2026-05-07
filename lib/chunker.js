// chunker.js
// Handles splitting a big document into smaller, overlapping pieces.
// I went with fixed-size chunking since it's simple, predictable, and
// works well for most document types. The overlap helps avoid losing
// context at chunk boundaries (e.g., a sentence split across two chunks).

const CHUNK_SIZE = 500;   // characters per chunk
const OVERLAP = 50;        // characters shared between consecutive chunks

/**
 * Splits a long string into overlapping fixed-size chunks.
 *
 * @param {string} text - The full document text
 * @returns {Array<{ text: string, index: number }>} - Array of chunk objects
 */
export function chunkText(text) {
  // clean up extra whitespace first — PDFs often have weird spacing
  const cleaned = text.replace(/\s+/g, " ").trim();

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    const chunkText = cleaned.slice(start, end);

    // skip tiny leftover chunks that wouldn't carry meaningful info
    if (chunkText.trim().length > 20) {
      chunks.push({
        text: chunkText,
        index: chunks.length,
      });
    }

    // move forward by chunk size minus overlap
    start += CHUNK_SIZE - OVERLAP;
  }

  return chunks;
}
