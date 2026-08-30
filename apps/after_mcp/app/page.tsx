"use client";

import { useEffect, useState } from "react";
import { AgentPanel, HealthStrip, type AppId, type HealthPayload } from "@mcp-learning/shared";
import { Architecture, toolToService, type Service } from "@/components/Architecture";
import { APPS } from "@/lib/apps";

export default function Page() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [appId, setAppId] = useState<AppId | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((err) => setHealth({ ok: false, missing: [String(err)] }));
  }, []);

  function onTool(from: AppId, name: string, status: string) {
    setAppId(from);
    setService(toolToService(name));
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${from}  ${status}  ${name}`, ...prev].slice(0, 24));
    if (status === "completed" || status === "error") {
      window.setTimeout(() => {
        setAppId(null);
        setService(null);
      }, 1400);
    }
  }

  return (
    <main className="app">
      <header>
        <div>
          <h1>After MCP</h1>
          <p className="sub">
            Same two AI clients. GitHub is one server. Jira is one server. App 1 and App 2 both speak MCP — they do
            not own a GitHub client anymore.
          </p>
          <p className="quote">
            MCP&apos;s original bet was simple: write the integration once on the server, and let different AI clients
            use it.
          </p>
        </div>
        <div className="badge-row">
          <span className="badge hot">2 MCP servers · N clients</span>
          <span className="badge">Cursor SDK · mcpServers</span>
          <span className="badge">localhost:3001</span>
        </div>
      </header>

      <section className="panel">
        <h2>
          Live architecture
          <span>teal = the shared path that just ran</span>
        </h2>
        <Architecture appId={appId} service={service} />
      </section>

      <div className="grid">
        <AgentPanel
          app={APPS.app1}
          emptyMessage="Ready. This app has no GitHub or Jira REST code — it uses the shared MCP servers."
          onTool={onTool}
        />
        <AgentPanel
          app={APPS.app2}
          emptyMessage="Ready. A different client, same GitHub and Jira MCP servers."
          onTool={onTool}
        />
      </div>

      <HealthStrip
        health={health}
        hint="Read: mcp-servers/github.ts and lib/mcp-servers.ts — both apps load that same map."
        log={log}
        emptyLog="Tool calls from both apps share github.ts / jira.ts."
      />
    </main>
  );
}
