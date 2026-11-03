import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scratchCore, ROOT, FAKE } from "./core.js";

const core = scratchCore();
beforeAll(() => core.start());
afterAll(() => core.stop());

test("the context message tells agents the spawn form this test runs", () => {
  const message = readFileSync(join(ROOT, "plugins/hc-context/hc-context.txt"), "utf8");
  expect(message).toContain("--label org.role=<role>");
  expect(message).toContain("herdr-org-launch <profile>");
});

test("F2 a parent's spawn line tags the child's role, the child tags its profile, and parent is the spawner", async () => {
  const spawn = `hc run --bg --name fix --label org.role=worker -- herdr-org-launch poteto ${FAKE} claude-code idle; sleep 600`;
  const { address: boss } = core.json("run", "--bg", "--name", "boss", "--", "sh", "-c", spawn);
  const fix = await core.until(() => {
    const r = core.hc("get", "--json", "fix");
    return r.code === 0 && JSON.parse(r.out).status ? JSON.parse(r.out) : null;
  });
  expect(fix.parent).toBe(boss);
  expect(fix.labels["org.role"]).toBe("worker");
  expect(fix.labels["org.profile"]).toBe("poteto");

  core.json("label", "fix", "org.role=reviewer");
  expect(core.get("fix").labels["org.role"]).toBe("reviewer");
});
