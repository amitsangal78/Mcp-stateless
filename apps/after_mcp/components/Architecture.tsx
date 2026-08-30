"use client";

import type { AppId } from "@mcp-learning/shared";

export type Service = "github" | "jira";

export function toolToService(toolName: string): Service | null {
  const name = toolName.toLowerCase();
  if (
    name.includes("github") ||
    name.includes("branch") ||
    name.includes("open_pr") ||
    name.includes("list_pull") ||
    name.includes("comment_on_pr")
  ) {
    return "github";
  }
  if (name.includes("jira") || name.includes("issue") || name.includes("incident") || name.includes("ticket")) {
    return "jira";
  }
  return null;
}

export function Architecture({
  appId,
  service,
}: {
  appId: AppId | null;
  service: Service | null;
}) {
  const app1 = appId === "app1";
  const app2 = appId === "app2";
  const github = service === "github";
  const jira = service === "jira";
  const mcp = Boolean(appId && service);

  return (
    <div className="arch">
      <svg viewBox="0 0 900 280" role="img" aria-label="After MCP: both apps share GitHub and Jira servers">
        <path className={`edge ${app1 ? "hot" : ""}`} d="M170 70 C 260 70, 300 120, 380 140" />
        <path className={`edge ${app2 ? "hot" : ""}`} d="M170 210 C 260 210, 300 160, 380 140" />
        <path className={`edge ${github ? "hot" : ""}`} d="M520 140 C 600 140, 640 70, 730 70" />
        <path className={`edge ${jira ? "hot" : ""}`} d="M520 140 C 600 140, 640 210, 730 210" />

        <text className={`edge-label ${mcp ? "hot" : ""}`} x="250" y="128">
          MCP protocol
        </text>
        <text className={`edge-label ${github ? "hot" : ""}`} x="580" y="88">
          github.ts once
        </text>
        <text className={`edge-label ${jira ? "hot" : ""}`} x="590" y="198">
          jira.ts once
        </text>

        <rect className={`node-box ${app1 ? "hot" : ""}`} x="40" y="42" width="140" height="56" rx="10" />
        <text className="kicker" x="110" y="62" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="110" y="82" textAnchor="middle">
          App 1
        </text>

        <rect className={`node-box ${app2 ? "hot" : ""}`} x="40" y="182" width="140" height="56" rx="10" />
        <text className="kicker" x="110" y="202" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="110" y="222" textAnchor="middle">
          App 2
        </text>

        <rect className={`node-box hub ${mcp ? "hot" : ""}`} x="380" y="112" width="140" height="56" rx="10" />
        <text className="kicker" x="450" y="132" textAnchor="middle" style={{ fill: "#99f6e4" }}>
          write once
        </text>
        <text className="label" x="450" y="152" textAnchor="middle">
          MCP
        </text>

        <rect className={`node-box svc ${github ? "hot" : ""}`} x="730" y="42" width="140" height="56" rx="10" />
        <text className="kicker" x="800" y="62" textAnchor="middle">
          REST API
        </text>
        <text className="label" x="800" y="82" textAnchor="middle">
          GitHub
        </text>

        <rect className={`node-box svc ${jira ? "hot" : ""}`} x="730" y="182" width="140" height="56" rx="10" />
        <text className="kicker" x="800" y="202" textAnchor="middle">
          REST API
        </text>
        <text className="label" x="800" y="222" textAnchor="middle">
          Jira
        </text>
      </svg>
    </div>
  );
}
