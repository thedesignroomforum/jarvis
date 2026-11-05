"use client";

import { Chat } from "@/components/Chat";
import { PageHeader } from "@/components/PageHeader";

export default function DesignReviewPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-57px)] max-w-3xl flex-col px-5 pt-10 pb-24 sm:px-8 lg:min-h-dvh">
      <PageHeader eyebrow="Design Master" title="Design Review">
        Drop a screenshot, Figma export, website or competitor screen. JARVIS reviews visual design, UX, product and design-system consistency, with a severity for every issue.
      </PageHeader>
      <Chat
        initialMode="design"
        lockMode
        className="flex-1"
        placeholder="Add context: who is this for, and what should it achieve?"
        emptyState={
          <div className="card grid place-items-center border-dashed px-6 py-14 text-center">
            <p className="text-[15px] font-medium">Attach or paste a design below</p>
            <p className="mt-1 max-w-sm text-[13px] text-muted">
              Use the paperclip, drag an image onto the box, paste from your clipboard, or capture your screen. Say what the screen is for to get a sharper review.
            </p>
            <p className="mt-4 text-[12px] text-faint">Severity: Critical · High · Medium · Low</p>
          </div>
        }
      />
    </div>
  );
}
