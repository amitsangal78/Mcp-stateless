import { Agent } from "@cursor/sdk";
import { env, streamCursorRun, type AppId, type ClientEvent } from "@mcp-learning/shared/server";
import { APPS } from "./apps";
import { app1Tools } from "./tools/app1";
import { app2Tools } from "./tools/app2";

function toolsFor(appId: AppId) {
  return appId === "app1" ? app1Tools : app2Tools;
}

export async function runAppAgent(
  appId: AppId,
  prompt: string,
  onEvent: (event: ClientEvent) => void
) {
  const { cursorApiKey } = env();
  const app = APPS[appId];
  const agent = await Agent.create({
    apiKey: cursorApiKey,
    model: { id: "composer-2.5" },
    name: app.name,
    tools: ["mcp"],
    local: {
      cwd: process.cwd(),
      customTools: toolsFor(appId),
    },
  });
  await streamCursorRun(agent, prompt, onEvent);
}
