import type { AppCopy, AppId } from "@mcp-learning/shared";

export const APPS: Record<AppId, AppCopy> = {
  app1: {
    id: "app1",
    name: "App 1 · Coding Agent",
    role: "Ships the hotfix including merge. open_pr sticks on Pod A. merge_pr is load-balanced to Pod B.",
    starter:
      "Production API is timing out. Using the GitHub and Jira MCP tools only (no shell): (1) create a branch named hotfix/timeout, (2) open a pull request titled \"Hotfix: API timeout\", (3) wait for CI, (4) merge the pull request using merge_pr — do not pass a PR number, the session should remember it, (5) file a Jira incident that mentions what happened.",
  },
  app2: {
    id: "app2",
    name: "App 2 · Incident Bot",
    role: "Same remote GitHub farm. If it waits for CI or merges, it hits Pod B too.",
    starter:
      "File a Jira incident for the production API timeout. Then list open GitHub pull requests. If you see the hotfix PR, wait for CI and merge it with merge_pr (no PR number — use the session). Use MCP tools only. Do not use the shell.",
  },
};
