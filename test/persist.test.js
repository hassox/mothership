import { afterAll, beforeAll, expect, test } from "bun:test";
import { scratchCore, FAKE } from "./core.js";

const core = scratchCore();
beforeAll(() => core.start());
afterAll(() => core.stop());

const facts = (t) => {
  const k = core.get(t);
  return { parent: k.parent, role: k.labels["org.role"], profile: k.labels["org.profile"] };
};

test("F8 labels and parents survive a core restart, the way hc update restarts it", async () => {
  const lead = core.json("run", "--bg", "--name", "lead", "--label", "org.role=lead", "--label", "org.profile=poteto", "--", FAKE, "claude-code", "idle").address;
  const sub = core.json("run", "--bg", "--name", "sub", "--parent", lead, "--label", "org.role=sub-lead", "--", FAKE, "codex", "idle").address;
  const worker = core.json("run", "--bg", "--name", "worker", "--parent", sub, "--label", "org.role=worker", "--label", "org.profile=reviewer", "--", FAKE, "pi", "working").address;
  const before = [lead, sub, worker].map(facts);
  expect(before).toEqual([
    { parent: null, role: "lead", profile: "poteto" },
    { parent: lead, role: "sub-lead", profile: undefined },
    { parent: sub, role: "worker", profile: "reviewer" },
  ]);

  core.json("server", "restart");
  await core.until(() => core.hc("get", "--json", worker).code === 0);
  expect([lead, sub, worker].map(facts)).toEqual(before);
  expect(core.get(worker).state).toBe("live");
});

test("F8 a kept terminal keeps its labels across a core stop and start", async () => {
  const kept = core.json("run", "--bg", "--keep", "--name", "kept", "--label", "org.role=lead", "--label", "org.profile=poteto", "--", FAKE, "claude-code", "idle").address;
  core.json("server", "stop");
  core.start();
  const k = await core.until(() => {
    const r = core.hc("get", "--json", kept);
    return r.code === 0 && JSON.parse(r.out).state === "live" ? JSON.parse(r.out) : null;
  });
  expect([k.labels["org.role"], k.labels["org.profile"]]).toEqual(["lead", "poteto"]);
});
