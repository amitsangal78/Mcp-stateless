# sessions_2025 — 2025 production (sticky sessions break)

**Era:** late 2025, once remote MCP is actually deployed  
**UI:** [http://localhost:3003](http://localhost:3003)  
**What changed vs `remote_2025`:** GitHub is no longer one process. There are two pods. `Mcp-Session-Id` is minted on Pod A. `merge_pr` is sent to Pod B. Merge dies.

This folder is the 2am incident from the talk: the PR is green on GitHub, and the protocol forgot it.

## The problem with session-based MCP

MCP's Streamable HTTP transport lets a server mint an `Mcp-Session-Id` on `initialize`, then use it as a key into **process-local RAM** (`session.currentPr` here). The tool schemas take advantage of that: `merge_pr` and `wait_for_ci` accept **no `pr_id` argument** — they were designed to "remember" the PR from the session instead of being told which one.

That only works if every later call lands back on the exact process that minted the session. In real deployments nothing guarantees that:

- Rolling deploys drain pods and start new ones.
- A load balancer round-robins, or scales a replica away under load.
- Kubernetes / Cloud Run / most autoscalers don't promise pod affinity by default.

So the session becomes **a second, worse source of truth** — a fact about the PR that lives only in one replica's memory, separate from GitHub, which already knows everything about PR 482. When `merge_pr` is routed to a pod that never saw `initialize`, there is no `pr_id` to fall back on. The failure is dishonest: GitHub is fine, CI is green, the agent just looks broken because *the protocol* lost the plot.

This app demos exactly that: `open_pr` sticks to Pod A and stashes `currentPr` there; the "load balancer" always sends `merge_pr` / `wait_for_ci` to Pod B, which has nothing.

## Request flow, step by step

Run App 1's starter prompt and this is what actually happens on the wire:

1. **`initialize`** — the MCP client's first call. `github-pods.ts` mints `Mcp-Session-Id: <uuid>`, routes it to **Pod A**, and creates an empty memory slot: `pods.A.memory.set(id, {})`.
2. **`create_branch`** — same session header, still Pod A. GitHub gets a real branch. On success, `pods.A.memory[id].currentBranch` is set (`github.ts`, after the GitHub call succeeds, never before).
3. **`open_pr`** — same session, still Pod A. GitHub gets a real PR. `pods.A.memory[id].currentPr = 482` is set. The tool result includes `session: <uuid>` for visibility but does **not** hand back a `pr_id` the caller is meant to reuse — `merge_pr`'s schema has no field for one.
4. **`wait_for_ci`** — the "load balancer" hard-routes this tool to **Pod B**, regardless of the session header. Pod B's HTTP layer rejects the request with a synthetic `SESSION NOT FOUND` error *before* any MCP tool code runs (see `github-pods.ts`'s `CROSS_POD_TOOLS` check).
5. **`merge_pr`** — same forced hop to Pod B, same rejection. The PR is never merged. GitHub still shows it open, CI may already be green — the failure is purely in the protocol layer, not in GitHub.
6. **App 2** (Incident Bot) files the Jira ticket and lists PRs fine (Jira is single-replica, `list_pulls` is read-only and stays on Pod A) — but hits the same Pod-B wall the moment it tries `wait_for_ci` / `merge_pr`.

## How this application was created

Copied `remote_2025` (HTTP + OAuth + annotations, same GitHub/Jira REST). Then only the production-session scar was added:

1. **Two pods in one GitHub process** — `mcp-servers/github-pods.ts`. `initialize`, `create_branch`, `open_pr`, `list_pulls` stick to **Pod A**. That replica stores `session.currentPr` in RAM.
2. **A dishonest load balancer** — `wait_for_ci` and `merge_pr` are always routed to **Pod B**. That is the rolling-deploy moment: Pod A drained, the next call landed on a stranger.
3. **Tools that refuse to take a handle** — `merge_pr` and `wait_for_ci` have **empty input schemas**. They are supposed to "remember" the PR from the session. There is no `pr_id` argument. When the session is gone, there is nothing to send to GitHub.
4. The UI draws Pod A (teal) vs Pod B (rose + `SESSION NOT FOUND`).

```
App 1/2 ── OAuth ── HTTP ── LB ── Pod A  currentPr=482   ── GitHub
                                 Pod B  (empty)         ── 404
```

