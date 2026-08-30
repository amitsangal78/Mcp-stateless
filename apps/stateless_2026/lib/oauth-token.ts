import { OAUTH_CLIENT, URLS } from "./ports";

export async function mintAccessToken() {
  const res = await fetch(`${URLS.oauth}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: OAUTH_CLIENT.id,
      client_secret: OAUTH_CLIENT.secret,
    }),
  });
  const body = (await res.json()) as { access_token?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`OAuth token failed: ${body.error ?? res.status}. Is npm run dev:remote up?`);
  }
  return body.access_token;
}
