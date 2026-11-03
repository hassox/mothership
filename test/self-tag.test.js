import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { scratchCore, ROOT, FAKE } from "./core.js";

const core = scratchCore();
const HOOK = join(ROOT, "plugins/hc-context/hc-context.sh");
const profileOf = (t) => core.get(t).labels["org.profile"];

beforeAll(() => core.start());
afterAll(() => core.stop());

describe("F1 self-tag", () => {
  test("the launcher tags the profile, then runs the agent in its place", async () => {
    const { address } = core.json("run", "--bg", "--name", "launched", "--", "herdr-org-launch", "poteto", FAKE, "claude-code", "idle");
    await core.until(() => core.get(address).status?.app === "claude-code");
    expect(profileOf(address)).toBe("poteto");
  });

  test("the start hook tags HC_PROFILE and still prints valid hook JSON", () => {
    const r = core.hc("run", "--name", "hooked", "--", "sh", "-c", `echo '{}' | HC_PROFILE=reviewer sh ${HOOK} claude`);
    const hook = JSON.parse(r.out.trim());
    expect(hook.hookSpecificOutput.hookEventName).toBe("SessionStart");
    expect(hook.hookSpecificOutput.additionalContext).toContain("hc --skill");
    expect(profileOf("hooked")).toBe("reviewer");
  });

  test("the start hook writes no profile when HC_PROFILE is unset", () => {
    const r = core.hc("run", "--name", "bare", "--", "sh", "-c", `echo '{}' | env -u HC_PROFILE sh ${HOOK} codex`);
    expect(JSON.parse(r.out.trim()).hookSpecificOutput.additionalContext).toContain("org.role");
    expect(core.get("bare").labels["org.profile"]).toBeUndefined();
  });

  test("the pi extension tags HC_PROFILE on session_start", async () => {
    const { address } = core.json("run", "--bg", "--name", "pi-agent", "--", FAKE, "pi", "idle");
    const handlers = {};
    const saved = { ...process.env };
    Object.assign(process.env, core.env, { HC_TERMINAL_ID: address, HC_PROFILE: "poteto" });
    try {
      const { default: extension } = await import("../plugins/hc-context/pi.ts");
      extension({ on: (event, fn) => (handlers[event] = fn) });
      await handlers.session_start({});
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
    expect(profileOf(address)).toBe("poteto");
  });
});
