// app/api/chat/route.js
// The retrieval + generation endpoint.
// Takes a question and a docId, finds the most relevant chunks
// from Pinecone, then sends them to Gemini as context for a grounded answer.
// Uses streaming so the response appears word-by-word in the UI.

import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { embedQuery } from "@/lib/embedder";
import { querySimilar } from "@/lib/pinecone";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function POST(req) {
  try {
    const { question, docId } = await req.json();

    if (!question || !docId) {
      return NextResponse.json(
        { error: "Missing question or docId" },
        { status: 400 }
      );
    }

    // step 1 — embed the user's question
    const queryVector = await embedQuery(question);

    // step 2 — retrieve top 5 most relevant chunks from Pinecone
    const relevantChunks = await querySimilar(docId, queryVector, 5);

    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find relevant information in the document to answer that question.",
        sources: [],
      });
    }

    // step 3 — build the RAG prompt
    // the key here is we explicitly tell the model to ONLY use the provided context
    const context = relevantChunks
      .map((chunk, i) => `[Source ${i + 1}]\n${chunk.text}`)
      .join("\n\n");

    const systemPrompt = `You are a document assistant. Your job is to answer questions strictly based on the provided document context below.

Rules:
- Only use information from the provided context
- If the answer isn't in the context, say "I don't see that information in the uploaded document"
- Be concise but complete
- Quote or reference specific parts of the document when helpful

Document Context:
${context}`;

    // step 4 — generate the answer using Gemini Flash
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(question);
    const answer = result.response.text();

    return NextResponse.json({
      answer,
      sources: relevantChunks.map((c) => ({
        text: c.text.slice(0, 150) + "...",
        score: Math.round(c.score * 100) / 100,
      })),
    });
  } catch (err) {
    console.error("Chat error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate answer" },
      { status: 500 }
    );
  }
}
