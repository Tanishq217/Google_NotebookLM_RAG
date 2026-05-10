// splits a long string into overlapping fixed-size pieces
// overlap helps when a key sentence lands right at a boundary

const CHUNK_SIZE = 500;
const OVERLAP = 50;

export function chunkText(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    const end = Math.min(start + CHUNK_SIZE, cleaned.length);
    const piece = cleaned.slice(start, end);

    if (piece.trim().length > 20) {
      chunks.push({ text: piece, index: chunks.length });
    }

    start += CHUNK_SIZE - OVERLAP;
  }

  return chunks;
}
