/**
 * Jira MCP server over Streamable HTTP — March 2025.
 * Written once. Both AI clients call this URL. Annotations mark read vs write.
 */
import "./load-env.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { PORTS, URLS } from "../lib/ports.js";
import { adf, fail, jira, jiraCfg, ok } from "./jira-rest.js";
import { listenMcpHttp } from "./http-host.js";

function createJiraServer() {
  const server = new McpServer({ name: "jira", version: "2025.3.0" });

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
            return ok({ key, id: issue.id, url: `${jiraCfg.baseUrl}/browse/${key}`, ticket_id: key });
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
        key: z.string().describe("Issue key, e.g. ENG-12"),
      }),
      annotations: {
        title: "Get Jira issue",
        readOnlyHint: true,
        openWorldHint: true,
      },
    },
    async ({ key }) => {
      try {
        const issue = await jira(`/rest/api/3/issue/${key}`);
        const fields = issue.fields as { summary?: string; status?: { name?: string } };
        return ok({ key: issue.key, summary: fields.summary, status: fields.status?.name });
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
        key: z.string(),
        comment: z.string(),
      }),
      annotations: {
        title: "Comment on Jira issue",
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ key, comment }) => {
      try {
        const result = await jira(`/rest/api/3/issue/${key}/comment`, {
          method: "POST",
          body: JSON.stringify({ body: adf(comment) }),
        });
        return ok({ id: result.id, key });
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

void listenMcpHttp({
  name: "jira",
  port: PORTS.jira,
  oauthUrl: URLS.oauth,
  createServer: createJiraServer,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
