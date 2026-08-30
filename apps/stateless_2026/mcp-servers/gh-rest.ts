type Json = Record<string, unknown>;

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

if (!token || !owner || !repo) {
  console.error("github MCP server missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO");
  process.exit(1);
}

export const githubRepo = { owner, repo };

export async function gh(path: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "mcp-learning-stateless-2026",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

export function repoPath(suffix = "") {
  return `/repos/${owner}/${repo}${suffix}`;
}

export function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

export function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}
