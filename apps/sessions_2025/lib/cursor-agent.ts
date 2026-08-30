import { Agent } from "@cursor/sdk";
import { env, streamCursorRun, type AppId, type ClientEvent } from "@mcp-learning/shared/server";
import { APPS } from "./apps";
import { sharedMcpServers } from "./mcp-servers";

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
    local: { cwd: process.cwd() },
    mcpServers: await sharedMcpServers(),
  });
  await streamCursorRun(agent, prompt, onEvent);
}
