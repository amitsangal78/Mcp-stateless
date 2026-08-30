import { sseResponse, type AppId } from "@mcp-learning/shared/server";
import { runAppAgent } from "@/lib/cursor-agent";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const { appId, prompt } = (await req.json()) as { appId?: AppId; prompt?: string };
  if (appId !== "app1" && appId !== "app2") {
    return Response.json({ error: "appId must be app1 or app2" }, { status: 400 });
  }
  if (!prompt?.trim()) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }

  return sseResponse(async (send) => {
    await runAppAgent(appId, prompt, (event) => send(event));
  });
}
