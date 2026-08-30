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
    name.includes("merge_pr") ||
    name.includes("wait_for_ci")
  ) {
    return "github";
  }
  if (name.includes("jira") || name.includes("issue") || name.includes("incident") || name.includes("ticket")) {
    return "jira";
  }
  return null;
}

export function isCrossPodTool(toolName: string) {
  const name = toolName.toLowerCase();
  return name.includes("merge_pr") || name.includes("wait_for_ci");
}

export function Architecture({
  appId,
  service,
  sessionLost,
}: {
  appId: AppId | null;
  service: Service | null;
  sessionLost: boolean;
}) {
  const app1 = appId === "app1";
  const app2 = appId === "app2";
  const github = service === "github";
  const jira = service === "jira";
  const podA = github && !sessionLost;
  const podB = sessionLost;

  return (
    <div className="arch">
      <svg viewBox="0 0 980 300" role="img" aria-label="2025 production: sticky session on Pod A, merge dies on Pod B">
        <path className={`edge ${app1 ? "hot" : ""}`} d="M150 70 C 220 70, 250 130, 310 150" />
        <path className={`edge ${app2 ? "hot" : ""}`} d="M150 230 C 220 230, 250 170, 310 150" />
        <path className={`edge ${github || jira ? "hot" : ""}`} d="M450 150 H 530" />
        <path className={`edge ${podA ? "hot" : ""}`} d="M670 150 C 720 150, 740 70, 790 70" />
        <path className={`edge ${podB ? "dead" : ""}`} d="M670 150 C 720 150, 740 230, 790 230" />
        <path className={`edge ${github && !sessionLost ? "hot" : ""}`} d="M910 70 H 960" />
        <path className={`edge ${jira ? "hot" : ""}`} d="M530 150 C 580 150, 620 260, 840 260" />

        <text className={`edge-label ${github || jira ? "hot" : ""}`} x="200" y="138">
          Mcp-Session-Id
        </text>
        <text className={`edge-label ${podA ? "hot" : ""}`} x="700" y="92">
          sticky → A
        </text>
        <text className={`edge-label ${podB ? "dead" : ""}`} x="688" y="208">
          merge → B
        </text>

        <rect className={`node-box ${app1 ? "hot" : ""}`} x="20" y="42" width="130" height="56" rx="10" />
        <text className="kicker" x="85" y="62" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="85" y="82" textAnchor="middle">
          App 1
        </text>

        <rect className={`node-box ${app2 ? "hot" : ""}`} x="20" y="202" width="130" height="56" rx="10" />
        <text className="kicker" x="85" y="222" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="85" y="242" textAnchor="middle">
          App 2
        </text>

        <rect className={`node-box hub ${github || jira ? "hot" : ""}`} x="310" y="122" width="140" height="56" rx="10" />
        <text className="kicker" x="380" y="142" textAnchor="middle" style={{ fill: "#99f6e4" }}>
          HTTP + OAuth
        </text>
        <text className="label" x="380" y="162" textAnchor="middle">
          Client
        </text>

        <rect className={`node-box hub ${github || jira ? "hot" : ""}`} x="530" y="122" width="140" height="56" rx="10" />
        <text className="kicker" x="600" y="142" textAnchor="middle" style={{ fill: "#99f6e4" }}>
          load balancer
        </text>
        <text className="label" x="600" y="162" textAnchor="middle">
          LB
        </text>

        <rect className={`node-box ${podA ? "hot" : ""}`} x="790" y="42" width="120" height="56" rx="10" />
        <text className="kicker" x="850" y="62" textAnchor="middle">
          session RAM
        </text>
        <text className="label" x="850" y="82" textAnchor="middle">
          Pod A
        </text>

        <rect className={`node-box ${podB ? "dead" : ""}`} x="790" y="202" width="120" height="56" rx="10" />
        <text className="kicker" x="850" y="222" textAnchor="middle">
          empty
        </text>
        <text className="label" x="850" y="242" textAnchor="middle">
          Pod B
        </text>

        <rect className={`node-box svc ${github ? "hot" : ""}`} x="920" y="42" width="50" height="56" rx="10" />
        <text className="kicker" x="945" y="74" textAnchor="middle">
          GH
        </text>

        {podB ? (
          <text className="edge-label dead" x="790" y="278">
            SESSION NOT FOUND
          </text>
        ) : null}
      </svg>
    </div>
  );
}
