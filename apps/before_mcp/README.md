# before_mcp — N × M custom connectors

**Era:** before MCP existed  
**Port:** [http://localhost:3000](http://localhost:3000)  
**What the client uses:** Cursor SDK `local.customTools` — each app ships its own GitHub and Jira REST.

This folder is the problem statement. App 1 and App 2 both need GitHub and Jira. There is no protocol, so each app owns a private copy of both APIs. Two clients × two services = four connectors. That is the N × M explosion.

## How this application was created

1. A Next.js app on port 3000, sharing chat UI / env / Cursor streaming from `@mcp-learning/shared`.
2. Two AI clients (`App 1 · Coding Agent`, `App 2 · Incident Bot`) that look similar in the UI.
3. Four REST files that do the same jobs with different names:
   - `lib/integrations/app1/github.ts` + `lib/integrations/app1/jira.ts`
   - `lib/integrations/app2/github.ts` + `lib/integrations/app2/jira.ts`
4. Two tool tables (`lib/tools/app1.ts`, `lib/tools/app2.ts`) that wrap those files as Cursor `customTools`.
5. `lib/cursor-agent.ts` picks the tool table by `appId`. There is no shared GitHub module.

That last point is the whole lesson. A GitHub field change, a new auth header, or a Jira ADF tweak has to be fixed four times (and then again for every new AI client).

```
App 1 ── app1/github.ts ── GitHub
App 1 ── app1/jira.ts   ── Jira
App 2 ── app2/github.ts ── GitHub   ← second copy
App 2 ── app2/jira.ts   ── Jira     ← second copy
```

## Steps to use it effectively

From the monorepo root:

```bash
cp .env.example .env.local   # once
npm install
npm run dev:before
```

Open [http://localhost:3000](http://localhost:3000).

1. Wait until the health strip is green (Cursor, GitHub, Jira).
2. Run **App 1** with the starter prompt. Watch the orange line — that is App 1's private connector.
3. Run **App 2**. A *different* orange line lights up. Same GitHub API, different file.
4. Open the two GitHub files side by side. They are the N × M problem in the repo.

Use a throwaway GitHub repo and Jira project. Starter prompts create a real branch, pull request, and issue.

## Pros

- Fast to ship the first agent. No protocol, no extra process, no spec to learn.
- Easy to debug: the fetch lives in the same Node process as the UI.
- Fine when you have **one** client and **one** integration.

## Cons (why `after_mcp` exists)

- Every new AI client recopies GitHub and Jira. N clients × M tools explodes.
- Auth, retries, and field mappings drift. App 1's GitHub is not App 2's GitHub.
- You cannot share one integration with Cursor, Claude, Slack, and a custom bot.
- There is no standard way to describe a tool, a resource, or a reusable prompt.

**Next era:** write GitHub once and Jira once as MCP servers. See [`../after_mcp`](../after_mcp).
