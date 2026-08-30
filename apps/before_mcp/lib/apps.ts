import type { AppCopy, AppId } from "@mcp-learning/shared";

export const APPS: Record<AppId, AppCopy> = {
  app1: {
    id: "app1",
    name: "App 1 · Coding Agent",
    role: "Ships a GitHub hotfix, then files a Jira ticket. Uses App 1's private GitHub + Jira connectors.",
    starter:
      "Production API is timing out. Using only the provided tools: (1) create a GitHub branch named hotfix/timeout from the default branch, (2) open a pull request titled \"Hotfix: API timeout\" with a short incident description, (3) create a Jira ticket for the same incident and mention the PR URL in the description. Do not use the shell.",
  },
  app2: {
    id: "app2",
    name: "App 2 · Incident Bot",
    role: "Files a Jira incident, then looks up GitHub PRs. Uses App 2's private GitHub + Jira connectors — a second copy of the same APIs.",
    starter:
      "File a Jira incident for the production API timeout. Then list open GitHub pull requests in this repo and add a Jira comment with what you found. Use only the provided tools. Do not use the shell.",
  },
};
