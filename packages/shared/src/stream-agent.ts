import { CursorAgentError } from "@cursor/sdk";
import type { ClientEvent } from "./types";

type StreamableAgent = {
  send: (prompt: string) => Promise<{
    id: string;
    stream: () => AsyncIterable<{
      type: string;
      message?: { content: Array<{ type: string; text?: string }> };
      name?: string;
      status?: string;
      args?: unknown;
      result?: unknown;
    }>;
    wait: () => Promise<{ status: string; result?: unknown }>;
  }>;
  [Symbol.asyncDispose]?: () => Promise<void>;
};

export async function streamCursorRun(
  agent: StreamableAgent,
  prompt: string,
  onEvent: (event: ClientEvent) => void
) {
  try {
    const run = await agent.send(prompt);
    for await (const event of run.stream()) {
      if (event.type === "assistant" && event.message) {
        for (const block of event.message.content) {
          if (block.type === "text" && block.text) {
            onEvent({ type: "text", text: block.text });
          }
        }
      }
      if (event.type === "tool_call" && event.name) {
        onEvent({
          type: "tool",
          name: event.name,
          status: event.status ?? "running",
          args: event.args,
          result: event.result,
        });
      }
    }
    const result = await run.wait();
    const text =
      typeof result.result === "string"
        ? result.result
        : result.result
          ? JSON.stringify(result.result)
          : undefined;
    if (result.status === "error") {
      onEvent({ type: "error", message: `Run failed (${run.id}). ${text ?? ""}`.trim() });
      return;
    }
    onEvent({ type: "done", status: result.status, text });
  } catch (err) {
    if (err instanceof CursorAgentError) {
      onEvent({ type: "error", message: `Cursor SDK did not start: ${err.message}` });
      return;
    }
    onEvent({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    if (agent[Symbol.asyncDispose]) {
      await agent[Symbol.asyncDispose]();
    }
  }
}
