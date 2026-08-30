import { URLS } from "./ports";
import { mintAccessToken } from "./oauth-token";

/**
 * Same HTTP + OAuth URLs as 2025. The servers no longer mint Mcp-Session-Id.
 * Continuity is pr_id / ticket_id in the tool result — not a sticky cookie.
 */
export async function sharedMcpServers() {
  const accessToken = await mintAccessToken();
  const headers = { Authorization: `Bearer ${accessToken}` };

  return {
    github: {
      type: "http" as const,
      url: URLS.github,
      headers,
    },
    jira: {
      type: "http" as const,
      url: URLS.jira,
      headers,
    },
  };
}
