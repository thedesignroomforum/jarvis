export function ComingSoon({ title, phase, children }: { title: string; phase: string; children?: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-medium text-muted">Coming soon · {phase}</span>
      </div>
      <h3 className="mt-3 text-[15px] font-medium">{title}</h3>
      {children && <div className="mt-1.5 text-sm leading-relaxed text-muted">{children}</div>}
    </div>
  );
}
