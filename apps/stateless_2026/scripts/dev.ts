/**
 * Start OAuth + GitHub MCP + Jira MCP, then Next.js on :3004.
 */
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";
import { loadEnvConfig } from "@next/env";
import { PORTS } from "../lib/ports.js";

loadEnvConfig(path.resolve(process.cwd(), "../.."));

const require = createRequire(import.meta.url);
const tsx = path.join(path.dirname(require.resolve("tsx/package.json")), "dist/cli.mjs");
const nextBin = path.join(path.dirname(require.resolve("next/package.json")), "dist/bin/next");

const children: ChildProcess[] = [];

function run(label: string, args: string[]) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited ${code}`);
    }
  });
  children.push(child);
  return child;
}

async function waitFor(url: string, label: string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

async function main() {
  run("oauth", [tsx, path.join("mcp-servers", "oauth.ts")]);
  await waitFor(`http://127.0.0.1:${PORTS.oauth}/health`, "oauth");

  run("github", [tsx, path.join("mcp-servers", "github.ts")]);
  run("jira", [tsx, path.join("mcp-servers", "jira.ts")]);
  await waitFor(`http://127.0.0.1:${PORTS.github}/health`, "github MCP");
  await waitFor(`http://127.0.0.1:${PORTS.jira}/health`, "jira MCP");

  run("next", [nextBin, "dev", "--port", String(PORTS.next)]);
  console.error(`stateless_2026 UI → http://localhost:${PORTS.next}`);
}

main().catch((err) => {
  console.error(err);
  shutdown();
  process.exit(1);
});
