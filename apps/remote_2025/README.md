# remote_2025 — March 2025 (Streamable HTTP, OAuth, annotations)

**Era:** 26 March 2025  
**UI:** [http://localhost:3002](http://localhost:3002)  
**What changed vs `after_mcp`:** the servers are no longer stdio child processes. They are HTTP URLs. A token issuer sits in front. Tools declare whether they are read-only or destructive.

This is the spec drop that made remote MCP possible. Same GitHub and Jira integrations. Different way to reach them.

## How this application was created

Started from `after_mcp` (shared chat UI, two agents, one GitHub file, one Jira file). Then only the March 2025 surface changed:

1. **Streamable HTTP** — `mcp-servers/github.ts` and `mcp-servers/jira.ts` listen on real ports (`:3102`, `:3202`). `lib/mcp-servers.ts` now passes `{ type: "http", url, headers }` into `Agent.create` instead of `{ type: "stdio", command, args }`.
2. **OAuth 2.1 (demo)** — `mcp-servers/oauth.ts` is a tiny issuer. `client_credentials` mints a Bearer token. The MCP host rejects `/mcp` without it. This is *not* a full browser login; it is enough to show "the agent presents a token, the server does not inherit a god-mode PAT from the host process."
3. **Tool annotations** — `list_pulls` / `get_issue` set `readOnlyHint: true`. `merge_pr` sets `destructiveHint: true`. Clients can start showing a confirm dialog instead of blindly calling.
4. **`scripts/dev.ts`** starts OAuth → GitHub MCP → Jira MCP → Next.js, because a remote server is a process you operate, not a pipe you inherit.

```
App 1 ──┐
        ├── OAuth bearer ── Streamable HTTP ── github.ts ── GitHub
App 2 ──┘                                  ── jira.ts   ── Jira
```

stdio from November 2024 is gone. The N × M win from `after_mcp` is kept: GitHub is still one file.

## Steps to use it effectively

From the monorepo root (same `.env.local` as the other eras):

```bash
npm run dev:remote
```

Open [http://localhost:3002](http://localhost:3002).

1. Wait until **OAuth issuer**, **GitHub MCP**, and **Jira MCP** are green in the health strip — not just the GitHub/Jira REST keys. If those three are down, you started `next dev` instead of `npm run dev:remote`.
2. Run **App 1**, then **App 2**. Teal now goes through OAuth and an HTTP hop.
3. Read, in this order:
   - `lib/mcp-servers.ts` — `type: "http"`
   - `mcp-servers/oauth.ts` — token mint + introspect
   - `mcp-servers/github.ts` — `annotations` on each tool
   - `mcp-servers/http-host.ts` — `Mcp-Session-Id` is already here (one process, so it still works)
4. Optional: `curl -i http://127.0.0.1:3102/mcp` with no `Authorization` header. You should get `401`. That is the March 2025 lesson in one request.

Use a throwaway GitHub repo and Jira project. Starter prompts create a real branch, PR, and issue.

### Ports this era starts

| Process | Port | Role |
| --- | --- | --- |
| Next.js UI | 3002 | Two agents + diagram |
| GitHub MCP | 3102 | Streamable HTTP `/mcp` |
| Jira MCP | 3202 | Streamable HTTP `/mcp` |
| OAuth issuer | 3302 | `/token`, `/introspect` |

## Pros

- MCP is a **URL**. You can put it behind a team gateway, not only on a laptop.
- **OAuth** means the agent can act as a user (or a narrowly scoped client), not as whatever PAT happened to be in the shell.
- **Annotations** let a client treat `list_pulls` as safe and `merge_pr` as "ask first."
- The write-once win from November 2024 is unchanged: App 1 and App 2 still share `github.ts`.

## Cons (why `sessions_2025` exists)

- Streamable HTTP is **stateful**. `initialize` mints `Mcp-Session-Id`. Later calls must hit the process that still has that session in RAM.
- This folder has **one replica**, so you will not feel it. Ship two pods and a load balancer and the next request can land on a stranger.
- OAuth here is `client_credentials` for the demo. Production March 2025 wanted a real user login (authorization code + PKCE). That is more moving parts, not fewer.
- Annotations are hints. A careless client can still call `merge_pr` without showing a confirm.
- You now operate four processes instead of one Next.js app. Remote MCP is infrastructure.

**Next era:** add a second GitHub pod and a load balancer. Watch `merge_pr` die when `Mcp-Session-Id` hits Pod B. See [`../sessions_2025`](../sessions_2025).
