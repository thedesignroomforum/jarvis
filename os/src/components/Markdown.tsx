"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Safe markdown rendering (no raw HTML). Links open in a new tab. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-jarvis">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
