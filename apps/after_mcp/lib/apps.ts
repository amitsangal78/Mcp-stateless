import type { AppCopy, AppId } from "@mcp-learning/shared";

export const APPS: Record<AppId, AppCopy> = {
  app1: {
    id: "app1",
    name: "App 1 · Coding Agent",
    role: "Same product as before. Now it has zero GitHub/Jira REST code — it talks to the shared MCP servers.",
    starter:
      "Production API is timing out. Using the GitHub and Jira MCP tools: (1) create a branch named hotfix/timeout from the default branch, (2) open a pull request titled \"Hotfix: API timeout\", (3) create a Jira issue for the incident and mention the PR URL. Do not use the shell.",
  },
  app2: {
    id: "app2",
    name: "App 2 · Incident Bot",
    role: "A different AI client. Same MCP servers as App 1. That is the whole bet: write the integration once.",
    starter:
      "File a Jira incident for the production API timeout. Then list open GitHub pull requests and comment on the Jira issue with what you found. Use the GitHub and Jira MCP tools only. Do not use the shell.",
  },
};
