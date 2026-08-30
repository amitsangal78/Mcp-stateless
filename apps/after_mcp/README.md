# after_mcp — Nov 2024 launch (stdio, write once)

**Era:** November 2024 — spec `2024-11-05`  
**Port:** [http://localhost:3001](http://localhost:3001)  
**What the client uses:** Cursor SDK `mcpServers` pointing at two **stdio** processes.

MCP's original bet: write the integration once on the server, and let different AI clients use it. This folder is that bet, still on a laptop. No HTTP. No OAuth. No tool safety hints.

## How this application was created

Copied the `before_mcp` UI (two agents, architecture diagram, health strip) and deleted the four REST connectors.

1. One GitHub MCP server: `mcp-servers/github.ts`
2. One Jira MCP server: `mcp-servers/jira.ts`
3. Both speak MCP over **stdio** (stdin/stdout JSON-RPC). `tsx` launches each as a child process.
4. `lib/mcp-servers.ts` is the shared map. App 1 and App 2 both pass *that same object* into `Agent.create`.
5. Three primitives, same as the original spec:
   - **Tools** — `create_branch`, `open_pr`, `create_issue`, …
   - **Resources** — `repo://owner/repo`, `jira://project/KEY`
   - **Prompts** — `hotfix_pr_description`, `incident_ticket_template`

```
App 1 ──┐
        ├── MCP (stdio) ── github.ts ── GitHub
App 2 ──┘               ── jira.ts   ── Jira
```

Neither app imports a GitHub fetch helper. That is the difference from `before_mcp`.

## Steps to use it effectively

```bash
# from mcp_learning/
npm run dev:after
```

Open [http://localhost:3001](http://localhost:3001).

1. Confirm the health strip. Same root `.env.local` as the other eras.
2. Run **App 1**, then **App 2**. Teal lines now go through one MCP hub, not four orange connectors.
3. Read `lib/mcp-servers.ts` — both apps load this file.
4. Read `mcp-servers/github.ts` — this is the only GitHub integration.

Compare with `before_mcp` in another tab (`npm run dev:before` on :3000). Same prompts, different wiring.

## Pros

- Write GitHub once. Write Jira once. Any MCP client can call them.
- Tools / resources / prompts are a small, teachable surface.
- Local stdio is easy: no ports, no TLS, no load balancer.
- The N × M problem is gone **inside this repo**.

## Cons (why `remote_2025` exists)

- **Local only.** A stdio subprocess is not a URL. You cannot put this behind a team gateway.
- **No standard auth.** The child process inherits `GITHUB_TOKEN` from the host. That is a shared bot token, not "the agent acts as you."
- **No tool annotations.** Clients cannot tell `list_pulls` (read-only) from `merge_pr` (destructive). No confirm dialog.
- **One process, one laptop.** This solved connectivity. It did not solve production.

**Next era:** put the same servers on Streamable HTTP, add OAuth, and mark tools as read-only or destructive. See [`../remote_2025`](../remote_2025).
