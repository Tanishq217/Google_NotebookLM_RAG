import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

// batching at 20 to stay within rate limits for larger docs
const BATCH_SIZE = 20;

export async function embedTexts(texts) {
  const embeddings = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const results = await Promise.all(
      batch.map(async (text) => {
        const result = await embeddingModel.embedContent(text);
        return result.embedding.values;
      })
    );

    embeddings.push(...results);
  }

  return embeddings;
}

export async function embedQuery(query) {
  const result = await embeddingModel.embedContent(query);
  return result.embedding.values;
}
