import path from "node:path";
import { createRequire } from "node:module";
import { childEnv, env } from "@mcp-learning/shared/server";

const require = createRequire(import.meta.url);

/**
 * THE shared MCP map. App 1 and App 2 both pass this object into Agent.create.
 * GitHub REST lives in mcp-servers/github.ts. Jira REST lives in mcp-servers/jira.ts.
 * Clients do not import those files.
 */
export function sharedMcpServers() {
  const cfg = env();
  const tsx = path.join(path.dirname(require.resolve("tsx/package.json")), "dist/cli.mjs");
  const serversDir = path.join(process.cwd(), "mcp-servers");

  return {
    github: {
      type: "stdio" as const,
      command: process.execPath,
      args: [tsx, path.join(serversDir, "github.ts")],
      cwd: process.cwd(),
      env: childEnv({
        GITHUB_TOKEN: cfg.githubToken,
        GITHUB_OWNER: cfg.githubOwner,
        GITHUB_REPO: cfg.githubRepo,
      }),
    },
    jira: {
      type: "stdio" as const,
      command: process.execPath,
      args: [tsx, path.join(serversDir, "jira.ts")],
      cwd: process.cwd(),
      env: childEnv({
        JIRA_BASE_URL: cfg.jiraBaseUrl,
        JIRA_EMAIL: cfg.jiraEmail,
        JIRA_API_TOKEN: cfg.jiraApiToken,
        JIRA_PROJECT_KEY: cfg.jiraProjectKey,
      }),
    },
  };
}
