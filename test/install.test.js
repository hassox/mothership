import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./core.js";

const plan = (...goals) => {
  const r = Bun.spawnSync(["make", "-n", "-s", "APP=/nowhere", ...goals], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return r.stdout.toString().split("\n").map((l) => l.match(/install-mod\.sh \S+ \S+ (\S+)/)?.[1] ?? l.match(/(install-layout|plugin\.sh install)/)?.[1] ?? (l.includes("herdr-org-launch") ? "launcher" : null)).filter(Boolean);
};

test("a mod brings the mods it needs, and nothing else", () => {
  expect(plan("mothership-spaces")).toEqual(["install-layout", "mothership-agents", "mothership-crew", "mothership-spaces"]);
  expect(plan("mothership-pane")).toEqual(["install-layout", "mothership-pane"]);
  expect(plan("mothership-pane", "mothership-tabs")).toEqual(["install-layout", "mothership-pane", "mothership-tabs"]);
});

test("make with no names installs every mod, the launcher and the plugin", () => {
  const all = plan();
  expect(all.filter((s) => s.startsWith("mothership-")).sort()).toEqual(["mothership-agents", "mothership-crew", "mothership-pane", "mothership-spaces", "mothership-status", "mothership-tabs"]);
  expect(all).toContain("launcher");
  expect(all).toContain("plugin.sh install");
});

test("installing a mod swaps only the block of the Herdr mod it was cloned from", () => {
  const file = join(mkdtempSync("/tmp/hcl."), "mothership.json");
  const layout = { id: "root", children: [{ content: { mod: "agents" } }, { content: { mod: "tabs" } }], pane: { header: { content: { mod: "pane" } } } };
  writeFileSync(file, JSON.stringify(layout));
  const swap = (mod) => Bun.spawnSync(["python3", "scripts/swap-layout.py", file, `mods/${mod}`], { cwd: ROOT });
  swap("mothership-agents");
  swap("mothership-crew");
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ ...layout, children: [{ content: { mod: "mothership-agents" } }, { content: { mod: "tabs" } }] });
  swap("mothership-pane");
  expect(JSON.parse(readFileSync(file, "utf8")).pane.header.content.mod).toBe("mothership-pane");
});
