/**
 * App 1's private Jira connector.
 * App 2 reimplements the same REST calls in lib/integrations/app2/jira.ts.
 */
import { env } from "@mcp-learning/shared/server";

function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

async function request(path: string, init?: RequestInit) {
  const { jiraBaseUrl, jiraEmail, jiraApiToken } = env();
  const res = await fetch(`${jiraBaseUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64")}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`App1 Jira ${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body as Record<string, unknown>;
}

export async function createIssue(summary: string, description: string) {
  const { jiraProjectKey, jiraBaseUrl } = env();
  let issue: Record<string, unknown> | undefined;
  let lastError: unknown;
  for (const issuetype of ["Task", "Bug", "Story"]) {
    try {
      issue = await request("/rest/api/3/issue", {
        method: "POST",
        body: JSON.stringify({
          fields: {
            project: { key: jiraProjectKey },
            summary,
            description: adf(description),
            issuetype: { name: issuetype },
          },
        }),
      });
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!issue) throw lastError;
  const key = String(issue.key);
  return { key, url: `${jiraBaseUrl}/browse/${key}`, id: issue.id };
}

export async function getIssue(key: string) {
  const issue = await request(`/rest/api/3/issue/${key}`);
  const fields = issue.fields as { summary?: string; status?: { name?: string } };
  return { key: issue.key, summary: fields.summary, status: fields.status?.name };
}
