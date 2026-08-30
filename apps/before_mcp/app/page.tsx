"use client";

import { useEffect, useState } from "react";
import { AgentPanel, HealthStrip, type HealthPayload } from "@mcp-learning/shared";
import { Architecture, toolToEdge } from "@/components/Architecture";
import { APPS } from "@/lib/apps";

export default function Page() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [hot, setHot] = useState<ReturnType<typeof toolToEdge>>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((err) => setHealth({ ok: false, missing: [String(err)] }));
  }, []);

  return (
    <main className="app">
      <header>
        <div>
          <h1>Before MCP</h1>
          <p className="sub">
            Every AI app is a snowflake. App 1 and App 2 each ship their own GitHub connector and their own Jira
            connector — 2 × 2 = 4 integrations. Same APIs, four files, four things that break when GitHub changes a
            field.
          </p>
          <p className="quote">That is the N × M problem. N clients times M tools. It explodes.</p>
        </div>
        <div className="badge-row">
          <span className="badge warn">4 custom connectors</span>
          <span className="badge">Cursor SDK · customTools</span>
          <span className="badge">localhost:3000</span>
        </div>
      </header>

      <section className="panel">
        <h2>
          Live architecture
          <span>orange line = the connector that just ran</span>
        </h2>
        <Architecture hot={hot} />
      </section>

      <div className="grid">
        <AgentPanel
          app={APPS.app1}
          emptyMessage="Ready. This app has its own GitHub + Jira connectors."
          onTool={(_appId, name, status) => {
            setHot(toolToEdge(name));
            setLog((prev) => [`${new Date().toLocaleTimeString()}  ${status}  ${name}`, ...prev].slice(0, 24));
            if (status === "completed" || status === "error") {
              window.setTimeout(() => setHot(null), 1200);
            }
          }}
        />
        <AgentPanel
          app={APPS.app2}
          emptyMessage="Ready. This app has a second copy of GitHub + Jira."
          onTool={(_appId, name, status) => {
            setHot(toolToEdge(name));
            setLog((prev) => [`${new Date().toLocaleTimeString()}  ${status}  ${name}`, ...prev].slice(0, 24));
            if (status === "completed" || status === "error") {
              window.setTimeout(() => setHot(null), 1200);
            }
          }}
        />
      </div>

      <HealthStrip
        health={health}
        hint="Read: lib/integrations/app1/github.ts vs lib/integrations/app2/github.ts — two clients, one API."
        log={log}
        emptyLog="Tool calls from both apps show up here."
      />
    </main>
  );
}
