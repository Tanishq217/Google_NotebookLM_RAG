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

    // embed the question and pull the top 5 relevant chunks
    const queryVector = await embedQuery(question);
    const relevantChunks = await querySimilar(docId, queryVector, 5);

    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find anything relevant in the document to answer that.",
        sources: [],
      });
    }

    // build context block from retrieved chunks
    const context = relevantChunks
      .map((chunk, i) => `[Excerpt ${i + 1}]\n${chunk.text}`)
      .join("\n\n");

    // system prompt — keep the model honest and document-grounded
    const systemPrompt = `You're helping someone understand a document they uploaded. Use only the excerpts below to answer. Don't pull from your own training data or general knowledge.

If the answer isn't clearly in the excerpts, just say you don't see that in the document. Don't guess.

Keep answers clear and to the point. If a specific part of the document is relevant, quote it or point to it.

Document excerpts:
${context}`;

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
