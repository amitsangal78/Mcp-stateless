import * as github from "../integrations/app2/github";
import * as jira from "../integrations/app2/jira";

type CustomTool = {
  description?: string;
  inputSchema?: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => unknown | Promise<unknown>;
};

/**
 * App 2's tool surface. Different names, different clients, same GitHub + Jira
 * APIs. Four connectors for two apps × two tools.
 */
export const app2Tools: Record<string, CustomTool> = {
  app2_list_pulls: {
    description: "App 2 GitHub connector: list open pull requests in the configured repo.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    async execute() {
      return github.listOpenPullRequests();
    },
  },
  app2_comment_on_pr: {
    description: "App 2 GitHub connector: comment on a pull request / issue by number.",
    inputSchema: {
      type: "object",
      properties: {
        number: { type: "number" },
        body: { type: "string" },
      },
      required: ["number", "body"],
    },
    async execute({ number, body }) {
      return github.commentOnIssueOrPr(Number(number), String(body));
    },
  },
  app2_create_incident: {
    description: "App 2 Jira connector: file an incident-style issue.",
    inputSchema: {
      type: "object",
      properties: {
        summary: { type: "string" },
        details: { type: "string" },
      },
      required: ["summary", "details"],
    },
    async execute({ summary, details }) {
      return jira.createIncident(String(summary), String(details));
    },
  },
  app2_comment_jira: {
    description: "App 2 Jira connector: add a comment to an issue.",
    inputSchema: {
      type: "object",
      properties: {
        issueKey: { type: "string" },
        comment: { type: "string" },
      },
      required: ["issueKey", "comment"],
    },
    async execute({ issueKey, comment }) {
      return jira.addComment(String(issueKey), String(comment));
    },
  },
};
