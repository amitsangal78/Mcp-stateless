/**
 * Demo OAuth 2.1 issuer — March 2025 made remote MCP possible.
 * client_credentials only (no browser redirect). Enough to show:
 * the MCP server refuses traffic without a minted Bearer token.
 */
import "./load-env.js";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { OAUTH_CLIENT, PORTS } from "../lib/ports.js";

type Token = { clientId: string; exp: number };

const tokens = new Map<string, Token>();
const TTL_SEC = 60 * 60;

async function readBody(req: import("node:http").IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  const type = req.headers["content-type"] ?? "";
  if (type.includes("application/json")) return JSON.parse(raw || "{}") as Record<string, string>;
  return Object.fromEntries(new URLSearchParams(raw)) as Record<string, string>;
}

function send(res: import("node:http").ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const http = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORTS.oauth}`);

  if (url.pathname === "/health") {
    send(res, 200, { ok: true, issuer: `http://127.0.0.1:${PORTS.oauth}` });
    return;
  }

  if (url.pathname === "/.well-known/oauth-authorization-server") {
    send(res, 200, {
      issuer: `http://127.0.0.1:${PORTS.oauth}`,
      token_endpoint: `http://127.0.0.1:${PORTS.oauth}/token`,
      introspection_endpoint: `http://127.0.0.1:${PORTS.oauth}/introspect`,
      grant_types_supported: ["client_credentials"],
      token_endpoint_auth_methods_supported: ["client_secret_post"],
    });
    return;
  }

  if (url.pathname === "/token" && req.method === "POST") {
    const body = await readBody(req);
    if (body.grant_type !== "client_credentials") {
      send(res, 400, { error: "unsupported_grant_type" });
      return;
    }
    if (body.client_id !== OAUTH_CLIENT.id || body.client_secret !== OAUTH_CLIENT.secret) {
      send(res, 401, { error: "invalid_client" });
      return;
    }
    const access_token = `mcp_${randomUUID()}`;
    tokens.set(access_token, { clientId: body.client_id, exp: Date.now() + TTL_SEC * 1000 });
    send(res, 200, {
      access_token,
      token_type: "Bearer",
      expires_in: TTL_SEC,
      scope: "github jira",
    });
    return;
  }

  if (url.pathname === "/introspect" && req.method === "POST") {
    const body = await readBody(req);
    const row = body.token ? tokens.get(body.token) : undefined;
    if (!row || row.exp < Date.now()) {
      send(res, 401, { active: false });
      return;
    }
    send(res, 200, { active: true, client_id: row.clientId, exp: Math.floor(row.exp / 1000) });
    return;
  }

  send(res, 404, { error: "not_found" });
});

http.listen(PORTS.oauth, "127.0.0.1", () => {
  console.error(`oauth issuer on http://127.0.0.1:${PORTS.oauth} (client_id=${OAUTH_CLIENT.id})`);
});
