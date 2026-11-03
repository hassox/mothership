import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./core.js";

const plan = (...goals) => {
  const r = Bun.spawnSync(["make", "-n", "-s", "APP=/nowhere", ...goals], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return r.stdout.toString().split("\n").map((l) => l.match(/install-mod\.sh \S+ \S+ (\S+)/)?.[1] ?? l.match(/^(?:sh scripts\/)?(install-layout|install-plugin)/)?.[1] ?? (l.includes("herdr-org-launch") ? "launcher" : null)).filter(Boolean);
};

test("a mod brings the mods it needs, and nothing else", () => {
  expect(plan("nested-spaces")).toEqual(["install-layout", "nested-agents", "nested-crew", "nested-spaces"]);
  expect(plan("nested-pane")).toEqual(["install-layout", "nested-pane"]);
  expect(plan("nested-pane", "nested-tabs")).toEqual(["install-layout", "nested-pane", "nested-tabs"]);
});

test("make with no names installs every mod, the launcher and the plugin", () => {
  const all = plan();
  expect(all.filter((s) => s.startsWith("nested-")).sort()).toEqual(["nested-agents", "nested-crew", "nested-pane", "nested-spaces", "nested-status", "nested-tabs"]);
  expect(all).toContain("launcher");
  expect(all).toContain("install-plugin");
});

test("installing a mod swaps only the block of the Herdr mod it was cloned from", () => {
  const file = join(mkdtempSync("/tmp/hcl."), "nested.json");
  const layout = { id: "root", children: [{ content: { mod: "agents" } }, { content: { mod: "tabs" } }], pane: { header: { content: { mod: "pane" } } } };
  writeFileSync(file, JSON.stringify(layout));
  const swap = (mod) => Bun.spawnSync(["python3", "scripts/swap-layout.py", file, `mods/${mod}`], { cwd: ROOT });
  swap("nested-agents");
  swap("nested-crew");
  expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ ...layout, children: [{ content: { mod: "nested-agents" } }, { content: { mod: "tabs" } }] });
  swap("nested-pane");
  expect(JSON.parse(readFileSync(file, "utf8")).pane.header.content.mod).toBe("nested-pane");
});
