"use client";

// app/page.jsx
// Main page — two-panel layout with upload on the left and chat on the right.
// All state lives here and gets passed down to child components.

import { useState, useRef, useEffect } from "react";

// suggested questions to show after upload — just to help the user get started
const SAMPLE_QUESTIONS = [
  "What is the main topic of this document?",
  "Summarize the key points",
  "What conclusions does the document draw?",
];

export default function HomePage() {
  // document state
  const [docInfo, setDocInfo] = useState(null); // { docId, fileName, chunkCount }
  const [uploadStatus, setUploadStatus] = useState("idle"); // idle | uploading | done | error
  const [uploadStep, setUploadStep] = useState(0); // which processing step we're on
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // chat state
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [chatError, setChatError] = useState("");

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // auto-resize textarea as user types
  const handleTextareaChange = (e) => {
    setQuestion(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  // ---------- Upload logic ----------

  const handleFileSelect = async (file) => {
    if (!file) return;

    const allowed = ["application/pdf", "text/plain"];
    if (!allowed.includes(file.type)) {
      setUploadError("Only PDF and .txt files are supported.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File too large — max 10 MB.");
      return;
    }

    setUploadError("");
    setUploadStatus("uploading");
    setUploadStep(1); // extracting text

    const formData = new FormData();
    formData.append("file", file);

    try {
      // fake a small delay so steps feel more real
      await delay(600);
      setUploadStep(2); // chunking

      await delay(400);
      setUploadStep(3); // embedding

      // actually kick off the upload (embedding happens server-side)
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      setUploadStep(4); // storing in Pinecone

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      await delay(300);

      setDocInfo({
        docId: data.docId,
        fileName: data.fileName,
        chunkCount: data.chunkCount,
        charCount: data.charCount,
      });
      setUploadStatus("done");
      setMessages([]); // clear previous chat if re-uploading

    } catch (err) {
      setUploadStatus("error");
      setUploadError(err.message || "Something went wrong. Try again.");
    }
  };

  const handleFileInputChange = (e) => {
    handleFileSelect(e.target.files?.[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files?.[0]);
  };

  const handleReset = () => {
    setDocInfo(null);
    setUploadStatus("idle");
    setUploadStep(0);
    setUploadError("");
    setMessages([]);
    setChatError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---------- Chat logic ----------

  const sendMessage = async (text) => {
    const q = text || question;
    if (!q.trim() || !docInfo || isThinking) return;

    const userMsg = { role: "user", text: q };
    setMessages((prev) => [...prev, userMsg]);
    setQuestion("");
    setChatError("");
    setIsThinking(true);

    // reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, docId: docInfo.docId }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to get answer");

      const aiMsg = {
        role: "ai",
        text: data.answer,
        sources: data.sources,
      };
      setMessages((prev) => [...prev, aiMsg]);

    } catch (err) {
      setChatError(err.message || "Couldn't get an answer. Try again.");
      // remove the user message if we failed so it's not orphaned
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ---------- Render ----------

  const processingSteps = [
    "Extracting text from document",
    "Splitting into chunks",
    "Generating embeddings",
    "Storing in vector database",
  ];

  return (
    <div className="app-shell">
      {/* ── Header ── */}
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo">📓</div>
          <span className="topbar-title">NotebookLM</span>
          <span className="topbar-badge">RAG</span>
        </div>
        {docInfo && (
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Chatting with:{" "}
            <strong style={{ color: "var(--text-secondary)" }}>
              {docInfo.fileName}
            </strong>
          </span>
        )}
      </header>

      {/* ── Main layout ── */}
      <div className="main-layout">
        {/* ── Left sidebar ── */}
        <aside className="sidebar">
          <div>
            <p className="sidebar-section-title">Your Document</p>

            {/* Upload zone — shown when no doc loaded */}
            {uploadStatus === "idle" && (
              <>
                <div
                  className={`upload-zone ${isDragging ? "dragging" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileInputChange}
                    id="file-upload-input"
                  />
                  <span className="upload-icon">📄</span>
                  <h3>Drop your file here</h3>
                  <p>or click to browse</p>
                  <div className="file-types">
                    <span className="file-type-badge">PDF</span>
                    <span className="file-type-badge">TXT</span>
                  </div>
                </div>
                {uploadError && (
                  <div className="error-toast" style={{ marginTop: 12 }}>
                    ⚠️ {uploadError}
                  </div>
                )}
              </>
            )}

            {/* Processing state */}
            {uploadStatus === "uploading" && (
              <div className="processing-card">
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 14, color: "var(--text-primary)" }}>
                  Processing document…
                </p>
                <div className="progress-steps">
                  {processingSteps.map((step, i) => {
                    const stepNum = i + 1;
                    const isDone = uploadStep > stepNum;
                    const isActive = uploadStep === stepNum;
                    return (
                      <div
                        key={step}
                        className={`progress-step ${isDone ? "done" : ""} ${isActive ? "active" : ""}`}
                      >
                        <div className="step-dot" />
                        <span>{step}</span>
                        {isDone && <span style={{ marginLeft: "auto" }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error state */}
            {uploadStatus === "error" && (
              <>
                <div className="error-toast">
                  ⚠️ {uploadError}
                </div>
                <button className="reset-btn" onClick={handleReset} style={{ marginTop: 10 }}>
                  Try another file
                </button>
              </>
            )}

            {/* Success state — document info card */}
            {uploadStatus === "done" && docInfo && (
              <div className="doc-card">
                <p className="doc-name">📄 {docInfo.fileName}</p>
                <div className="doc-meta">
                  <span className="doc-meta-item">
                    🧩 {docInfo.chunkCount} chunks
                  </span>
                  <span className="doc-meta-item">
                    📝 {Math.round(docInfo.charCount / 1000)}k chars
                  </span>
                </div>
                <div className="doc-status">
                  <span className="status-dot" />
                  Ready to chat
                </div>
                <button className="reset-btn" onClick={handleReset}>
                  Upload a different file
                </button>
              </div>
            )}
          </div>

          {/* Suggested questions — only show when doc is ready and no messages yet */}
          {uploadStatus === "done" && messages.length === 0 && (
            <div>
              <div className="divider" />
              <p className="sidebar-section-title" style={{ marginTop: 4 }}>
                Try asking…
              </p>
              <div className="suggestions">
                {SAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="suggestion-chip"
                    onClick={() => sendMessage(q)}
                    id={`suggestion-${q.slice(0, 20).replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Chat panel ── */}
        <main className="chat-panel">
          {/* Messages area */}
          <div className="chat-messages">
            {messages.length === 0 && !isThinking ? (
              <div className="empty-state">
                <span className="empty-icon">🤖</span>
                <h2 className="empty-title">
                  {uploadStatus === "done"
                    ? "Ask anything about your document"
                    : "Upload a document to get started"}
                </h2>
                <p className="empty-subtitle">
                  {uploadStatus === "done"
                    ? "I'll answer from the document's actual content — no hallucinations."
                    : "Supports PDF and plain text files up to 10 MB."}
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`message-row ${msg.role}`}
                    id={`message-${i}`}
                  >
                    <div className={`message-avatar ${msg.role}`}>
                      {msg.role === "ai" ? "🤖" : "👤"}
                    </div>
                    <div className="message-content">
                      <div className={`message-bubble ${msg.role}`}>
                        {msg.text}
                      </div>
                      {/* source snippets for AI messages */}
                      {msg.role === "ai" && msg.sources?.length > 0 && (
                        <div className="message-sources">
                          {msg.sources.map((src, si) => (
                            <span
                              key={si}
                              className="source-tag"
                              title={src.text}
                            >
                              Source {si + 1} · {Math.round(src.score * 100)}% match
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing indicator while AI is thinking */}
                {isThinking && (
                  <div className="message-row ai" id="thinking-indicator">
                    <div className="message-avatar ai">🤖</div>
                    <div className="message-bubble ai">
                      <div className="typing-indicator">
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                        <div className="typing-dot" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* chat error */}
            {chatError && (
              <div className="error-toast" style={{ maxWidth: 480, margin: "0 auto" }}>
                ⚠️ {chatError}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div className="chat-input-bar">
            <div className="chat-input-wrapper">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                id="chat-input"
                rows={1}
                placeholder={
                  uploadStatus === "done"
                    ? "Ask a question about your document…"
                    : "Upload a document first"
                }
                value={question}
                onChange={handleTextareaChange}
                onKeyDown={handleKeyDown}
                disabled={uploadStatus !== "done" || isThinking}
              />
              <button
                className="send-btn"
                id="send-button"
                onClick={() => sendMessage()}
                disabled={!question.trim() || uploadStatus !== "done" || isThinking}
                aria-label="Send message"
              >
                ➤
              </button>
            </div>
            <p className="input-hint">
              Enter to send · Shift+Enter for new line · Answers grounded in your document
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

// tiny helper
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
