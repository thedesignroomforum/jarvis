"use client";

import { useEffect, useState } from "react";
import { Chat } from "@/components/Chat";
import { PageHeader } from "@/components/PageHeader";

export default function ResearchPage() {
  const [web, setWeb] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/status").then(async (r) => setWeb(((await r.json()) as { webSearch: boolean }).webSearch));
  }, []);
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] max-w-3xl flex-col px-5 pt-10 pb-24 sm:px-8 lg:min-h-dvh">
      <PageHeader eyebrow="Researcher" title="Research">
        Ask a research question. JARVIS separates facts from inferences, flags what it couldn&apos;t verify, and turns findings into implications for your projects.
      </PageHeader>
      {web === false && (
        <div className="mb-4 rounded-xl border border-border px-4 py-3 text-[13px] text-muted">
          <strong className="text-text">Live web search is off.</strong> JARVIS will answer from its training knowledge and say so. To enable it, set{" "}
          <code>JARVIS_WEB_SEARCH=true</code> and turn on web search for your organisation in the Anthropic Console (billed per search).
        </div>
      )}
      {web && <p className="mb-4 text-[13px] text-ok">Live web search is on. Sources appear under each answer.</p>}
      <Chat
        initialMode="researcher"
        lockMode
        className="flex-1"
        placeholder="e.g. Research the African mobility market. What does it mean for VELOCITY?"
        emptyState={<p className="py-6 text-center text-sm text-muted">Primary sources first. Contradictions called out. Nothing invented.</p>}
      />
    </div>
  );
}
