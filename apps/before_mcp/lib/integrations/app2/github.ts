/**
 * App 2's private GitHub connector.
 *
 * Same GitHub REST API as App 1. Different file, different helpers, different
 * error handling. This is what "every AI application needed its own
 * integrations" looks like in a repo.
 */
import { env } from "@mcp-learning/shared/server";

const API = "https://api.github.com";

function headers() {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `token ${env().githubToken}`,
    "User-Agent": "incident-bot-app2",
  };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`App2 GitHub GET ${res.status} ${url}: ${text}`);
  }
  return (await res.json()) as T;
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`App2 GitHub POST ${res.status} ${url}: ${text}`);
  }
  return (await res.json()) as T;
}

function repoUrl(suffix = "") {
  const { githubOwner, githubRepo } = env();
  return `${API}/repos/${githubOwner}/${githubRepo}${suffix}`;
}

export async function listOpenPullRequests() {
  const pulls = await getJson<
    Array<{ number: number; title: string; html_url: string; user: { login: string } }>
  >(`${repoUrl("/pulls")}?state=open&per_page=10`);
  return pulls.map((pr) => ({
    number: pr.number,
    title: pr.title,
    url: pr.html_url,
    author: pr.user.login,
  }));
}

export async function commentOnIssueOrPr(issueNumber: number, body: string) {
  const comment = await postJson<{ id: number; html_url: string }>(
    repoUrl(`/issues/${issueNumber}/comments`),
    { body }
  );
  return { id: comment.id, url: comment.html_url, issueNumber };
}
