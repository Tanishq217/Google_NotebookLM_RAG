// app/layout.jsx
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "NotebookLM — Chat with your documents",
  description:
    "A RAG-powered document Q&A app. Upload any PDF or text file and have a grounded conversation with it — answers come directly from your document.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
