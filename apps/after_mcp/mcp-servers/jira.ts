/**
 * Jira MCP server — the Jira integration, written once.
 * App 1 and App 2 both call this process. Neither app contains Jira REST code.
 *
 * Primitives:
 *   Tools     create_issue, get_issue, comment_issue
 *   Resources jira://project/{key}
 *   Prompts   incident_ticket_template
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, "");
const email = process.env.JIRA_EMAIL;
const apiToken = process.env.JIRA_API_TOKEN;
const projectKey = process.env.JIRA_PROJECT_KEY;

if (!baseUrl || !email || !apiToken || !projectKey) {
  console.error("jira MCP server missing JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, or JIRA_PROJECT_KEY");
  process.exit(1);
}

const auth = `Basic ${Buffer.from(`${email}:${apiToken}`).toString("base64")}`;

function adf(text: string) {
  return {
    type: "doc",
    version: 1,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

async function jira(path: string, init?: RequestInit) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: auth,
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Jira ${res.status} ${path}: ${JSON.stringify(body)}`);
  }
  return body;
}

function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const server = new McpServer({
  name: "jira",
  version: "1.0.0",
});

server.registerTool(
  "create_issue",
  {
    description: "Create a Jira issue in the configured project. Returns issue key and browse URL.",
    inputSchema: z.object({
      summary: z.string(),
      description: z.string(),
      issuetype: z.string().optional().describe("Task or Bug. Defaults to Task, then Bug."),
    }),
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
                project: { key: projectKey },
                summary,
                description: adf(description),
                issuetype: { name },
              },
            }),
          });
          const key = String(issue.key);
          return ok({ key, id: issue.id, url: `${baseUrl}/browse/${key}`, ticket_id: key });
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
    description: "Read a Jira issue by key.",
    inputSchema: z.object({
      key: z.string().describe("Issue key, e.g. ENG-12"),
    }),
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
  `jira://project/${projectKey}`,
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
        text: JSON.stringify({ projectKey, site: baseUrl }, null, 2),
      },
    ],
  })
);

server.registerPrompt(
  "incident_ticket_template",
  {
    description: "Reusable instructions for filing a production incident in Jira.",
    argsSchema: z.object({
      incident: z.string(),
    }),
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

const transport = new StdioServerTransport();
void server.connect(transport).then(() => {
  console.error(`jira MCP server ready for ${projectKey} at ${baseUrl}`);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
