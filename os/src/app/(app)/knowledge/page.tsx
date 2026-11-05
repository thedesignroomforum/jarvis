import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { ComingSoon } from "@/components/ComingSoon";

const CATEGORIES = [
  "Product Design", "UX Research", "Business", "Entrepreneurship", "Psychology", "Leadership", "Finance",
  "Marketing", "Sales", "Technology", "AI", "History", "Philosophy", "Personal Development",
];

export default function KnowledgePage() {
  return (
    <div className="mx-auto max-w-3xl px-5 pt-10 pb-28 sm:px-8">
      <PageHeader eyebrow="Library" title="Knowledge">
        Your personal, searchable library of books, PDFs and articles you provide, with answers cited back to the source document.
      </PageHeader>

      <div className="card p-5">
        <p className="label">Works today</p>
        <h3 className="mt-2 text-[15px] font-medium">Ask questions about a document in Chat</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Attach a PDF (up to 4 MB), TXT or Markdown file to a message and ask anything about it. JARVIS reads it for that message only; it isn&apos;t stored in a library yet.
        </p>
        <Link href="/chat?mode=teacher" className="btn mt-4">Open Chat</Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <ComingSoon title="Upload once, search forever" phase="Phase 3">
          Uploads to Supabase Storage, chunking, embeddings in pgvector, retrieval and citations. The database tables are already in place.
        </ComingSoon>
        <ComingSoon title="DOCX and web pages" phase="Phase 3">
          Word documents and saved web content (where legally permitted).
        </ComingSoon>
      </div>

      <h2 className="label mt-10 mb-3">Planned categories</h2>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <span key={c} className="rounded-full border border-border px-3 py-1 text-[12.5px] text-muted">{c}</span>
        ))}
      </div>
    </div>
  );
}
