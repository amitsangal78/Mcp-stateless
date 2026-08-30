/**
 * App 1's private GitHub connector.
 * Written for the coding agent. App 2 has a SEPARATE copy at
 * lib/integrations/app2/github.ts — that is the N × M problem.
 */
import { env } from "@mcp-learning/shared/server";

type GitHubJson = Record<string, unknown>;

async function request(path: string, init?: RequestInit): Promise<GitHubJson> {
  const { githubToken } = env();
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${githubToken}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as GitHubJson;
  if (!res.ok) {
    throw new Error(`App1 GitHub ${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

function repoPath() {
  const { githubOwner, githubRepo } = env();
  return `/repos/${githubOwner}/${githubRepo}`;
}

export async function createBranch(branch: string, fromBranch?: string) {
  console.log("createBranch", branch, fromBranch);
  const repo = await request(repoPath());
  const base = fromBranch || String(repo.default_branch);
  const ref = await request(`${repoPath()}/git/ref/heads/${base}`);
  console.log("ref", ref);
  const sha = (ref.object as { sha: string }).sha;

  try {
    const created = await request(`${repoPath()}/git/refs`, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
    });
    return { created: true, branch, sha, ref: created.ref, from: base };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("422")) {
      return { created: false, branch, from: base, note: "branch already exists" };
    }
    throw err;
  }
}

export async function openPullRequest(input: {
  title: string;
  head: string;
  base?: string;
  body?: string;
}) {
  const repo = await request(repoPath());
  const pr = await request(`${repoPath()}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: input.title,
      head: input.head,
      base: input.base || String(repo.default_branch),
      body: input.body ?? "",
    }),
  });
  return {
    number: pr.number,
    url: pr.html_url,
    title: pr.title,
    head: input.head,
  };
}
