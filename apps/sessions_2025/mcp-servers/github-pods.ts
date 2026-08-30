/**
 * Two in-memory GitHub MCP pods behind one port.
 *
 * initialize + ordinary tools → Pod A (sticky).
 * wait_for_ci / merge_pr     → Pod B (rolling deploy).
 *
 * Pod B never minted the session, so merge dies. That is the 2025 production bug.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type SessionMemory = {
  currentPr?: number;
  currentBranch?: string;
};

type PodId = "A" | "B";

type Pod = {
  id: PodId;
  transports: Map<string, StreamableHTTPServerTransport>;
  memory: Map<string, SessionMemory>;
};

// Tools routed to Pod B are faked at this HTTP layer, below, before any
// transport.handleRequest() call — the registered merge_pr/wait_for_ci
// handlers in github.ts never actually run for these calls. That keeps the
// "session not found" message consistent without needing a second live
// server process for Pod B.
const CROSS_POD_TOOLS = new Set(["merge_pr", "wait_for_ci"]);

export const pods: Record<PodId, Pod> = {
  A: { id: "A", transports: new Map(), memory: new Map() },
  B: { id: "B", transports: new Map(), memory: new Map() },
};

export const lastRoute: { tool?: string; pod: PodId; lost: boolean } = {
  pod: "A",
  lost: false,
};

function toolNameFromBody(body: unknown): string | undefined {
  const msg = (Array.isArray(body) ? body[0] : body) as
    | { method?: string; params?: { name?: string } }
    | undefined;
  if (msg?.method === "tools/call") return msg.params?.name;
  return undefined;
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (!chunks.length) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res: ServerResponse, status: number, body: unknown, extra?: Record<string, string>) {
  res.writeHead(status, { "Content-Type": "application/json", ...extra });
  res.end(JSON.stringify(body));
}

export async function listenGithubPods(opts: {
  port: number;
  oauthUrl: string;
  createServer: () => McpServer;
}) {
  async function authorized(req: IncomingMessage, res: ServerResponse) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      send(res, 401, { error: "invalid_token" });
      return false;
    }
    const introspect = await fetch(`${opts.oauthUrl}/introspect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: header.slice(7) }),
    });
    if (!introspect.ok) {
      send(res, 401, { error: "invalid_token" });
      return false;
    }
    return true;
  }

  const http = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${opts.port}`);

    if (url.pathname === "/health") {
      send(res, 200, {
        ok: true,
        name: "github",
        pods: {
          A: { sessions: pods.A.transports.size, memory: [...pods.A.memory.entries()] },
          B: { sessions: pods.B.transports.size, memory: [...pods.B.memory.entries()] },
        },
        lastRoute,
      });
      return;
    }

    if (url.pathname !== "/mcp") {
      send(res, 404, { error: "not_found" });
      return;
    }
    if (!(await authorized(req, res))) return;

    try {
      const body = req.method === "POST" ? await readJson(req) : undefined;
      const sessionId = typeof req.headers["mcp-session-id"] === "string" ? req.headers["mcp-session-id"] : undefined;
      const tool = toolNameFromBody(body);
      const crossPod = Boolean(tool && CROSS_POD_TOOLS.has(tool));

      if (req.method === "POST" && isInitializeRequest(body)) {
        let transport: StreamableHTTPServerTransport;
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            pods.A.transports.set(id, transport);
            pods.A.memory.set(id, {});
            lastRoute.pod = "A";
            lastRoute.lost = false;
            lastRoute.tool = "initialize";
            console.error(`Pod A minted Mcp-Session-Id ${id}`);
          },
          onsessionclosed: (id) => {
            pods.A.transports.delete(id);
            pods.A.memory.delete(id);
          },
        });
        await opts.createServer().connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      if (crossPod) {
        lastRoute.pod = "B";
        lastRoute.lost = true;
        lastRoute.tool = tool;
        console.error(`LB routed ${tool} to Pod B — session ${sessionId ?? "(none)"} not on this replica`);
        send(
          res,
          404,
          {
            jsonrpc: "2.0",
            error: {
              code: -32000,
              message: [
                "SESSION NOT FOUND on Pod B.",
                `Mcp-Session-Id ${sessionId ?? "(missing)"} was minted on Pod A.`,
                "This replica has no current_pr in memory.",
                "GitHub still has the pull request — the protocol lost it.",
                "That is why sticky sessions (or Redis) get bolted on — and why 2026 deletes the session.",
              ].join(" "),
            },
            id: null,
            pod: "B",
          },
          { "Mcp-Pod": "B", "X-Demo-Session-Lost": "1" }
        );
        return;
      }

      const existing = sessionId ? pods.A.transports.get(sessionId) : undefined;
      if (existing) {
        lastRoute.pod = "A";
        lastRoute.lost = false;
        lastRoute.tool = tool;
        await existing.handleRequest(req, res, body);
        return;
      }

      send(res, sessionId ? 404 : 400, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: sessionId ? `Unknown Mcp-Session-Id ${sessionId} on Pod A` : "Missing Mcp-Session-Id",
        },
        id: null,
      });
    } catch (err) {
      if (!res.headersSent) {
        send(res, 500, {
          jsonrpc: "2.0",
          error: { code: -32603, message: err instanceof Error ? err.message : String(err) },
          id: null,
        });
      }
    }
  });

  await new Promise<void>((resolve) => http.listen(opts.port, "127.0.0.1", resolve));
  console.error(`github pods A+B on http://127.0.0.1:${opts.port}/mcp (merge/wait_for_ci → Pod B)`);
}
