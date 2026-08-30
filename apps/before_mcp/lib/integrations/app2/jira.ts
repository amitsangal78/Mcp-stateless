/**
 * App 2's private Jira connector.
 *
 * Same Atlassian REST API as App 1. Second implementation, second auth helper,
 * second place that breaks when Jira changes a field.
 */
import { env } from "@mcp-learning/shared/server";

function basicAuth() {
  const { jiraEmail, jiraApiToken } = env();
  return `Basic ${Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64")}`;
}

function toDoc(paragraphs: string[]) {
  return {
    type: "doc",
    version: 1,
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

async function jira<T>(method: string, path: string, body?: unknown): Promise<T> {
  const { jiraBaseUrl } = env();
  const res = await fetch(`${jiraBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: basicAuth(),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { errorMessages?: string[] };
  if (!res.ok) {
    throw new Error(`App2 Jira ${res.status} ${path}: ${JSON.stringify(json)}`);
  }
  return json;
}

export async function createIncident(summary: string, details: string) {
  const { jiraProjectKey, jiraBaseUrl } = env();
  const payload = (issuetype: string) => ({
    fields: {
      project: { key: jiraProjectKey },
      summary: `[INCIDENT] ${summary}`,
      description: toDoc([details]),
      issuetype: { name: issuetype },
    },
  });
  let created: { key: string; id: string };
  try {
    created = await jira<{ key: string; id: string }>("POST", "/rest/api/3/issue", payload("Bug"));
  } catch {
    created = await jira<{ key: string; id: string }>("POST", "/rest/api/3/issue", payload("Task"));
  }
  return {
    key: created.key,
    id: created.id,
    browseUrl: `${jiraBaseUrl}/browse/${created.key}`,
  };
}

export async function addComment(issueKey: string, comment: string) {
  const result = await jira<{ id: string }>("POST", `/rest/api/3/issue/${issueKey}/comment`, {
    body: toDoc([comment]),
  });
  return { id: result.id, issueKey };
}
