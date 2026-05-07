// parser.js
// Extracts plain text from uploaded files.
// Supports PDF (via pdf-parse) and plain text (.txt).
// Returns a single string of the document's content.

import pdfParse from "pdf-parse";

/**
 * Extract text from a file buffer.
 *
 * @param {Buffer} buffer - The raw file buffer
 * @param {string} mimeType - The file's MIME type
 * @returns {Promise<string>} - Extracted plain text
 */
export async function extractText(buffer, mimeType) {
  if (mimeType === "application/pdf" || mimeType === "pdf") {
    // pdf-parse does the heavy lifting here
    const data = await pdfParse(buffer);
    return data.text;
  }

  // plain text files — just decode the buffer
  if (mimeType === "text/plain" || mimeType === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType}. Please upload a PDF or .txt file.`);
}
