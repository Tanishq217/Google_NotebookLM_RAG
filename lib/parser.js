import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { Buffer } from "buffer";

export async function extractText(buffer, mimeType) {
  const blob = new Blob([buffer], { type: mimeType });
  let docs = [];

  if (mimeType === "application/pdf" || mimeType === "pdf") {
    const loader = new PDFLoader(blob);
    docs = await loader.load();
    return docs.map((d) => d.pageContent).join("\n\n");
  }

  if (mimeType === "text/csv" || mimeType === "csv") {
    const loader = new CSVLoader(blob);
    docs = await loader.load();
    return docs.map((d) => d.pageContent).join("\n\n");
  }

  if (mimeType === "text/plain" || mimeType === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}
