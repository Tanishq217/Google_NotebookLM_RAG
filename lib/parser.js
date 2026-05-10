import pdfParse from "pdf-parse/lib/pdf-parse.js";

export async function extractText(buffer, mimeType) {
  if (mimeType === "application/pdf" || mimeType === "pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (mimeType === "text/plain" || mimeType === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
