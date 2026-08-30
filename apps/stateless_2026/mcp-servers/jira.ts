/**
 * Jira MCP server — July 2026 stateless.
 * create_issue returns ticket_id. Follow-up tools require it. No session RAM.
 */
import "./load-env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PORTS, URLS } from "../lib/ports.js";
import { adf, fail, jira, jiraCfg, ok } from "./jira-rest.js";
import { listenStatelessMcp, type PodId } from "./http-host.js";

function createJiraServer(pod: PodId) {
  const server = new McpServer({ name: "jira", version: "2026.7.28" });

  server.registerTool(
    "create_issue",
    {
      description: "Create a Jira issue in the configured project. Returns issue key and browse URL.",
      inputSchema: z.object({
        summary: z.string(),
        description: z.string(),
        issuetype: z.string().optional().describe("Task or Bug. Defaults to Task, then Bug."),
      }),
      annotations: {
        title: "Create Jira issue",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ summary, description, issuetype }) => {
      try {
        const types = issuetype ? [issuetype] : ["Task", "Bug", "Story"];
        let lastError: unknown;
        for (const name of types) {
          try {
            const issue = await jira("/rest/api/3/issue", {
              method: "POST",
              body: JSON.stringify({
                fields: {
                  project: { key: jiraCfg.projectKey },
                  summary,
                  description: adf(description),
                  issuetype: { name },
                },
              }),
            });
            const key = String(issue.key);
            return ok({
              ticket_id: key,
              key,
              id: issue.id,
              url: `${jiraCfg.baseUrl}/browse/${key}`,
              pod,
              note: "Pass ticket_id to get_issue / comment_issue. This replica will not remember it.",
            });
          } catch (err) {
            lastError = err;
          }
        }
        throw lastError;
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "get_issue",
    {
      description: "Read a Jira issue by key. Read-only.",
      inputSchema: z.object({
        ticket_id: z.string().describe("Issue key returned as ticket_id by create_issue, e.g. ENG-12"),
      }),
      annotations: {
        title: "Get Jira issue",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ ticket_id }) => {
      try {
        const issue = await jira(`/rest/api/3/issue/${ticket_id}`);
        const fields = issue.fields as { summary?: string; status?: { name?: string } };
        return ok({ ticket_id: issue.key, key: issue.key, summary: fields.summary, status: fields.status?.name, pod });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "comment_issue",
    {
      description: "Add a comment to a Jira issue.",
      inputSchema: z.object({
        ticket_id: z.string().describe("Issue key returned as ticket_id by create_issue"),
        comment: z.string(),
      }),
      annotations: {
        title: "Comment on Jira issue",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ ticket_id, comment }) => {
      try {
        const result = await jira(`/rest/api/3/issue/${ticket_id}/comment`, {
          method: "POST",
          body: JSON.stringify({ body: adf(comment) }),
        });
        return ok({ id: result.id, ticket_id, pod });
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerResource(
    "project",
    `jira://project/${jiraCfg.projectKey}`,
    {
      title: "Configured Jira project",
      description: "Project the MCP server creates issues in.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify({ projectKey: jiraCfg.projectKey, site: jiraCfg.baseUrl }, null, 2),
        },
      ],
    })
  );

  server.registerPrompt(
    "incident_ticket_template",
    {
      description: "Reusable instructions for filing a production incident in Jira.",
      argsSchema: {
        incident: z.string(),
      },
    },
    ({ incident }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `File a Jira incident ticket for:\n\n${incident}\n\nUse a short summary, impact, and next step. Then create the issue with the Jira tools.`,
          },
        },
      ],
    })
  );

  return server;
}

void listenStatelessMcp({
  name: "jira",
  port: PORTS.jira,
  oauthUrl: URLS.oauth,
  createServer: createJiraServer,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
