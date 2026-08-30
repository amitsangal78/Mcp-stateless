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
    name.includes("wait_for_ci") ||
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
  const hop = Boolean(appId && service);

  return (
    <div className="arch">
      <svg viewBox="0 0 980 300" role="img" aria-label="July 2026: round-robin pods, pr_id in the body, no session">
        <path className={`edge ${app1 ? "hot" : ""}`} d="M150 70 C 220 70, 250 130, 310 150" />
        <path className={`edge ${app2 ? "hot" : ""}`} d="M150 230 C 220 230, 250 170, 310 150" />
        <path className={`edge ${hop ? "hot" : ""}`} d="M450 150 H 530" />
        <path className={`edge ${github ? "hot" : ""}`} d="M670 150 C 720 150, 740 70, 790 70" />
        <path className={`edge ${github ? "hot" : ""}`} d="M670 150 C 720 150, 740 230, 790 230" />
        <path className={`edge ${github ? "hot" : ""}`} d="M910 70 H 960" />
        <path className={`edge ${github ? "hot" : ""}`} d="M910 230 H 960" />
        <path className={`edge ${jira ? "hot" : ""}`} d="M530 150 C 580 150, 620 270, 840 270" />

        <text className={`edge-label ${hop ? "hot" : ""}`} x="188" y="138">
          pr_id in the body
        </text>
        <text className={`edge-label ${github ? "hot" : ""}`} x="690" y="92">
          any pod
        </text>
        <text className={`edge-label ${github ? "hot" : ""}`} x="690" y="208">
          any pod
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

        <rect className={`node-box hub ${hop ? "hot" : ""}`} x="310" y="122" width="140" height="56" rx="10" />
        <text className="kicker" x="380" y="142" textAnchor="middle" style={{ fill: "#99f6e4" }}>
          no session
        </text>
        <text className="label" x="380" y="162" textAnchor="middle">
          HTTP
        </text>

        <rect className={`node-box hub ${hop ? "hot" : ""}`} x="530" y="122" width="140" height="56" rx="10" />
        <text className="kicker" x="600" y="142" textAnchor="middle" style={{ fill: "#99f6e4" }}>
          round-robin
        </text>
        <text className="label" x="600" y="162" textAnchor="middle">
          LB
        </text>

        <rect className={`node-box ${github ? "hot" : ""}`} x="790" y="42" width="120" height="56" rx="10" />
        <text className="kicker" x="850" y="62" textAnchor="middle">
          asks GitHub
        </text>
        <text className="label" x="850" y="82" textAnchor="middle">
          Pod A
        </text>

        <rect className={`node-box ${github ? "hot" : ""}`} x="790" y="202" width="120" height="56" rx="10" />
        <text className="kicker" x="850" y="222" textAnchor="middle">
          asks GitHub
        </text>
        <text className="label" x="850" y="242" textAnchor="middle">
          Pod B
        </text>

        <rect className={`node-box svc ${github ? "hot" : ""}`} x="920" y="42" width="50" height="56" rx="10" />
        <text className="kicker" x="945" y="74" textAnchor="middle">
          GH
        </text>
      </svg>
    </div>
  );
}
