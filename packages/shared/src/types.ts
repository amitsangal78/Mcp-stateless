export type AppId = "app1" | "app2";

export type ClientEvent =
  | { type: "text"; text: string }
  | { type: "tool"; name: string; status: string; args?: unknown; result?: unknown }
  | { type: "done"; status: string; text?: string }
  | { type: "error"; message: string };

export type AppCopy = {
  id: AppId;
  name: string;
  role: string;
  starter: string;
};

export type HealthPayload = {
  ok: boolean;
  missing?: string[];
  checks?: Record<string, { ok: boolean; detail: string }>;
  mode?: string;
  integrations?: number;
};
