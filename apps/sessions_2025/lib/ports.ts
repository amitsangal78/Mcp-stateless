/** 2025 production — same remote stack, plus a two-pod GitHub farm. */
export const PORTS = {
  next: 3003,
  github: 3103,
  jira: 3203,
  oauth: 3303,
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
