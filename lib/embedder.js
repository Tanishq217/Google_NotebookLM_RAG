// embedder.js
// Wraps Google Gemini's text-embedding-004 model.
// Given an array of text strings, returns an array of embedding vectors.
// Each vector has 768 dimensions — matches the Pinecone index config.

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Generate embeddings for an array of text strings.
 * Batches requests to avoid hitting rate limits on large docs.
 *
 * @param {string[]} texts - Array of text strings to embed
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
export async function embedTexts(texts) {
  const embeddings = [];

  // process in batches of 20 to be safe with the API rate limits
  const BATCH_SIZE = 20;

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    // embed each text individually (Gemini embedContent is per-string)
    const batchResults = await Promise.all(
      batch.map(async (text) => {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
      })
    );

    embeddings.push(...batchResults);
  }

  return embeddings;
}

/**
 * Embed a single query string for retrieval.
 *
 * @param {string} query - User's question
 * @returns {Promise<number[]>} - Single embedding vector
 */
export async function embedQuery(query) {
  const result = await embeddingModel.embedContent(query);
  return result.embedding.values;
}
