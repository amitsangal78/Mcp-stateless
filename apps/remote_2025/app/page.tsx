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
          <h1>Remote MCP · March 2025</h1>
          <p className="sub">
            Same two AI clients. GitHub and Jira are still written once — but they now live behind a URL.
            The client mints an OAuth bearer token. <code>merge_pr</code> is annotated destructive.
            <code>list_pulls</code> is annotated read-only.
          </p>
          <p className="quote">This is the spec where MCP stopped being a laptop demo.</p>
        </div>
        <div className="badge-row">
          <span className="badge hot">Streamable HTTP</span>
          <span className="badge">OAuth 2.1</span>
          <span className="badge">tool annotations</span>
          <span className="badge">localhost:3002</span>
        </div>
      </header>

      <section className="panel">
        <h2>
          Live architecture
          <span>teal = the remote path that just ran</span>
        </h2>
        <Architecture appId={appId} service={service} />
      </section>

      <div className="grid">
        <AgentPanel
          app={APPS.app1}
          emptyMessage="Ready. This app talks HTTP to the GitHub and Jira MCP URLs. No stdio child process."
          onTool={onTool}
        />
        <AgentPanel
          app={APPS.app2}
          emptyMessage="Ready. Different client, same remote MCP URLs and the same OAuth issuer."
          onTool={onTool}
        />
      </div>

      <HealthStrip
        health={health}
        hint="Read: mcp-servers/github.ts (annotations + HTTP) and mcp-servers/oauth.ts — then lib/mcp-servers.ts (type: http)."
        log={log}
        emptyLog="Tool calls travel Streamable HTTP with a Bearer token."
      />
    </main>
  );
}
