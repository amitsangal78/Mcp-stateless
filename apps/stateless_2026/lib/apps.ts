import type { AppCopy, AppId } from "@mcp-learning/shared";

export const APPS: Record<AppId, AppCopy> = {
  app1: {
    id: "app1",
    name: "App 1 · Coding Agent",
    role: "Same hotfix. open_pr returns pr_id. wait_for_ci and merge_pr take that handle. Any pod works.",
    starter:
      "Production API is timing out. Using GitHub and Jira MCP tools only (no shell): (1) create branch hotfix/timeout, (2) open a PR titled \"Hotfix: API timeout\" and read pr_id from the tool result, (3) wait_for_ci with that pr_id, (4) merge_pr with that pr_id, (5) create a Jira issue and pass ticket_id if you comment. Do not rely on a session.",
  },
  app2: {
    id: "app2",
    name: "App 2 · Incident Bot",
    role: "Different client, same stateless servers. list_pulls returns pr_id on every row.",
    starter:
      "File a Jira incident for the production API timeout (keep ticket_id). List open GitHub pull requests and comment on the Jira issue with the pr_id values you found. Use MCP tools only. Do not use the shell.",
  },
};
