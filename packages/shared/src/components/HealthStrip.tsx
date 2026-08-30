"use client";

import type { HealthPayload } from "../types";

export function HealthStrip({
  health,
  hint,
  log,
  emptyLog,
}: {
  health: HealthPayload | null;
  hint: string;
  log: string[];
  emptyLog: string;
}) {
  return (
    <section className="panel">
      <h2>Keys · files to read · tool log</h2>
      <div className="grid" style={{ padding: 14 }}>
        <div className="health">
          {!health && <div>Checking GitHub / Jira / Cursor keys…</div>}
          {health?.missing && (
            <div className="bad">
              Missing env: {health.missing.join(", ")}. Copy .env.example to .env.local at the repo root.
            </div>
          )}
          {health?.checks &&
            Object.entries(health.checks).map(([key, value]) => (
              <div key={key} className={value.ok ? "ok" : "bad"}>
                {key}: {value.detail}
              </div>
            ))}
          <div style={{ marginTop: 8, color: "var(--faint)" }}>{hint}</div>
        </div>
        <div className="log">
          {log.length === 0 ? emptyLog : log.map((row, i) => <div key={i}>{row}</div>)}
        </div>
      </div>
    </section>
  );
}
