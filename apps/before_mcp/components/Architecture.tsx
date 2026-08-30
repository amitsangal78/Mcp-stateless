"use client";

type EdgeId = "app1-github" | "app1-jira" | "app2-github" | "app2-jira";

export function toolToEdge(toolName: string): EdgeId | null {
  const name = toolName.toLowerCase();
  if (name.includes("app1") && (name.includes("branch") || name.includes("pr") || name.includes("github"))) {
    return "app1-github";
  }
  if (name.includes("app1") && name.includes("jira")) return "app1-jira";
  if (name.includes("app2") && (name.includes("pull") || name.includes("pr") || name.includes("github"))) {
    return "app2-github";
  }
  if (name.includes("app2") && (name.includes("jira") || name.includes("incident"))) return "app2-jira";
  if (name.includes("create_branch") || name.includes("open_pr") || name.includes("list_pull")) return null;
  return null;
}

export function Architecture({ hot }: { hot: EdgeId | null }) {
  const is = (id: EdgeId) => hot === id;
  return (
    <div className="arch">
      <svg viewBox="0 0 900 280" role="img" aria-label="Before MCP spaghetti: four custom connectors">
        <path className={`edge ${is("app1-github") ? "custom" : ""}`} d="M170 70 C 360 70, 520 70, 730 70" />
        <path className={`edge ${is("app1-jira") ? "custom" : ""}`} d="M170 90 C 340 140, 540 190, 730 210" />
        <path className={`edge ${is("app2-github") ? "custom" : ""}`} d="M170 190 C 340 140, 540 90, 730 70" />
        <path className={`edge ${is("app2-jira") ? "custom" : ""}`} d="M170 210 C 360 210, 520 210, 730 210" />

        <text className={`edge-label ${is("app1-github") ? "hot" : ""}`} x="360" y="58">
          app1/github.ts
        </text>
        <text className={`edge-label ${is("app1-jira") ? "hot" : ""}`} x="430" y="150">
          app1/jira.ts
        </text>
        <text className={`edge-label ${is("app2-github") ? "hot" : ""}`} x="250" y="150">
          app2/github.ts
        </text>
        <text className={`edge-label ${is("app2-jira") ? "hot" : ""}`} x="360" y="236">
          app2/jira.ts
        </text>

        <rect className={`node-box ${is("app1-github") || is("app1-jira") ? "hot" : ""}`} x="40" y="42" width="140" height="56" rx="10" />
        <text className="kicker" x="110" y="62" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="110" y="82" textAnchor="middle">
          App 1
        </text>

        <rect className={`node-box ${is("app2-github") || is("app2-jira") ? "hot" : ""}`} x="40" y="182" width="140" height="56" rx="10" />
        <text className="kicker" x="110" y="202" textAnchor="middle">
          AI client
        </text>
        <text className="label" x="110" y="222" textAnchor="middle">
          App 2
        </text>

        <rect className={`node-box svc ${is("app1-github") || is("app2-github") ? "hot" : ""}`} x="730" y="42" width="140" height="56" rx="10" />
        <text className="kicker" x="800" y="62" textAnchor="middle">
          REST API
        </text>
        <text className="label" x="800" y="82" textAnchor="middle">
          GitHub
        </text>

        <rect className={`node-box svc ${is("app1-jira") || is("app2-jira") ? "hot" : ""}`} x="730" y="182" width="140" height="56" rx="10" />
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
