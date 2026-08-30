import { env, missingEnv } from "./env";
import type { HealthPayload } from "./types";

export async function checkKeys(mode: string, integrations: number): Promise<HealthPayload> {
  const missing = missingEnv();
  if (missing.length) {
    return { ok: false, missing, mode, integrations };
  }

  const cfg = env();
  const checks: Record<string, { ok: boolean; detail: string }> = {
    cursor: { ok: true, detail: "CURSOR_API_KEY is set" },
    github: { ok: false, detail: "" },
    jira: { ok: false, detail: "" },
  };

  try {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${cfg.githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": `mcp-learning-${mode}`,
      },
    });
    const user = (await res.json()) as { login?: string; message?: string };
    checks.github = res.ok
      ? { ok: true, detail: `GitHub @${user.login} · ${cfg.githubOwner}/${cfg.githubRepo}` }
      : { ok: false, detail: user.message ?? `GitHub ${res.status}` };
  } catch (err) {
    checks.github = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  try {
    const res = await fetch(`${cfg.jiraBaseUrl}/rest/api/3/myself`, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${cfg.jiraEmail}:${cfg.jiraApiToken}`).toString("base64")}`,
        Accept: "application/json",
      },
    });
    const me = (await res.json()) as { displayName?: string; errorMessages?: string[] };
    checks.jira = res.ok
      ? { ok: true, detail: `Jira ${me.displayName} · project ${cfg.jiraProjectKey}` }
      : { ok: false, detail: me.errorMessages?.[0] ?? `Jira ${res.status}` };
  } catch (err) {
    checks.jira = { ok: false, detail: err instanceof Error ? err.message : String(err) };
  }

  return {
    ok: Object.values(checks).every((c) => c.ok),
    checks,
    mode,
    integrations,
  };
}
