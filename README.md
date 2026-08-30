# Mcp-stateless

Explain the evolution of MCP and why it became stateless.

One repo. One `.env.local`. One Cursor SDK setup. A new folder per MCP era.

```
.env.example                 keys used by every era
packages/shared/             env, chat UI, Cursor stream helper
apps/before_mcp/             N × M — each app owns GitHub + Jira   :3000
apps/after_mcp/              Nov 2024 — write the server once      :3001
apps/remote_2025/            Mar 2025 — OAuth + Streamable HTTP    :3002
apps/sessions_2025/          2025 prod — sticky sessions break     :3003
apps/stateless_2026/         Jul 2026 — pr_id, no session          :3004
```

> **MCP's original bet was simple: write the integration once on the server, and let different AI clients use it.**

## Run

Node **22.13+** (required by `@cursor/sdk`). One install at the root. One env file.

```bash
cp .env.example .env.local
# paste CURSOR_API_KEY, GitHub, Jira

npm install

npm run dev:before      # http://localhost:3000
npm run dev:after       # http://localhost:3001
npm run dev:remote      # http://localhost:3002
npm run dev:sessions    # http://localhost:3003
npm run dev:stateless   # http://localhost:3004
```

Open an era. Run **App 1** and **App 2**. Watch the architecture diagram.

- Before: four orange connectors. App 1's GitHub file is not App 2's GitHub file.
- After: both apps go through stdio MCP. `mcp-servers/github.ts` is the only GitHub integration.
- Remote: same servers, now HTTP + OAuth + annotations.
- Sessions: `open_pr` on Pod A, `merge_pr` on Pod B, session not found.
- Stateless: `pr_id` in the tool result. Any pod can merge.

## How Cursor SDK is used

Both eras use `@cursor/sdk` with a **local** agent. `CURSOR_API_KEY` comes from root `.env.local` ([Dashboard → Integrations](https://cursor.com/dashboard/integrations)).

**Before** — each app injects its own REST wrappers as `local.customTools`:

```ts
await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  tools: ["mcp"],
  local: { cwd: process.cwd(), customTools: app1Tools },
});
```

**After** — neither app contains GitHub/Jira fetch code. Both pass the same `mcpServers` map:

```ts
await Agent.create({
  apiKey: process.env.CURSOR_API_KEY!,
  model: { id: "composer-2.5" },
  tools: ["mcp"],
  local: { cwd: process.cwd() },
  mcpServers: sharedMcpServers(), // github.ts + jira.ts, once
});
```

**Remote / sessions / stateless** — still one GitHub server and one Jira server. The map becomes HTTP:

```ts
mcpServers: {
  github: { type: "http", url: "http://127.0.0.1:3102/mcp", headers: { Authorization: `Bearer ${token}` } },
  jira:   { type: "http", url: "http://127.0.0.1:3202/mcp", headers: { Authorization: `Bearer ${token}` } },
}
```

What changes after that is *session vs handle*, not the GitHub REST.

## Where to read the N × M problem

```
apps/before_mcp/lib/integrations/app1/github.ts
apps/before_mcp/lib/integrations/app2/github.ts   ← second copy
apps/after_mcp/mcp-servers/github.ts              ← written once
apps/after_mcp/lib/mcp-servers.ts                 ← both apps load this
apps/remote_2025/mcp-servers/github.ts            ← same REST, Streamable HTTP + annotations
apps/sessions_2025/mcp-servers/github-pods.ts     ← Mcp-Session-Id · merge → Pod B
apps/stateless_2026/mcp-servers/github.ts         ← pr_id in the tool result, no session
```

Each era folder has its own README: how it was built, how to run it, and the cons that force the next folder.

See [apps/README.md](./apps/README.md).

## Keys

| Variable | Where |
| --- | --- |
| `CURSOR_API_KEY` | [cursor.com/dashboard/integrations](https://cursor.com/dashboard/integrations) |
| `GITHUB_TOKEN` | PAT with `repo` — [github.com/settings/tokens](https://github.com/settings/tokens) |
| `GITHUB_OWNER` / `GITHUB_REPO` | A repo the token can write (branch + PR) |
| `JIRA_BASE_URL` | `https://your-site.atlassian.net` |
| `JIRA_EMAIL` / `JIRA_API_TOKEN` | [id.atlassian.com API tokens](https://id.atlassian.com/manage-profile/security/api-tokens) |
| `JIRA_PROJECT_KEY` | e.g. `ENG` |

Starter prompts create a real branch, PR, and Jira issue. Use a throwaway repo and project.
