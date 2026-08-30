/**
 * Streamable HTTP host — March 2025 transport.
 * One process, one in-memory session map, Bearer token from the local OAuth issuer.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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

export async function listenMcpHttp(opts: {
  name: string;
  port: number;
  oauthUrl: string;
  createServer: () => McpServer;
}) {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  async function authorized(req: IncomingMessage, res: ServerResponse) {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      send(res, 401, { error: "invalid_token" }, {
        "WWW-Authenticate": `Bearer realm="${opts.name}", error="invalid_token"`,
      });
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
      send(res, 200, { ok: true, name: opts.name, transport: "streamable-http", sessions: transports.size });
      return;
    }

    if (url.pathname !== "/mcp") {
      send(res, 404, { error: "not_found" });
      return;
    }

    if (!(await authorized(req, res))) return;

    try {
      const body = req.method === "POST" ? await readJson(req) : undefined;
      const sessionId = req.headers["mcp-session-id"];
      const existing = typeof sessionId === "string" ? transports.get(sessionId) : undefined;

      if (existing) {
        await existing.handleRequest(req, res, body);
        return;
      }

      if (req.method === "POST" && isInitializeRequest(body)) {
        let transport: StreamableHTTPServerTransport;
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (id) => {
            transports.set(id, transport);
            console.error(`${opts.name} minted Mcp-Session-Id ${id}`);
          },
          onsessionclosed: (id) => {
            transports.delete(id);
          },
        });
        const server = opts.createServer();
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      send(res, existing === undefined && sessionId ? 404 : 400, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: sessionId
            ? `Unknown Mcp-Session-Id ${sessionId}`
            : "Missing Mcp-Session-Id (initialize first)",
        },
        id: null,
      });
    } catch (err) {
      console.error(`${opts.name} HTTP error`, err);
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
  console.error(`${opts.name} Streamable HTTP on http://127.0.0.1:${opts.port}/mcp`);
}
