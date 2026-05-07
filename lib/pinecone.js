// pinecone.js
// Handles all Pinecone vector database operations.
// Using namespace-per-document so different uploads don't collide.
// The index needs to be created manually in the Pinecone dashboard
// with 768 dimensions and cosine metric.

import { Pinecone } from "@pinecone-database/pinecone";

// singleton pattern — no need to re-init on every request
let pineconeClient = null;

function getClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });
  }
  return pineconeClient;
}

/**
 * Get the target index. Creates it if it doesn't already exist.
 */
async function getIndex() {
  const client = getClient();
  const indexName = process.env.PINECONE_INDEX_NAME || "notebooklm-rag";

  // check if index exists, create if not
  const { indexes } = await client.listIndexes();
  const exists = indexes?.some((idx) => idx.name === indexName);

  if (!exists) {
    await client.createIndex({
      name: indexName,
      dimension: 768,
      metric: "cosine",
      spec: {
        serverless: {
          cloud: "aws",
          region: "us-east-1",
        },
      },
    });

    // wait a few seconds for the index to be ready
    await new Promise((r) => setTimeout(r, 5000));
  }

  return client.index(indexName);
}

/**
 * Upsert chunk embeddings into Pinecone under a specific namespace.
 * Each namespace corresponds to one uploaded document.
 *
 * @param {string} namespace - Unique doc identifier
 * @param {Array<{ text: string, index: number }>} chunks - Text chunks
 * @param {number[][]} embeddings - Corresponding embedding vectors
 */
export async function upsertChunks(namespace, chunks, embeddings) {
  const index = await getIndex();

  const vectors = chunks.map((chunk, i) => ({
    id: `chunk-${chunk.index}`,
    values: embeddings[i],
    metadata: {
      text: chunk.text,
      chunkIndex: chunk.index,
    },
  }));

  // upsert in batches of 100 (Pinecone's recommended batch size)
  const BATCH_SIZE = 100;
  for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
    const batch = vectors.slice(i, i + BATCH_SIZE);
    await index.namespace(namespace).upsert(batch);
  }
}

/**
 * Query Pinecone for the top-k most similar chunks to a query vector.
 *
 * @param {string} namespace - The document namespace to search in
 * @param {number[]} queryVector - Embedded query
 * @param {number} topK - Number of results to return
 * @returns {Promise<Array<{ text: string, score: number }>>}
 */
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

/**
 * Delete all vectors in a document's namespace.
 * Useful for re-uploading the same doc.
 *
 * @param {string} namespace
 */
export async function clearNamespace(namespace) {
  const index = await getIndex();
  await index.namespace(namespace).deleteAll();
}
