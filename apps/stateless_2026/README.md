# stateless_2026 — July 2026 (no session, `pr_id` in the tool result)

**Era:** 28 July 2026 — spec `2026-07-28`  
**UI:** [http://localhost:3004](http://localhost:3004)  
**What changed vs `sessions_2025`:** `Mcp-Session-Id` is gone. `open_pr` returns `{ pr_id }`. `wait_for_ci` and `merge_pr` require that handle. Two pods round-robin. Both succeed.

This is the punchline of the whole monorepo: you never needed a session. You needed a PR number. GitHub already had the state.

## The problem it fixes

[`../sessions_2025`](../sessions_2025) let the MCP server remember the PR itself, keyed by `Mcp-Session-Id`, in one pod's RAM. That memory dies the moment a rolling deploy, autoscaler, or plain round-robin load balancer sends the next call to a different replica — `merge_pr` fails even though GitHub still has the PR and CI is green. The session was a second, fragile source of truth for a fact GitHub already knew.

## Why stateless — and how continuity is passed now

Stateless MCP (spec `2026-07-28`) removes the server-held session as a concept: `sessionIdGenerator: undefined` means every HTTP request gets a fresh server + transport, with nothing carried over in process memory. Continuity does not disappear — it just moves to a place that survives any pod dying:

1. **Handles live in the data, not in a cookie.** `open_pr` returns `{ pr_id }`. `create_issue` returns `{ ticket_id }`. These are ordinary fields in the tool result.
2. **The caller threads the handle forward.** The model (or your orchestration code) reads `pr_id` out of `open_pr`'s result and passes it as an argument to `wait_for_ci`, `merge_pr`, `comment_on_pr`. It is visible in the prompt, the tool call, and your logs — you can `grep pr_id=482` instead of hunting a session cookie.
3. **Any replica can serve any call**, because each tool asks the origin system (GitHub, Jira) directly using the handle it was given, instead of asking "do you remember me?" of whichever pod happens to answer.
4. **The origin system stays the one source of truth.** GitHub already tracked PR 482's state; MCP does not need to duplicate it.

So: "no session" does not mean "no state." It means state that must cross calls is passed explicitly as data (a `pr_id`, a `ticket_id`, a task id you mint yourself for longer-running work), the same way any stateless HTTP API already works — see the Cons section below for where that handle-passing needs deliberate design (structured output, a client-side handle store, task/polling for long work).

## Request flow, step by step

Run App 1's starter prompt and this is what actually happens on the wire:

1. **`create_branch`** — `http-host.ts` picks a pod by round-robin (`tick++ % 2`), builds a brand-new server + transport for this one request, no session header is ever issued. GitHub gets a real branch. The result carries `pod` for visibility, nothing else.
2. **`open_pr`** — next tick, possibly the *other* pod. GitHub gets a real PR. The result is `{ pr_id: 482, ... }` — an ordinary field the model reads out of the tool result.
3. **`wait_for_ci({ pr_id: 482 })`** — next tick, could land on either pod. Whichever one gets it asks GitHub directly for PR 482's status — it never needs to have seen `open_pr`.
4. **`merge_pr({ pr_id: 482 })`** — same story. Any pod, same `pr_id`, GitHub does the merge. Succeeds even if this landed on a different pod than every prior call.
5. **App 2** (Incident Bot) does the Jira equivalent: `create_issue` returns `ticket_id`, and `comment_issue` / `get_issue` take it as an argument — same handle pattern, same statelessness.

Nothing here depends on which pod served the previous call. That is the whole point.

## How this application was created

Copied `sessions_2025` (HTTP, OAuth, two GitHub pods, same REST). Then the protocol idea of a session was deleted:

1. **`sessionIdGenerator: undefined`** — `mcp-servers/http-host.ts` builds a fresh MCP server + transport on every HTTP request. Nothing is stored in process memory between calls.
2. **Round-robin Pod A / Pod B** — the load balancer no longer sticks. The demo still has two replicas so you can *see* hops. They are not a hazard anymore.
3. **Handles in the tool result** — `open_pr` returns `pr_id`. `create_issue` returns `ticket_id`. Follow-up tools take those fields as arguments. The model (and your logs) can see them.
4. **`merge_pr({ pr_id })` talks to GitHub**, not to `session.currentPr`. Pod B does not need to have been there for `open_pr`.

```
1. create_branch(repo, branch)           → any pod → GitHub
2. open_pr(repo, branch)                 → { pr_id: 482 }
3. wait_for_ci(pr_id: 482)               → any pod, asks GitHub
4. merge_pr(pr_id: 482)                  → any pod, asks GitHub
```

Watch what disappeared: the session. Watch what appeared: `pr_id`. That is it.

## Steps to use it effectively

```bash
# from mcp_learning/
npm run dev:stateless
```

Open [http://localhost:3004](http://localhost:3004).

1. Health strip green (keys + OAuth + both MCP URLs).
2. Run **App 1**. The starter tells the model to *read* `pr_id` from `open_pr` and pass it on. Merge should succeed even if the log shows the call landing on a different pod than `open_pr`.
3. Compare with [`../sessions_2025`](../sessions_2025) on :3003. Same hotfix. There, `merge_pr()` has no arguments and dies on Pod B. Here, `merge_pr({ pr_id })` lives.
4. Read, in this order:
   - `mcp-servers/http-host.ts` — no session map
   - `mcp-servers/github.ts` — `pr_id` on `open_pr`, `wait_for_ci`, `merge_pr`
   - `../sessions_2025/mcp-servers/github.ts` — `session.currentPr` instead
5. Grep a tool result for `pr_id`. That is the 2am debug story you wanted in 2025.

Use a throwaway repo. This era **will merge** the hotfix PR if GitHub allows it.

### Ports

| Process | Port | Role |
| --- | --- | --- |
| Next.js UI | 3004 | Two agents + round-robin diagram |
| GitHub MCP | 3104 | Stateless, pods A/B |
| Jira MCP | 3204 | Stateless, `ticket_id` |
| OAuth issuer | 3304 | Same demo token flow |

## stateless_2026 vs sessions_2025 at a glance

| Aspect | `sessions_2025` | `stateless_2026` (this folder) |
| --- | --- | --- |
| Session id | Minted on `initialize`, sent as `Mcp-Session-Id` | None — `sessionIdGenerator: undefined` |
| Where PR/ticket state lives | Process RAM (`pods.A.memory`) | Nowhere but GitHub/Jira themselves |
| `merge_pr` / `wait_for_ci` input | Empty schema `{}` — expects the session to "remember" | `{ pr_id }` — explicit, required argument |
| Pod routing for those tools | Sticky to Pod A, then LB force-hops to Pod B | Round-robin, either pod, doesn't matter |
| Failure mode on a pod change | `SESSION NOT FOUND` — protocol lost the PR, GitHub is fine | No failure — the call still carries what it needs |
| Debuggability | Hunt a session cookie; nothing to grep | `grep pr_id=482` in args, results, and logs |

## What actually improved

- **The failure mode disappeared, not just moved.** `sessions_2025` fails whenever a write tool is routed to a pod that never saw `initialize`. That routing dependency is gone here — there is no pod to "have seen" anything.
- **State moved to where it's visible.** `pr_id` / `ticket_id` show up in tool results, tool arguments, and your logs. `session.currentPr` showed up in none of those — you'd have needed a debugger attached to Pod A's process to see it.
- **Any replica can do any part of the job.** Rolling deploys, autoscaling, and multi-region no longer require sticky routing or a shared session store (Redis) just to keep MCP working.
- **The origin system stays authoritative.** GitHub/Jira already know the true state (PR open? merged? CI status?). Nothing here re-derives or shadows that in a second store that can drift or die.
- **Nothing was lost on auth or safety.** OAuth bearer tokens and tool annotations (`destructiveHint`, `readOnlyHint`, etc.) from `remote_2025` / `sessions_2025` carry over unchanged — statelessness is additive, not a rollback.

## Pros

- **Any replica, any region, any deploy.** No sticky cookies, no session Redis "just for MCP."
- Continuity is visible: `pr_id=482` in args, results, and logs.
- GitHub / Jira / S3 remain the source of truth. The protocol stopped inventing a second one.
- Still write-once: App 1 and App 2 share the same HTTP servers.
- OAuth and annotations from 2025 still apply. Stateless is not a step backward on auth or safety.

## Cons (what you would evolve next)

- The model must **thread handles**. If it drops `pr_id`, the next call fails honestly — better than a silent session, still a prompt-discipline problem. Structured output and a client-side handle store help.
- **Long-running work** (four-minute CI) is not a held session. You want tasks / polling as an *extension*, keyed by `pr_id` or a task id you minted — application state, not MCP session state.
- **Human confirm** ("type MERGE") should be a retry of the same tool with extra input (MRTR), not an SSE umbilical cord tied to Pod A.
- Header-based routing (`Mcp-Method`, `Mcp-Name`) is the gateway story this demo only logs, not enforces.
- Demo OAuth is still `client_credentials`. Production 2026 prefers hardened issuer validation, not a shared secret in the repo.

The core got smaller and more like HTTP. That is the point of this folder.
