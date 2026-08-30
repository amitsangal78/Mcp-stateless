/** July 2026 — stateless core. Same ports pattern, no session fabric. */
export const PORTS = {
  next: 3004,
  github: 3104,
  jira: 3204,
  oauth: 3304,
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
