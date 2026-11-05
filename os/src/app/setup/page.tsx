import { Orb } from "@/components/Orb";
import { integrationStatus } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const s = integrationStatus();
  const rows = [
    { name: "Supabase", ok: s.supabase, vars: "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true },
    { name: "Claude API", ok: s.claude, vars: "ANTHROPIC_API_KEY", required: true },
    { name: "ElevenLabs voice", ok: s.elevenlabs, vars: "ELEVENLABS_API_KEY (optional)", required: false },
    { name: "Email allow-list", ok: s.allowList, vars: "JARVIS_ALLOWED_EMAILS (recommended)", required: false },
  ];
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <Orb size={90} state={s.supabase && s.claude ? "success" : "warning"} />
      <h1 className="mt-6 text-2xl font-semibold">Finish setting up JARVIS</h1>
      <p className="mt-2 text-muted">
        Add these environment variables (in <code>.env.local</code> locally, or Vercel → Project → Settings → Environment Variables), run the SQL
        migration in Supabase, then restart. Full steps are in the README.
      </p>
      <ul className="card mt-6 divide-y divide-border">
        {rows.map((r) => (
          <li key={r.name} className="flex items-start justify-between gap-4 p-4">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="mt-0.5 font-mono text-xs text-muted">{r.vars}</p>
            </div>
            <span className={`shrink-0 text-sm ${r.ok ? "text-ok" : r.required ? "text-warn" : "text-muted"}`}>
              {r.ok ? "Configured" : r.required ? "Missing" : "Not set"}
            </span>
          </li>
        ))}
      </ul>
      {s.supabase && (
        <a href="/login" className="btn btn-primary mt-6">
          Continue to sign in
        </a>
      )}
    </div>
  );
}
