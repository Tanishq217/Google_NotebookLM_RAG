# NotebookLM RAG

A RAG (Retrieval-Augmented Generation) powered document chat app — my own version of Google NotebookLM.

Upload any PDF or plain text file, and have a real conversation with it. Answers are grounded in the document's actual content, not the model's memory.

---

## How it works

The app implements a full RAG pipeline:

1. **Upload** — User uploads a PDF or `.txt` file
2. **Extract** — Raw text is pulled out using `pdf-parse` (or direct decoding for text files)
3. **Chunk** — The text is split into 500-character chunks with 50-character overlap. The overlap keeps sentences from getting cut off at chunk boundaries.
4. **Embed** — Each chunk is embedded using Google's `text-embedding-004` model (768 dimensions)
5. **Store** — Embeddings are stored in Pinecone (serverless, per-document namespace)
6. **Retrieve** — When the user asks a question, it's embedded and the top-5 most similar chunks are fetched from Pinecone
7. **Generate** — Gemini 1.5 Flash generates an answer using only those retrieved chunks as context

The model is explicitly instructed not to use its general knowledge — if the answer isn't in the document, it says so.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 14 (App Router) |
| LLM | Google Gemini 1.5 Flash |
| Embeddings | Google text-embedding-004 |
| Vector DB | Pinecone (Serverless) |
| PDF Parsing | pdf-parse |
| Styling | Tailwind CSS + custom CSS |
| Deployment | Vercel |

---

## Chunking Strategy

**Fixed-size chunking with overlap**

- Chunk size: 500 characters
- Overlap: 50 characters
- Why overlap? It prevents important context from being split across chunk boundaries. For example, if a key sentence spans the end of one chunk and the start of another, overlap ensures it's fully represented in at least one chunk.
- Minimum chunk size: 20 characters (tiny leftovers are dropped)

See [`lib/chunker.js`](./lib/chunker.js) for the implementation.

---

## Project Structure

```
├── app/
│   ├── page.jsx              # Main UI
│   ├── layout.jsx
│   ├── globals.css
│   └── api/
│       ├── upload/route.js   # Ingest pipeline
│       └── chat/route.js     # Retrieval + generation
├── lib/
│   ├── chunker.js            # Fixed-size chunking with overlap
│   ├── embedder.js           # Gemini embedding wrapper
│   ├── parser.js             # PDF and TXT extraction
│   └── pinecone.js           # Pinecone client and helpers
```

---

## Running locally

1. Clone the repo
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create `.env.local`:
   ```env
   GEMINI_API_KEY=your_gemini_key
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_INDEX_NAME=notebooklm-rag
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

> **Pinecone setup**: Create a free Serverless index named `notebooklm-rag` with 768 dimensions and cosine metric (AWS us-east-1). The app will auto-create it on first run if it doesn't exist.

---

## Live Demo

[Deployed on Vercel →](https://notebooklm-rag.vercel.app) <!-- update this link after deployment -->

---

## Notes

- Works best with text-heavy PDFs (not scanned image PDFs)
- Files up to ~10 MB tested fine
- Each document upload creates its own Pinecone namespace, so multiple docs don't interfere
