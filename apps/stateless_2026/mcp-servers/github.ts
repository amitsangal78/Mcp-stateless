/**
 * GitHub MCP — July 2026 stateless.
 * No session. Every tool is self-describing.
 * open_pr returns { pr_id }. wait_for_ci / merge_pr / comment_on_pr require it.
 * Any pod can call GitHub. GitHub is the database.
 */
import "./load-env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PORTS, URLS } from "../lib/ports.js";
import { fail, gh, githubRepo, ok, repoPath } from "./gh-rest.js";
import { listenStatelessMcp, type PodId } from "./http-host.js";

function createGithubServer(pod: PodId) {
  const server = new McpServer({ name: "github", version: "2026.7.28" });

  server.registerTool(
    "create_branch",
    {
      description: "Create a git branch. Stateless — no session memory.",
      inputSchema: z.object({
        branch: z.string(),
        fromBranch: z.string().optional(),
      }),
      annotations: { title: "Create branch", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ branch, fromBranch }) => {
      try {
        const info = await gh(repoPath());
        const base = fromBranch || String(info.default_branch);
        const ref = await gh(repoPath(`/git/ref/heads/${base}`));
        const sha = (ref.object as { sha: string }).sha;
        try {
          await gh(repoPath("/git/refs"), {
            method: "POST",
            body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes("422")) throw err;
        }
        return ok({ created: true, branch, from: base, pod });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "open_pr",
    {
      description: "Open a pull request. Returns pr_id — pass that handle to wait_for_ci and merge_pr. No session.",
      inputSchema: z.object({
        title: z.string(),
        head: z.string(),
        base: z.string().optional(),
        body: z.string().optional(),
      }),
      annotations: { title: "Open pull request", readOnlyHint: false, openWorldHint: true },
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
        return ok({
          pr_id: pr.number,
          number: pr.number,
          url: pr.html_url,
          title: pr.title,
          pod,
          note: "Pass pr_id to the next tool. This replica will not remember it.",
        });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "list_pulls",
    {
      description: "List open pull requests. Each row includes pr_id.",
      inputSchema: z.object({}),
      annotations: { title: "List pull requests", readOnlyHint: true, openWorldHint: true },
    },
    async () => {
      try {
        const pulls = (await gh(repoPath("/pulls?state=open&per_page=10"))) as unknown as Array<{
          number: number;
          title: string;
          html_url: string;
        }>;
        return ok({
          pod,
          pulls: pulls.map((pr) => ({ pr_id: pr.number, number: pr.number, title: pr.title, url: pr.html_url })),
        });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "wait_for_ci",
    {
      description: "Check CI for a pull request. Requires pr_id from open_pr. Works on any pod.",
      inputSchema: z.object({
        pr_id: z.number().describe("Pull request number returned by open_pr"),
      }),
      annotations: { title: "Wait for CI", readOnlyHint: true, openWorldHint: true },
    },
    async ({ pr_id }) => {
      try {
        const pr = await gh(repoPath(`/pulls/${pr_id}`));
        const sha = (pr.head as { sha: string }).sha;
        const checks = (await gh(repoPath(`/commits/${sha}/status`))) as {
          state?: string;
          statuses?: Array<{ context: string; state: string }>;
        };
        const state = checks.state ?? "pending";
        return ok({
          pr_id,
          sha,
          conclusion: state === "failure" ? "failure" : "success",
          github_state: state,
          statuses: checks.statuses ?? [],
          pod,
          note: state === "pending" ? "No checks configured — treating as green for the demo." : undefined,
        });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "merge_pr",
    {
      description: "Merge a pull request by pr_id. Destructive. Any pod — GitHub is the source of truth.",
      inputSchema: z.object({
        pr_id: z.number().describe("Pull request number returned by open_pr"),
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
    async ({ pr_id, method }) => {
      try {
        const merged = await gh(repoPath(`/pulls/${pr_id}/merge`), {
          method: "PUT",
          body: JSON.stringify({ merge_method: method ?? "merge" }),
        });
        return ok({ merged: merged.merged, sha: merged.sha, pr_id, pod });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "comment_on_pr",
    {
      description: "Comment on a pull request. Requires pr_id.",
      inputSchema: z.object({
        pr_id: z.number(),
        body: z.string(),
      }),
      annotations: { title: "Comment on PR", readOnlyHint: false, openWorldHint: true },
    },
    async ({ pr_id, body }) => {
      try {
        const comment = await gh(repoPath(`/issues/${pr_id}/comments`), {
          method: "POST",
          body: JSON.stringify({ body }),
        });
        return ok({ id: comment.id, url: comment.html_url, pr_id, pod });
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
          text: JSON.stringify({ owner: githubRepo.owner, repo: githubRepo.repo }, null, 2),
        },
      ],
    })
  );

  return server;
}

void listenStatelessMcp({
  name: "github",
  port: PORTS.github,
  oauthUrl: URLS.oauth,
  createServer: createGithubServer,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
