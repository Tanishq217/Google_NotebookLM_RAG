import { NextResponse } from "next/server";
import { embedQuery } from "@/lib/embedder";
import { querySimilar } from "@/lib/pinecone";

async function callOpenRouter(prompt, systemInstruction = "") {
  const messages = [];
  if (systemInstruction) {
    messages.push({ role: "system", content: systemInstruction });
  }
  messages.push({ role: "user", content: prompt });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // You can change this to "meta-llama/llama-3-8b-instruct:free" or others
      model: "google/gemini-2.5-flash",
      messages: messages,
      max_tokens: 2000,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.message || "OpenRouter API Error");
  }
  return data.choices[0].message.content;
}

export async function POST(req) {
  try {
    const { question, docId } = await req.json();

    if (!question || !docId) {
      return NextResponse.json(
        { error: "Missing question or docId" },
        { status: 400 }
      );
    }

    // Step 1: Query Optimization (CRAG)
    const optimizePrompt = `You are a search query optimizer. 
Given the user's question, rewrite it to be a clear, standalone search query that will be used to search a vector database. 
Do not add any conversational filler, just output the optimized search query.
User question: ${question}`;

    const optimizedQueryText = await callOpenRouter(optimizePrompt);
    const optimizedQuery = optimizedQueryText.trim() || question;
    console.log(`Optimized query: "${optimizedQuery}"`);

    // Step 2: Retrieval
    const queryVector = await embedQuery(optimizedQuery);
    const retrievedChunks = await querySimilar(docId, queryVector, 5);

    if (retrievedChunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find anything in the document to answer that.",
        sources: [],
      });
    }

    // Step 3: LLM as a Judge (Relevance Filtering)
    const chunksText = retrievedChunks
      .map((c, i) => `[Excerpt ${i}]\n${c.text}`)
      .join("\n\n");

    const judgePrompt = `You are an evaluator. Look at the following excerpts and determine if they contain information relevant to answering the question.
Question: ${optimizedQuery}

Excerpts:
${chunksText}

Reply ONLY with a valid JSON array of booleans representing the relevance of each excerpt in order. For example, if there are 3 excerpts and the first and third are relevant, reply with [true, false, true].`;

    let relevantChunks = [];
    try {
      const judgmentText = await callOpenRouter(judgePrompt);
      const jsonMatch = judgmentText.match(/\[.*\]/s);
      const judgments = jsonMatch ? JSON.parse(jsonMatch[0]) : retrievedChunks.map(() => true);
      
      relevantChunks = retrievedChunks.filter((chunk, i) => judgments[i] === true);
    } catch (e) {
      console.warn("LLM Judge evaluation failed, falling back to all chunks", e);
      relevantChunks = retrievedChunks; // fallback to all chunks if JSON parsing fails
    }

    console.log(`Retrieved ${retrievedChunks.length} chunks, ${relevantChunks.length} were relevant.`);

    // Step 4: Corrective Action & Generation
    if (relevantChunks.length === 0) {
      return NextResponse.json({
        answer: "I couldn't find anything relevant in the document to answer that.",
        sources: [],
      });
    }

    const context = relevantChunks
      .map((chunk, i) => `[Excerpt ${i + 1}]\n${chunk.text}`)
      .join("\n\n");

    const systemPrompt = `You're helping someone understand a document they uploaded. Use only the excerpts below to answer. Don't pull from your own training data or general knowledge.

If the answer isn't clearly in the excerpts, just say you don't see that in the document. Don't guess.

Keep answers clear and to the point. If a specific part of the document is relevant, quote it or point to it.

Document excerpts:
${context}`;

    const answer = await callOpenRouter(question, systemPrompt);

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
