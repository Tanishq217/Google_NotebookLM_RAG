// embedder.js
// Wraps Google's gemini-embedding-001 model to generate text embeddings.
// Returns 768-dimensional vectors — matches the Pinecone index config.
// Using output_dimensionality to lock the size since the model defaults to 3072.

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-embedding-001 is the current stable embedding model (replaces the old text-embedding-004)
// we pin output to 768 dims to stay compatible with the existing Pinecone index
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

/**
 * Generate embeddings for an array of text strings.
 * Batches requests to stay safe with API rate limits on larger docs.
 *
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} - Array of 768-dim embedding vectors
 */
export async function embedTexts(texts) {
  const embeddings = [];

  // process in batches of 20 — safe limit before hitting rate caps
  const BATCH_SIZE = 20;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // Gemini embedContent is per-string, so we run them in parallel per batch
    const batchResults = await Promise.all(
      batch.map(async (text) => {
        const result = await embeddingModel.embedContent({
          content: { parts: [{ text }], role: "user" },
          taskType: "RETRIEVAL_DOCUMENT",
          outputDimensionality: 768,
        });
        return result.embedding.values;
      })
    );

    embeddings.push(...batchResults);
  }

  return embeddings;
}

/**
 * Embed a single query string for similarity search at retrieval time.
 *
 * @param {string} query - The user's question
 * @returns {Promise<number[]>} - A single 768-dim embedding vector
 */
export async function embedQuery(query) {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text: query }], role: "user" },
    taskType: "RETRIEVAL_QUERY",
    outputDimensionality: 768,
  });
  return result.embedding.values;
}
