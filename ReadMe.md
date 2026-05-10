# NotebookLM RAG

My own version of Google NotebookLM — upload a PDF or text file, ask questions, get answers that come from the actual document.

## What it does

You upload a file. The app breaks it into chunks, embeds each chunk using Gemini, and stores the vectors in Pinecone. When you ask a question, it embeds your query, pulls the most similar chunks, and sends them to Gemini Flash as context. The model is told to only use what's in those chunks — not its own knowledge.

So if you ask something that isn't in the document, it'll tell you it doesn't see that, instead of making something up.

## Tech used

- **Next.js** (App Router) for the web app
- **Google Gemini** — `gemini-embedding-001` for embeddings, `gemini-1.5-flash` for generation
- **Pinecone** serverless for vector storage
- **pdf-parse** to pull text out of PDFs

## How the chunking works

I went with fixed-size chunking — each chunk is 500 characters with a 50-character overlap between consecutive chunks. The overlap is important because otherwise you can lose context right at a chunk boundary (e.g., a sentence that gets cut off). Minimum chunk size is 20 chars to drop tiny leftover bits.

See `lib/chunker.js`.

## Project layout

```
app/
  page.jsx              main UI
  layout.jsx
  globals.css
  api/
    upload/route.js     ingestion pipeline (parse → chunk → embed → store)
    chat/route.js       retrieval + generation
lib/
  chunker.js            fixed-size chunking with overlap
  embedder.js           Gemini embedding wrapper
  parser.js             PDF and TXT text extraction
  pinecone.js           Pinecone client, upsert, query, clear
```

## Running locally

```bash
git clone <repo>
cd notebooklm-rag
npm install
```

Create `.env.local`:
```
GEMINI_API_KEY=your_key_here
PINECONE_API_KEY=your_key_here
PINECONE_INDEX_NAME=notebooklm-rag
```

```bash
npm run dev
```

Open `http://localhost:3000`.

**Pinecone setup:** Create a free Serverless index named `notebooklm-rag`, 3072 dimensions, cosine metric (AWS us-east-1). The app will auto-create it if it doesn't exist yet.

## Live demo

[Deployed on Vercel →](https://notebooklm-rag.vercel.app)

## Notes

- Works best with text-based PDFs (not scanned/image PDFs)
- Each uploaded file gets its own Pinecone namespace, so multiple docs don't interfere
- Files up to ~10 MB work fine
