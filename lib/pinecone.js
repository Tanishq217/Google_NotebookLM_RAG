import { Pinecone } from "@pinecone-database/pinecone";

let pineconeClient = null;

function getClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  return pineconeClient;
}

// gemini-embedding-001 outputs 3072 dims natively
const INDEX_DIMENSION = 3072;

async function getIndex() {
  const client = getClient();
  const indexName = process.env.PINECONE_INDEX_NAME || "notebooklm-rag";

  const { indexes } = await client.listIndexes();
  const existing = indexes?.find((idx) => idx.name === indexName);

  if (existing) {
    // if the index has wrong dims (e.g. leftover from an old setup), recreate it
    if (existing.dimension && existing.dimension !== INDEX_DIMENSION) {
      await client.deleteIndex(indexName);
      await new Promise((r) => setTimeout(r, 3000));
    } else {
      return client.index(indexName);
    }
  }

  await client.createIndex({
    name: indexName,
    dimension: INDEX_DIMENSION,
    metric: "cosine",
    spec: {
      serverless: {
        cloud: "aws",
        region: "us-east-1",
      },
    },
  });

  // give Pinecone a few seconds to spin up
  await new Promise((r) => setTimeout(r, 8000));

  return client.index(indexName);
}

export async function upsertChunks(namespace, chunks, embeddings) {
  const index = await getIndex();

  // pair chunks with their embeddings, skip any that came back null/empty
  const vectors = chunks
    .map((chunk, i) => {
      const values = embeddings[i];
      if (!values || values.length === 0) return null;
      return {
        id: `chunk-${chunk.index}`,
        values,
        metadata: {
          text: chunk.text,
          chunkIndex: chunk.index,
        },
      };
    })
    .filter(Boolean);

  if (vectors.length === 0) {
    throw new Error(
      "Embedding failed — no valid vectors to store. Check your GEMINI_API_KEY and try again."
    );
  }

  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    if (batch.length === 0) continue;
    
    // Pinecone SDK requires the batch to be passed inside a 'records' object
    await index.namespace(namespace).upsert({ records: batch });
  }
}

export async function querySimilar(namespace, queryVector, topK = 5) {
  const index = await getIndex();

  const results = await index.namespace(namespace).query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  });

  return results.matches.map((match) => ({
    text: match.metadata?.text || "",
    score: match.score,
  }));
}

export async function clearNamespace(namespace) {
  const index = await getIndex();
  try {
    await index.namespace(namespace).deleteAll();
  } catch (e) {
    // Pinecone 404s if the namespace doesn't exist yet — that's fine
    if (!e.message.includes("404")) {
      console.warn("clearNamespace error:", e.message);
    }
  }
}
