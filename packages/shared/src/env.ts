import fs from "node:fs";
import path from "node:path";

const REQUIRED = [
  "CURSOR_API_KEY",
  "GITHUB_TOKEN",
  "GITHUB_OWNER",
  "GITHUB_REPO",
  "JIRA_BASE_URL",
  "JIRA_EMAIL",
  "JIRA_API_TOKEN",
  "JIRA_PROJECT_KEY",
] as const;

/**
 * Next.js only auto-loads .env.local from the app folder (apps/before_mcp).
 * This repo keeps one file at mcp_learning/.env.local — walk up and apply it.
 */
function loadRootEnvLocal() {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const file = path.join(dir, ".env.local");
    if (fs.existsSync(file)) {
      applyEnvFile(file);
      return;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}

function applyEnvFile(file: string) {
  const text = fs.readFileSync(file, "utf8");
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
}

function normalizeGithubRepo(value: string) {
  const trimmed = value.trim().replace(/\/$/, "").replace(/\.git$/, "");
  const fromUrl = trimmed.match(/github\.com\/[^/]+\/([^/#?]+)/i);
  if (fromUrl) return fromUrl[1];
  if (trimmed.includes("/")) return trimmed.split("/").filter(Boolean).pop() ?? trimmed;
  return trimmed;
}

loadRootEnvLocal();

export function missingEnv(): string[] {
  return REQUIRED.filter((key) => !process.env[key]?.trim());
}

export function env() {
  const missing = missingEnv();
  if (missing.length) {
    throw new Error(`Missing env: ${missing.join(", ")}. Copy .env.example to .env.local at the repo root.`);
  }
  return {
    cursorApiKey: process.env.CURSOR_API_KEY!,
    githubToken: process.env.GITHUB_TOKEN!,
    githubOwner: process.env.GITHUB_OWNER!,
    githubRepo: normalizeGithubRepo(process.env.GITHUB_REPO!),
    jiraBaseUrl: process.env.JIRA_BASE_URL!.replace(/\/$/, ""),
    jiraEmail: process.env.JIRA_EMAIL!,
    jiraApiToken: process.env.JIRA_API_TOKEN!,
    jiraProjectKey: process.env.JIRA_PROJECT_KEY!,
  };
}

export function childEnv(extra: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = { ...extra };
  for (const key of ["PATH", "HOME", "TMPDIR", "NODE_PATH", "NODE_OPTIONS"]) {
    if (process.env[key]) next[key] = process.env[key]!;
  }
  return next;
}
