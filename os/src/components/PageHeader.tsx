export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-8">
      {eyebrow && <p className="label">{eyebrow}</p>}
      <h1 className="mt-1.5 text-[28px] font-semibold tracking-tight">{title}</h1>
      {children && <div className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted">{children}</div>}
    </header>
  );
}