Jira stays a single replica on purpose. The story is the GitHub merge.

## Steps to use it effectively

```bash
# from mcp_learning/
npm run dev:sessions
```

Open [http://localhost:3003](http://localhost:3003).

1. Health strip must show OAuth + GitHub MCP + Jira MCP up.
2. Run **App 1** with the starter. Watch:
   - `create_branch` / `open_pr` → Pod A (teal). A real PR is opened.
   - `wait_for_ci` or `merge_pr` → Pod B (rose). Error text should mention **SESSION NOT FOUND**.
3. Open GitHub. The PR is still there. CI may be green. The agent cannot merge because *the protocol* lost the plot, not because GitHub did.
4. Read `mcp-servers/github-pods.ts` (the hop) and `mcp-servers/github.ts` (`currentPr` in `pods.A.memory`).
5. Then open [`../stateless_2026`](../stateless_2026) and run the same hotfix. That folder passes `pr_id` in the tool result.

Use a throwaway repo. This era **opens** a PR and **fails to merge** it. You will want to close leftovers by hand.

### Ports

| Process | Port | Role |
| --- | --- | --- |
| Next.js UI | 3003 | Two agents + pod diagram |
| GitHub MCP (Pod A+B) | 3103 | Sticky A, merge/wait → B |
| Jira MCP | 3203 | Single replica |
| OAuth issuer | 3303 | Same demo token flow |

## Pros

- Sessions feel convenient. The model does not have to thread a PR number through the prompt.
- Sticky routing (or Redis) can paper over one replica for a while.
- Everything good from March 2025 is still here: HTTP, OAuth, annotations, write-once GitHub/Jira.

## Cons (why `stateless_2026` exists)

- **A session is a second, worse source of truth.** GitHub already knew about PR 482. Pod A invented `currentPr` and pinned it to a process that can die.
- Sticky sessions fight Kubernetes, Cloud Run, and any rolling deploy. Autoscaling and multi-region get harder, not easier.
- Redis-for-MCP-sessions is an ops tax that exists only because the protocol smuggled state.
- `merge_pr()` with no arguments is undebuggable at 2am. You cannot grep `pr_id=482`. You hunt a cookie.
- The failure mode is dishonest: GitHub is fine; the agent looks broken.

**Next era:** delete `Mcp-Session-Id`. Return `pr_id` from `open_pr`. Any pod can merge. See [`../stateless_2026`](../stateless_2026).

## sessions_2025 vs stateless_2026 at a glance

| Aspect | `sessions_2025` (this folder) | `stateless_2026` |
| --- | --- | --- |
| Session id | Minted on `initialize`, sent as `Mcp-Session-Id` | None — `sessionIdGenerator: undefined` |
| Where PR/ticket state lives | Process RAM (`pods.A.memory`) | Nowhere but GitHub/Jira themselves |
| `merge_pr` / `wait_for_ci` input | Empty schema `{}` — expects the session to "remember" | `{ pr_id }` — explicit, required argument |
| Pod routing for those tools | Sticky to Pod A, then LB force-hops to Pod B | Round-robin, either pod, doesn't matter |
| Failure mode on a pod change | `SESSION NOT FOUND` — protocol lost the PR, GitHub is fine | No failure — the call still carries what it needs |
| Debuggability | Hunt a session cookie; nothing to grep | `grep pr_id=482` in args, results, and logs |

## Why stateless — and how you pass "session" now

Nothing about the *use case* (thread a PR number through a few tool calls) required a server-held session. What it needed was a **handle** — a small piece of data the caller already has and can hand back. `stateless_2026` deletes `Mcp-Session-Id` entirely and instead:

1. `open_pr` returns `{ pr_id }` in its tool **result**.
2. The client (the model, following its own conversation/prompt) puts that `pr_id` into the **arguments** of `wait_for_ci` and `merge_pr`.
3. Any pod can serve any call, because it asks GitHub directly with `pr_id` — it never needs to have "been there" for `open_pr`.

In short: state that used to live in server RAM now travels as ordinary tool-call data, and the origin system (GitHub, Jira, S3, …) stays the one source of truth. See [`../stateless_2026`](../stateless_2026) for the working version of this hotfix.
