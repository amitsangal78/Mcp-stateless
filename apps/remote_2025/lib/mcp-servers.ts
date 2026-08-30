import { URLS } from "./ports";
import { mintAccessToken } from "./oauth-token";

/**
 * March 2025: both apps point at HTTP URLs, not stdio child processes.
 * The Bearer token is minted by the local OAuth issuer — not a raw GitHub PAT
 * stuffed into the client.
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
