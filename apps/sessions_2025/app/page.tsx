"use client";

import { useEffect, useState } from "react";
import { AgentPanel, HealthStrip, type AppId, type HealthPayload } from "@mcp-learning/shared";
import { Architecture, isCrossPodTool, toolToService, type Service } from "@/components/Architecture";
import { APPS } from "@/lib/apps";

export default function Page() {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [appId, setAppId] = useState<AppId | null>(null);
  const [service, setService] = useState<Service | null>(null);
  const [sessionLost, setSessionLost] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch((err) => setHealth({ ok: false, missing: [String(err)] }));
  }, []);

  function onTool(from: AppId, name: string, status: string) {
    const lost = isCrossPodTool(name) && status === "error";
    setAppId(from);
    setService(toolToService(name));
    setSessionLost(lost);
    const hop = isCrossPodTool(name) ? " → Pod B" : name.toLowerCase().includes("jira") ? "" : " → Pod A";
    setLog((prev) => [`${new Date().toLocaleTimeString()}  ${from}  ${status}  ${name}${hop}`, ...prev].slice(0, 24));
    if (status === "completed" || status === "error") {
      window.setTimeout(() => {
        setAppId(null);
        setService(null);
        setSessionLost(false);
      }, 2200);
    }
  }

  return (
    <main className="app">
      <header>
        <div>
          <h1>Sessions · 2025 production</h1>
          <p className="sub">
            <code>open_pr</code> hits Pod A and stores the PR in session RAM. A rolling deploy (this demo) sends{" "}
            <code>wait_for_ci</code> and <code>merge_pr</code> to Pod B. Pod B has never heard of{" "}
            <code>Mcp-Session-Id</code>. GitHub still has the PR. The protocol lost it.
          </p>
          <p className="quote">You didn&apos;t need a session. You needed a PR number.</p>
        </div>
        <div className="badge-row">
          <span className="badge hot">Mcp-Session-Id</span>
          <span className="badge warn">sticky Pod A</span>
          <span className="badge danger">merge dies on Pod B</span>
          <span className="badge">localhost:3003</span>
        </div>
      </header>

      <section className="panel">
        <h2>
          Live architecture
          <span>rose = session not found</span>
        </h2>
        <Architecture appId={appId} service={service} sessionLost={sessionLost} />
      </section>

      <div className="grid">
        <AgentPanel
          app={APPS.app1}
          emptyMessage="Ready. Create the branch and PR (Pod A), then merge — that call is routed to Pod B on purpose."
          onTool={onTool}
        />
        <AgentPanel
          app={APPS.app2}
          emptyMessage="Ready. Same GitHub farm, same session trap."
          onTool={onTool}
        />
      </div>

      <HealthStrip
        health={health}
        hint="Read: mcp-servers/github-pods.ts (LB → Pod B) and mcp-servers/github.ts (currentPr lives in session RAM, not in the tool args)."
        log={log}
        emptyLog="open_pr stays on Pod A. merge_pr / wait_for_ci hop to Pod B."
      />
    </main>
  );
}
