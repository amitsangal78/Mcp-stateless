import * as github from "../integrations/app1/github";
import * as jira from "../integrations/app1/jira";

type CustomTool = {
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
};

/**
 * App 1's tool surface. These functions wrap App 1's private REST clients.
 * App 2 cannot reuse this file — it has its own tools/app2.ts.
 */
export const app1Tools: Record<string, CustomTool> = {
  app1_create_branch: {
    description:
      "App 1 GitHub connector: create a branch from the repo default branch (or a given base).",
    inputSchema: {
      type: "object",
      properties: {
        branch: { type: "string", description: "New branch name, e.g. hotfix/timeout" },
        fromBranch: { type: "string", description: "Optional base branch" },
      },
      required: ["branch"],
    },
    async execute({ branch, fromBranch }) {
      return github.createBranch(String(branch), fromBranch ? String(fromBranch) : undefined);
    },
  },
  app1_open_pr: {
    description: "App 1 GitHub connector: open a pull request.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        head: { type: "string", description: "Head branch name" },
        base: { type: "string" },
        body: { type: "string" },
      },
      required: ["title", "head"],
    },
    async execute({ title, head, base, body }) {
      return github.openPullRequest({
        title: String(title),
        head: String(head),
        base: base ? String(base) : undefined,
        body: body ? String(body) : undefined,
      });
    },
  },
  app1_create_jira_issue: {
    description: "App 1 Jira connector: create an issue in the configured project.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        description: { type: "string" },
      },
      required: ["summary", "description"],
    },
    async execute({ summary, description }) {
      return jira.createIssue(String(summary), String(description));
    },
  },
  app1_get_jira_issue: {
    description: "App 1 Jira connector: read an issue by key.",
    inputSchema: {
      type: "object",
      properties: { key: { type: "string" } },
      required: ["key"],
    },
    async execute({ key }) {
      return jira.getIssue(String(key));
    },
  },
};
