import { NextResponse } from "next/server";
import { checkKeys } from "@mcp-learning/shared/server";
import { PORTS, URLS } from "@/lib/ports";

export const runtime = "nodejs";

async function ping(label: string, url: string) {
  try {
    const res = await fetch(url);
    const body = (await res.json().catch(() => ({}))) as { name?: string };
    return res.ok
      ? { ok: true, detail: `${label} up · ${url.replace(/\/health$/, "")}` }
      : { ok: false, detail: `${label} ${res.status}` };
  } catch (err) {
    return { ok: false, detail: `${label} down — ${err instanceof Error ? err.message : String(err)}` };
  }
}

export async function GET() {
  const keys = await checkKeys("sessions_2025", 2);
  const extra = {
    oauth: await ping("OAuth issuer", `${URLS.oauth}/health`),
    githubMcp: await ping("GitHub MCP", `http://127.0.0.1:${PORTS.github}/health`),
    jiraMcp: await ping("Jira MCP", `http://127.0.0.1:${PORTS.jira}/health`),
  };
  const checks = { ...(keys.checks ?? {}), ...extra };
  return NextResponse.json({
    ...keys,
    checks,
    ok: Object.values(checks).every((c) => c.ok),
  });
}
