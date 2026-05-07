// app/api/upload/route.js
// This is the main ingestion endpoint.
// It receives a file upload, extracts text, chunks it,
// embeds each chunk, and stores the vectors in Pinecone.
// Returns the docId so the client can use it for chat later.

import { NextResponse } from "next/server";
import { extractText } from "@/lib/parser";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embedder";
import { upsertChunks, clearNamespace } from "@/lib/pinecone";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name;
    const mimeType = file.type;

    // convert the file to a buffer for parsing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // generate a stable namespace from the filename + file size
    // this way re-uploading the same file hits the same namespace
    const docId = crypto
      .createHash("md5")
      .update(fileName + buffer.length)
      .digest("hex")
      .slice(0, 12);

    console.log(`Processing: ${fileName} | docId: ${docId}`);

    // step 1 — extract raw text from PDF or TXT
    const rawText = await extractText(buffer, mimeType);

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Couldn't extract enough text from this file. Is it a scanned image PDF?" },
        { status: 422 }
      );
    }

    // step 2 — chunk the text
    const chunks = chunkText(rawText);
    console.log(`Created ${chunks.length} chunks`);

    // step 3 — clear old vectors if this doc was uploaded before
    await clearNamespace(docId);

    // step 4 — generate embeddings for all chunks
    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);

    // step 5 — store everything in Pinecone
    await upsertChunks(docId, chunks, embeddings);

    return NextResponse.json({
      success: true,
      docId,
      fileName,
      chunkCount: chunks.length,
      charCount: rawText.length,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: err.message || "Something went wrong during processing" },
      { status: 500 }
    );
  }
}
