import { readFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const message = readFileSync(new URL("./hc-context.txt", import.meta.url), "utf8").trim();

export default function hcContext(pi: ExtensionAPI) {
  if (!process.env.HC_TERMINAL_ID) return;
  pi.on("before_agent_start", (event) => ({ systemPrompt: `${event.systemPrompt}\n\n${message}` }));
}
