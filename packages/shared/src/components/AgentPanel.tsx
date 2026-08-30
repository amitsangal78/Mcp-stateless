"use client";

import { useEffect, useRef, useState } from "react";
import type { AppCopy, AppId } from "../types";

type Line =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; status: string; detail?: string };

export function AgentPanel({
  app,
  emptyMessage,
  onTool,
}: {
  app: AppCopy;
  emptyMessage: string;
  onTool: (appId: AppId, name: string, status: string) => void;
}) {
  const [prompt, setPrompt] = useState(app.starter);
  const [lines, setLines] = useState<Line[]>([]);
  const [running, setRunning] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  async function run() {
    if (running) return;
    setRunning(true);
    setLines((prev) => [...prev, { kind: "user", text: prompt }]);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appId: app.id, prompt }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setLines((prev) => [...prev, { kind: "assistant", text: `Error: ${err.error ?? res.status}` }]);
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.replace(/^data:\s*/, "").trim();
          if (!line) continue;
          const event = JSON.parse(line) as {
            type: string;
            text?: string;
            name?: string;
            status?: string;
            result?: unknown;
            message?: string;
          };
          if (event.type === "text" && event.text) {
            setLines((prev) => {
              const last = prev[prev.length - 1];
              if (last?.kind === "assistant") {
                return [...prev.slice(0, -1), { kind: "assistant", text: last.text + event.text }];
              }
              return [...prev, { kind: "assistant", text: event.text! }];
            });
          }
          if (event.type === "tool" && event.name) {
            onTool(app.id, event.name, event.status ?? "running");
            setLines((prev) => [
              ...prev,
              {
                kind: "tool",
                name: event.name!,
                status: event.status ?? "running",
                detail: event.result ? JSON.stringify(event.result).slice(0, 280) : undefined,
              },
            ]);
          }
          if (event.type === "error") {
            setLines((prev) => [...prev, { kind: "assistant", text: event.message ?? "Unknown error" }]);
          }
        }
      }
    } catch (err) {
      setLines((prev) => [
        ...prev,
        { kind: "assistant", text: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="panel agent">
      <h2>
        {app.name}
        <span>{running ? "running" : "idle"}</span>
      </h2>
      <p className="role">{app.role}</p>
      <div className="transcript" ref={scroller}>
        {lines.length === 0 && <div className="msg assistant">{emptyMessage}</div>}
        {lines.map((line, i) =>
          line.kind === "tool" ? (
            <div key={i} className={`tool ${line.status === "completed" ? "ok" : line.status === "error" ? "err" : ""}`}>
              {line.status} {line.name}
              {line.detail ? `\n${line.detail}` : ""}
            </div>
          ) : (
            <div key={i} className={`msg ${line.kind}`}>
              {line.kind === "user" ? "You: " : ""}
              {line.text}
            </div>
          )
        )}
      </div>
      <div className="composer">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <div style={{ display: "grid", gap: 8, alignContent: "end" }}>
          <button className="ghost" type="button" onClick={() => setPrompt(app.starter)} disabled={running}>
            Starter
          </button>
          <button type="button" onClick={run} disabled={running || !prompt.trim()}>
            {running ? "Running…" : "Run agent"}
          </button>
        </div>
      </div>
    </section>
  );
}
