/**
 * GitHub MCP server — the GitHub integration, written once.
 * App 1 and App 2 both call this process. Neither app contains GitHub REST code.
 *
 * Primitives:
 *   Tools     create_branch, open_pr, list_pulls, comment_on_pr
 *   Resources repo://current
 *   Prompts   hotfix_pr_description
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;

if (!token || !owner || !repo) {
  console.error("github MCP server missing GITHUB_TOKEN, GITHUB_OWNER, or GITHUB_REPO");
  process.exit(1);
}

type Json = Record<string, unknown>;

async function gh(path: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "mcp-learning-github-server",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) {
    throw new Error(`GitHub ${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

function repoPath(suffix = "") {
  return `/repos/${owner}/${repo}${suffix}`;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const server = new McpServer({
  name: "github",
  version: "1.0.0",
});

server.registerTool(
  "create_branch",
  {
    description: "Create a git branch from the repo default branch (or a given base).",
    inputSchema: z.object({
      branch: z.string().describe("New branch name, e.g. hotfix/timeout"),
      fromBranch: z.string().optional().describe("Base branch. Defaults to the repo default."),
    }),
  },
  async ({ branch, fromBranch }) => {
    try {
      const info = await gh(repoPath());
      const base = fromBranch || String(info.default_branch);
      const ref = await gh(repoPath(`/git/ref/heads/${base}`));
      const sha = (ref.object as { sha: string }).sha;
      try {
        const created = await gh(repoPath("/git/refs"), {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
        });
        return ok({ created: true, branch, sha, ref: created.ref, from: base });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("422")) {
          return ok({ created: false, branch, from: base, note: "branch already exists" });
        }
        throw err;
      }
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "open_pr",
  {
    description: "Open a pull request in the configured GitHub repo.",
    inputSchema: z.object({
      title: z.string(),
      head: z.string().describe("Head branch"),
      base: z.string().optional(),
      body: z.string().optional(),
    }),
  },
  async ({ title, head, base, body }) => {
    try {
      const info = await gh(repoPath());
      const pr = await gh(repoPath("/pulls"), {
        method: "POST",
        body: JSON.stringify({
          title,
          head,
          base: base || String(info.default_branch),
          body: body ?? "",
        }),
      });
      return ok({ number: pr.number, url: pr.html_url, title: pr.title, pr_id: pr.number });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "list_pulls",
  {
    description: "List open pull requests.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const pulls = (await gh(repoPath("/pulls?state=open&per_page=10"))) as unknown as Array<{
        number: number;
        title: string;
        html_url: string;
        user: { login: string };
      }>;
      return ok(
        pulls.map((pr) => ({
          number: pr.number,
          title: pr.title,
          url: pr.html_url,
          author: pr.user.login,
        }))
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "comment_on_pr",
  {
    description: "Comment on a pull request by number.",
    inputSchema: z.object({
      number: z.number(),
      body: z.string(),
    }),
  },
  async ({ number, body }) => {
    try {
      const comment = await gh(repoPath(`/issues/${number}/comments`), {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      return ok({ id: comment.id, url: comment.html_url, number });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerResource(
  "repo",
  `repo://${owner}/${repo}`,
  {
    title: "Configured GitHub repository",
    description: "Owner/repo the MCP server is bound to. Read-only context for the model.",
    mimeType: "application/json",
  },
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify({ owner, repo, uri: `https://github.com/${owner}/${repo}` }, null, 2),
      },
    ],
  })
);

server.registerPrompt(
  "hotfix_pr_description",
  {
    description: "Reusable instructions for drafting a hotfix pull request.",
    argsSchema: z.object({
      incident: z.string().describe("What broke in production"),
    }),
  },
  ({ incident }) => ({
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: `Draft a short hotfix PR description for this production incident:\n\n${incident}\n\nInclude: what broke, the branch name you would use, and a test plan.`,
        },
      },
    ],
  })
);

const transport = new StdioServerTransport();
void server.connect(transport).then(() => {
  console.error(`github MCP server ready for ${owner}/${repo}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
