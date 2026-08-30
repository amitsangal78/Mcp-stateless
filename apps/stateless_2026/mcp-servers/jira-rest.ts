const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, "");
const email = process.env.JIRA_EMAIL;
const apiToken = process.env.JIRA_API_TOKEN;
const projectKey = process.env.JIRA_PROJECT_KEY;

if (!baseUrl || !email || !apiToken || !projectKey) {
  console.error("jira MCP server missing JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, or JIRA_PROJECT_KEY");
  process.exit(1);
}

export const jiraCfg = { baseUrl, projectKey };

const auth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;

export function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

export async function jira(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: auth,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Jira ${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

export function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
