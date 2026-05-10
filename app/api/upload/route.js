import { NextResponse } from "next/server";
import { extractText } from "@/lib/parser";
import { chunkText } from "@/lib/chunker";
import { embedTexts } from "@/lib/embedder";
import { upsertChunks, clearNamespace } from "@/lib/pinecone";
import crypto from "crypto";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name;
    const mimeType = file.type;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // stable namespace based on file identity — re-uploading same file hits same namespace
    const docId = crypto
      .createHash("md5")
      .update(fileName + buffer.length)
      .digest("hex")
      .slice(0, 12);

    console.log(`Processing: ${fileName} | docId: ${docId}`);

    const rawText = await extractText(buffer, mimeType);
    console.log(`Extracted text length: ${rawText?.length}`);

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        { error: "Couldn't extract enough text. Is this a scanned image PDF?" },
        { status: 422 }
      );
    }

    const chunks = chunkText(rawText);
    console.log(`Got ${chunks.length} chunks`);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Document couldn't be split into chunks. Try a different file." },
        { status: 422 }
      );
    }

    // wipe old data for this doc before re-indexing
    await clearNamespace(docId);

    const chunkTexts = chunks.map((c) => c.text);
    const embeddings = await embedTexts(chunkTexts);
    const validCount = embeddings.filter((e) => e && e.length > 0).length;
    console.log(`Embeddings: ${embeddings.length} total, ${validCount} valid (dim: ${embeddings[0]?.length})`);

    if (validCount === 0) {
      return NextResponse.json(
        { error: "Embedding failed — got no vectors back. Check your GEMINI_API_KEY." },
        { status: 500 }
      );
    }

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
