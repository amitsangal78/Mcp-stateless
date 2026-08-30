/**
 * GitHub MCP — 2025 production.
 * open_pr remembers the PR on the session (Pod A RAM).
 * merge_pr / wait_for_ci take NO pr_id. They expect that session.
 * The load balancer sends those two tools to Pod B. Merge dies.
 */
import "./load-env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PORTS, URLS } from "../lib/ports.js";
import { fail, gh, githubRepo, ok, repoPath } from "./gh-rest.js";
import { listenGithubPods, pods } from "./github-pods.js";

function mem(sessionId: string | undefined) {
  if (!sessionId) return undefined;
  return pods.A.memory.get(sessionId) ?? pods.B.memory.get(sessionId);
}

function createGithubServer() {
  const server = new McpServer({ name: "github", version: "2025.11.0" });

  server.registerTool(
    "create_branch",
    {
      description: "Create a git branch. Stores the branch name on this MCP session (Pod A memory).",
      inputSchema: z.object({
        branch: z.string(),
        fromBranch: z.string().optional(),
      }),
      annotations: { title: "Create branch", readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async ({ branch, fromBranch }, extra) => {
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
        const slot = mem(extra.sessionId);
        if (slot) slot.currentBranch = branch;
        return ok({ created: true, branch, from: base, pod: "A", session: extra.sessionId, stored_on: "session.currentBranch" });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "open_pr",
    {
      description: "Open a pull request and stash the number on this MCP session. merge_pr will read it later — do not pass pr_id.",
      inputSchema: z.object({
        title: z.string(),
        head: z.string(),
        base: z.string().optional(),
        body: z.string().optional(),
      }),
      annotations: { title: "Open pull request", readOnlyHint: false, openWorldHint: true },
    },
    async ({ title, head, base, body }, extra) => {
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
        const number = Number(pr.number);
        const slot = mem(extra.sessionId);
        if (slot) slot.currentPr = number;
        return ok({
          number,
          url: pr.html_url,
          title: pr.title,
          pod: "A",
          session: extra.sessionId,
          stored_on: "session.currentPr — not returned as a handle the next pod can use",
        });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "list_pulls",
    {
      description: "List open pull requests. Read-only. Stays on Pod A.",
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
        return ok(pulls.map((pr) => ({ number: pr.number, title: pr.title, url: pr.html_url, pod: "A" })));
      } catch (err) {
        return fail(err);
      }
    }
  );

  // Note: in this demo, github-pods.ts fakes "SESSION NOT FOUND" for
  // wait_for_ci/merge_pr at the HTTP layer before a request ever reaches
  // these handlers, so the fail() branches below never actually execute —
  // they document the real-world failure, they don't produce it here.
  server.registerTool(
    "wait_for_ci",
    {
      description: "Wait for CI on the PR stored in this session. Takes no pr_id — that is the bug.",
      inputSchema: z.object({}),
      annotations: { title: "Wait for CI", readOnlyHint: true, openWorldHint: true },
    },
    async (_args, extra) => {
      const slot = mem(extra.sessionId);
      if (!slot?.currentPr) {
        return fail("This pod has no session.currentPr. wait_for_ci has no pr_id argument.");
      }
      return ok({ pr: slot.currentPr, conclusion: "success", pod: "A" });
    }
  );

  server.registerTool(
    "merge_pr",
    {
      description: "Merge the PR stored on this MCP session. No pr_id argument — the server is supposed to remember.",
      inputSchema: z.object({}),
      annotations: {
        title: "Merge pull request",
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
      },
    },
    async (_args, extra) => {
      const slot = mem(extra.sessionId);
      if (!slot?.currentPr) {
        return fail("This pod has no session.currentPr. merge_pr has no pr_id argument.");
      }
      try {
        const merged = await gh(repoPath(`/pulls/${slot.currentPr}/merge`), {
          method: "PUT",
          body: JSON.stringify({ merge_method: "merge" }),
        });
        return ok({ merged: merged.merged, sha: merged.sha, number: slot.currentPr, pod: "A" });
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

void listenGithubPods({
  port: PORTS.github,
  oauthUrl: URLS.oauth,
  createServer: createGithubServer,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
