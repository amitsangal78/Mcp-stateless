"use client";

import type { AppId } from "@mcp-learning/shared";

export type Service = "github" | "jira" | "oauth";

export function toolToService(toolName: string): Service | null {
  const name = toolName.toLowerCase();
  if (name.includes("oauth") || name.includes("token")) return "oauth";
  if (
    name.includes("github") ||
    name.includes("branch") ||
    name.includes("open_pr") ||
    name.includes("list_pull") ||
    name.includes("comment_on_pr") ||
    name.includes("merge_pr")
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
  const remote = Boolean(appId && service);

  return (
    <div className="arch">
      <svg viewBox="0 0 980 280" role="img" aria-label="March 2025: OAuth plus Streamable HTTP to shared GitHub and Jira servers">
        <path className={`edge ${app1 ? "hot" : ""}`} d="M160 70 C 230 70, 250 120, 310 140" />
        <path className={`edge ${app2 ? "hot" : ""}`} d="M160 210 C 230 210, 250 160, 310 140" />
        <path className={`edge ${remote ? "hot" : ""}`} d="M450 140 C 500 140, 520 140, 560 140" />
        <path className={`edge ${github ? "hot" : ""}`} d="M700 140 C 760 140, 790 70, 840 70" />
        <path className={`edge ${jira ? "hot" : ""}`} d="M700 140 C 760 140, 790 210, 840 210" />

        <text className={`edge-label ${remote ? "hot" : ""}`} x="210" y="128">
          OAuth bearer
        </text>
        <text className={`edge-label ${remote ? "hot" : ""}`} x="470" y="122">
          Streamable HTTP
        </text>
        <text className={`edge-label ${github ? "hot" : ""}`} x="740" y="88">
          github.ts once
        </text>
        <text className={`edge-label ${jira ? "hot" : ""}`} x="750" y="198">
          jira.ts once
        </text>

        <rect className={`node-box ${app1 ? "hot" : ""}`} x="30" y="42" width="130" height="56" rx="10" />
        <text className="kicker" x="95" y="62" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="95" y="82" textAnchor="middle">
          App 1
        </text>

        <rect className={`node-box ${app2 ? "hot" : ""}`} x="30" y="182" width="130" height="56" rx="10" />
        <text className="kicker" x="95" y="202" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="95" y="222" textAnchor="middle">
          App 2
        </text>

        <rect className={`node-box hub ${remote ? "hot" : ""}`} x="310" y="112" width="140" height="56" rx="10" />
        <text className="kicker" x="380" y="132" textAnchor="middle" style={{ fill: "#99f6e4" }}>
          lock
        </text>
        <text className="label" x="380" y="152" textAnchor="middle">
          OAuth 2.1
        </text>

        <rect className={`node-box hub ${remote ? "hot" : ""}`} x="560" y="112" width="140" height="56" rx="10" />
        <text className="kicker" x="630" y="132" textAnchor="middle" style={{ fill: "#99f6e4" }}>
          remote URL
        </text>
        <text className="label" x="630" y="152" textAnchor="middle">
          MCP HTTP
        </text>

        <rect className={`node-box svc ${github ? "hot" : ""}`} x="840" y="42" width="120" height="56" rx="10" />
        <text className="kicker" x="900" y="62" textAnchor="middle">
          REST API
        </text>
        <text className="label" x="900" y="82" textAnchor="middle">
          GitHub
        </text>

        <rect className={`node-box svc ${jira ? "hot" : ""}`} x="840" y="182" width="120" height="56" rx="10" />
        <text className="kicker" x="900" y="202" textAnchor="middle">
          REST API
        </text>
        <text className="label" x="900" y="222" textAnchor="middle">
          Jira
        </text>
      </svg>
    </div>
  );
}
