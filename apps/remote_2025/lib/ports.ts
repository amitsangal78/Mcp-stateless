/** March 2025 era — Next.js UI plus three HTTP processes. */
export const PORTS = {
  next: 3002,
  github: 3102,
  jira: 3202,
  oauth: 3302,
} as const;

export const URLS = {
  github: `http://127.0.0.1:${PORTS.github}/mcp`,
  jira: `http://127.0.0.1:${PORTS.jira}/mcp`,
  oauth: `http://127.0.0.1:${PORTS.oauth}`,
} as const;

export const OAUTH_CLIENT = {
  id: "mcp-learning",
  secret: "mcp-learning-secret",
} as const;
