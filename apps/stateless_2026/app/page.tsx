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
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${from}  ${status}  ${name}  (any pod · pr_id in result)`, ...prev].slice(0, 24));
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
          <h1>Stateless MCP · July 2026</h1>
          <p className="sub">
            Handshake gone. <code>Mcp-Session-Id</code> gone. <code>open_pr</code> returns <code>pr_id</code>.
            The next call sends that handle. Round-robin can land on Pod A or Pod B — both ask GitHub.
            The protocol stopped smuggling state.
          </p>
          <p className="quote">The protocol is stateless. Your application can still be stateful — it just has to say so out loud.</p>
        </div>
        <div className="badge-row">
          <span className="badge hot">no session</span>
          <span className="badge">pr_id in the tool result</span>
          <span className="badge">round-robin pods</span>
          <span className="badge">localhost:3004</span>
        </div>
      </header>

      <section className="panel">
        <h2>
          Live architecture
          <span>both pods stay teal — there is no sticky cookie</span>
        </h2>
        <Architecture appId={appId} service={service} />
      </section>

      <div className="grid">
        <AgentPanel
          app={APPS.app1}
          emptyMessage="Ready. Pass pr_id from open_pr into wait_for_ci and merge_pr. Any replica can finish the hotfix."
          onTool={onTool}
        />
        <AgentPanel
          app={APPS.app2}
          emptyMessage="Ready. ticket_id and pr_id are handles. Nothing is stored in MCP session RAM."
          onTool={onTool}
        />
      </div>

      <HealthStrip
        health={health}
        hint="Read: mcp-servers/http-host.ts (sessionIdGenerator: undefined, round-robin) and github.ts (pr_id on every follow-up tool)."
        log={log}
        emptyLog="Every GitHub call can hop pods. The body carries pr_id."
      />
    </main>
  );
}
