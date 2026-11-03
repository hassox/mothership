import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const message = readFileSync(new URL("./hc-context.txt", import.meta.url), "utf8").trim();

export default function hcContext(pi: ExtensionAPI) {
  if (!process.env.HC_TERMINAL_ID) return;
  pi.on("session_start", async () => {
    const { HC_TERMINAL_ID: terminal, HC_PROFILE: profile } = process.env;
    if (terminal && profile) await promisify(execFile)("hc", ["label", terminal, `org.profile=${profile}`]).catch(() => {});
  });
  pi.on("before_agent_start", (event) => ({ systemPrompt: `${event.systemPrompt}\n\n${message}` }));
}
