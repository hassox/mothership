import { expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./core.js";

const plan = (...goals) => {
  const r = Bun.spawnSync(["make", "-n", "-s", "APP=/nowhere", ...goals], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  if (r.exitCode !== 0) throw new Error(r.stderr.toString());
  return r.stdout.toString().split("\n").map((l) => l.match(/uninstall-mod\.sh \S+ \S+ (\S+)/)?.[1] ?? l.match(/(uninstall-layout|plugin\.sh uninstall)/)?.[1] ?? (l.includes("herdr-org-launch") ? "launcher" : null)).filter(Boolean);
};

test("removing a mod also removes the mods that need it, first", () => {
  expect(plan("uninstall-mothership-agents")).toEqual(["mothership-spaces", "mothership-agents"]);
  expect(plan("uninstall-mothership-crew")).toEqual(["mothership-spaces", "mothership-crew"]);
  expect(plan("uninstall-mothership-pane")).toEqual(["mothership-pane"]);
});

test("make uninstall leaves the layout first, then removes every mod, the launcher and the plugin", () => {
  const all = plan("uninstall");
  expect(all[0]).toBe("uninstall-layout");
  expect(all.filter((s) => s.startsWith("mothership-")).sort()).toEqual(["mothership-agents", "mothership-crew", "mothership-pane", "mothership-spaces", "mothership-status", "mothership-tabs"]);
  expect(all.slice(-2)).toEqual(["launcher", "plugin.sh uninstall"]);
});

test("removing one mod puts Herdr's own mod back in its layout block, and leaves folders it did not install", () => {
  const app = mkdtempSync("/tmp/hcu.");
  mkdirSync(join(app, "layouts"));
  const layout = join(app, "layouts/mothership.json");
  writeFileSync(layout, JSON.stringify({ children: [{ content: { mod: "mothership-pane" } }, { content: { mod: "mothership-tabs" } }] }));
  for (const [mod, ours] of [["mothership-pane", true], ["mothership-tabs", false]]) {
    mkdirSync(join(app, "mods", mod), { recursive: true });
    if (ours) writeFileSync(join(app, "mods", mod, ".mothership"), "");
  }
  const remove = (mod) => Bun.spawnSync(["sh", "scripts/uninstall-mod.sh", app, "mothership", mod], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  expect(remove("mothership-pane").exitCode).toBe(0);
  expect(remove("mothership-tabs").exitCode).toBe(0);
  expect(existsSync(join(app, "mods/mothership-pane"))).toBe(false);
  expect(existsSync(join(app, "mods/mothership-tabs"))).toBe(true);
  expect(JSON.parse(readFileSync(layout, "utf8")).children.map((c) => c.content.mod)).toEqual(["pane", "mothership-tabs"]);
});

test("the launcher link goes only when it points into this repo", () => {
  const home = mkdtempSync("/tmp/hcu.");
  mkdirSync(join(home, ".local/bin"), { recursive: true });
  const link = join(home, ".local/bin/herdr-org-launch");
  const run = () => Bun.spawnSync(["make", "-s", `HOME=${home}`, "uninstall-launcher"], { cwd: ROOT });
  symlinkSync("/somewhere/else/herdr-org-launch", link);
  expect(run().exitCode).toBe(0);
  expect(readlinkSync(link)).toBe("/somewhere/else/herdr-org-launch");
  Bun.spawnSync(["rm", link]);
  symlinkSync(join(ROOT, "bin/herdr-org-launch"), link);
  expect(run().exitCode).toBe(0);
  expect(() => lstatSync(link)).toThrow();
});
