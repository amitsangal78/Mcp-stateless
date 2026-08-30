/**
 * Stateless Streamable HTTP — spec 2026-07-28 shape.
 * No sessionIdGenerator. New server+transport per request.
 * Two pods, round-robin. Any replica can run any tool because
 * continuity lives in arguments (pr_id), not in RAM.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type PodId = "A" | "B";

export const lastRoute: { pod: PodId; tool?: string; method?: string } = { pod: "A" };

let tick = 0;

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

export async function listenStatelessMcp(opts: {
  name: string;
  port: number;
  oauthUrl: string;
  createServer: (pod: PodId) => McpServer;
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
        name: opts.name,
        transport: "streamable-http",
        session: false,
        lastRoute,
      });
      return;
    }
    if (url.pathname !== "/mcp") {
      send(res, 404, { error: "not_found" });
      return;
    }
    if (!(await authorized(req, res))) return;

    const pod: PodId = tick++ % 2 === 0 ? "A" : "B";
    let body: unknown;
    try {
      body = req.method === "POST" ? await readJson(req) : undefined;
    } catch (err) {
      send(res, 400, { error: err instanceof Error ? err.message : String(err) });
      return;
    }

    const tool = toolNameFromBody(body);
    const method = (body as { method?: string } | undefined)?.method;
    lastRoute.pod = pod;
    lastRoute.tool = tool;
    lastRoute.method = method;
    console.error(`${opts.name} pod ${pod}  ${method ?? req.method}  ${tool ?? ""}  (no Mcp-Session-Id)`);

    const server = opts.createServer(pod);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      console.error(`${opts.name} pod ${pod} error`, err);
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
  console.error(`${opts.name} stateless HTTP on http://127.0.0.1:${opts.port}/mcp (round-robin A/B, no session)`);
}
