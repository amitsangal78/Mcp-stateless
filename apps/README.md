# Apps — one folder per MCP era

Each app is a Next.js workspace. Shared chat UI, env, and Cursor streaming live in `packages/shared`.

| Folder | Era | Port | What changes vs the previous folder |
| --- | --- | --- | --- |
| `before_mcp` | Pre-MCP | 3000 | N × M: App 1 and App 2 each own GitHub + Jira REST |
| `after_mcp` | Nov 2024 launch | 3001 | One GitHub MCP server, one Jira MCP server, both clients reuse them |
| `remote_2025` | Mar 2025 | 3002 | Streamable HTTP URLs, OAuth bearer, tool annotations |
| `sessions_2025` | 2025 production | 3003 | `Mcp-Session-Id` on Pod A; `merge_pr` dies on Pod B |
| `stateless_2026` | Jul 2026 | 3004 | No session. `pr_id` / `ticket_id` in the tool result |

Do not put GitHub/Jira REST in `packages/shared`. The lesson of each era is *how the client reaches those APIs*, and that code belongs in the era folder.

Each folder has a README: how it was built, how to run it, and the cons that justify the next era.
