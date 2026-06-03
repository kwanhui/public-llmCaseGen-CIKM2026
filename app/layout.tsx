import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CaseForge — Faculty-in-the-loop Case Authoring",
  description:
    "CaseForge drafts personalised professional case studies via a four-stage RAG+LLM pipeline. Faculty-in-the-loop editing across Finance, Marketing, and Social Work.",
};

// Students often open their team link on a phone, so the case viewer must scale
// to the device width rather than rendering at a fixed desktop width.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
