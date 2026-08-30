/**
 * GitHub MCP server over Streamable HTTP — March 2025.
 * Same tools as after_mcp, plus annotations (read-only / destructive)
 * and a Bearer token check. REST lives here, not in the Next.js apps.
 */
import "./load-env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PORTS, URLS } from "../lib/ports.js";
import { fail, gh, githubRepo, ok, repoPath } from "./gh-rest.js";
import { listenMcpHttp } from "./http-host.js";

function createGithubServer() {
  const server = new McpServer({ name: "github", version: "2025.3.0" });

  server.registerTool(
    "create_branch",
    {
      description: "Create a git branch from the repo default branch (or a given base).",
      inputSchema: z.object({
        branch: z.string().describe("New branch name, e.g. hotfix/timeout"),
        fromBranch: z.string().optional().describe("Base branch. Defaults to the repo default."),
      }),
      annotations: {
        title: "Create branch",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
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
      annotations: {
        title: "Open pull request",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
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
      description: "List open pull requests. Read-only.",
      inputSchema: z.object({}),
      annotations: {
        title: "List pull requests",
        readOnlyHint: true,
        openWorldHint: true,
      },
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
      annotations: {
        title: "Comment on PR",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
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

  server.registerTool(
    "merge_pr",
    {
      description: "Merge a pull request. Destructive — flagged so clients can confirm first.",
      inputSchema: z.object({
        number: z.number().describe("Pull request number"),
        method: z.enum(["merge", "squash", "rebase"]).optional(),
      }),
      annotations: {
        title: "Merge pull request",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ number, method }) => {
      try {
        const merged = await gh(repoPath(`/pulls/${number}/merge`), {
          method: "PUT",
          body: JSON.stringify({ merge_method: method ?? "merge" }),
        });
        return ok({ merged: merged.merged, sha: merged.sha, number });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerResource(
    "repo",
    `repo://${githubRepo.owner}/${githubRepo.repo}`,
    {
      title: "Configured GitHub repository",
      description: "Owner/repo the MCP server is bound to.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              owner: githubRepo.owner,
              repo: githubRepo.repo,
              uri: `https://github.com/${githubRepo.owner}/${githubRepo.repo}`,
            },
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerPrompt(
    "hotfix_pr_description",
    {
      description: "Reusable instructions for drafting a hotfix pull request.",
      argsSchema: {
        incident: z.string().describe("What broke in production"),
      },
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

  return server;
}

void listenMcpHttp({
  name: "github",
  port: PORTS.github,
  oauthUrl: URLS.oauth,
  createServer: createGithubServer,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
