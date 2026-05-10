import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const BATCH_SIZE = 20;

export async function embedTexts(texts) {
  const embeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (text) => {
        const result = await embeddingModel.embedContent({
          content: { parts: [{ text }] },
          taskType: "RETRIEVAL_DOCUMENT",
        });
        const values = result?.embedding?.values;
        if (!values || values.length === 0) {
          console.warn("Warning: got empty embedding for a chunk, skipping.");
          return null;
        }
        return values;
      })
    );

    embeddings.push(...results);
  }

  return embeddings;
}

export async function embedQuery(query) {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text: query }] },
    taskType: "RETRIEVAL_QUERY",
  });
  return result.embedding.values;
}
