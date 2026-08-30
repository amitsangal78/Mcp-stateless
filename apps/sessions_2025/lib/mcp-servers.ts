import { URLS } from "./ports";
import { mintAccessToken } from "./oauth-token";

/**
 * Same HTTP + OAuth map as remote_2025. The GitHub URL now hides two pods.
 * Clients still send Mcp-Session-Id. They cannot see that merge will hop pods.
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
