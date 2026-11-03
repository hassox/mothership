import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./core.js";

const PLUGIN = join(ROOT, "plugins/hc-context");
const LISTED = {
  claude: "  ❯ hc-context@hassox-mothership\n    Status: ✔ enabled\n",
  codex: "hc-context@hassox-mothership  installed, enabled  0.1.0\n",
  grok: `  hc-context-1: hc-context [local: ${PLUGIN}]\n`,
  agy: "- hc-context (enabled, 0.1.0)\n",
  pi: `  ${PLUGIN}\n`,
};

function harnesses(present, installed = []) {
  const dir = mkdtempSync("/tmp/hcp.");
  const bin = join(dir, "bin");
  mkdirSync(bin);
  const fake = join(dir, "fake");
  writeFileSync(fake, '#!/bin/sh\nn=$(basename "$0")\necho "$n $*" >> "$FAKE_DIR/log"\ncase "$*" in "plugin list"|list) cat "$FAKE_DIR/$n.list" 2>/dev/null ;; esac\n');
  chmodSync(fake, 0o755);
  for (const h of present) symlinkSync(fake, join(bin, h));
  for (const h of installed) writeFileSync(join(dir, `${h}.list`), LISTED[h]);
  if (!installed.includes("codex")) writeFileSync(join(dir, "codex.list"), "hc-context@hassox-mothership  not installed\n");
  const run = (action, env = {}, stdin) => {
    const argv = stdin == null ? ["sh", "scripts/plugin.sh", action] : ["sh", "-c", `{ printf '%s' "$ANSWERS"; sleep 2; } | script -q /dev/null sh scripts/plugin.sh ${action}`];
    const r = Bun.spawnSync(argv, { cwd: ROOT, env: { PATH: `${bin}:/usr/bin:/bin`, FAKE_DIR: dir, ANSWERS: stdin ?? "", ...env }, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
    const log = (() => { try { return readFileSync(join(dir, "log"), "utf8"); } catch { return ""; } })();
    return { code: r.exitCode, out: r.stdout.toString(), changes: log.split("\n").filter((l) => l && !/ list$/.test(l)) };
  };
  return run;
}

test("without a terminal or HARNESSES it installs into every harness on PATH that lacks it", () => {
  const run = harnesses(["claude", "codex", "pi"], ["pi"]);
  const r = run("install");
  expect(r.code).toBe(0);
  expect(r.changes).toEqual([
    `claude plugin marketplace add ${ROOT}`, "claude plugin install hc-context@hassox-mothership",
    `codex plugin marketplace add ${ROOT}`, "codex plugin add hc-context@hassox-mothership",
  ]);
  expect(r.out).toContain("pi: hc-context is already installed");
  expect(r.out).toContain("grok: not on PATH");
});

test("HARNESSES picks which harnesses, without asking", () => {
  const r = harnesses(["claude", "codex", "grok", "agy", "pi"])("install", { HARNESSES: "grok pi" });
  expect(r.changes).toEqual([`grok plugin install ${PLUGIN} --trust`, `pi install ${PLUGIN}`]);
  expect(harnesses(["claude"])("install", { HARNESSES: "" }).changes).toEqual([]);
});

test("in a terminal it asks per harness, and Enter means yes", () => {
  const r = harnesses(["claude", "codex", "grok", "agy", "pi"])("install", {}, "n\n\ny\nn\nno\n");
  expect(r.code).toBe(0);
  expect(r.changes).toEqual([`codex plugin marketplace add ${ROOT}`, "codex plugin add hc-context@hassox-mothership", `grok plugin install ${PLUGIN} --trust`]);
  expect(r.out).toContain("Install hc-context into claude? [Y/n]");
});

test("uninstall removes it, and the marketplaces, only where it is installed", () => {
  const r = harnesses(["claude", "codex", "grok", "agy", "pi"], ["claude", "codex", "agy", "pi"])("uninstall");
  expect(r.code).toBe(0);
  expect(r.changes).toEqual([
    "claude plugin uninstall hc-context@hassox-mothership", "claude plugin marketplace remove hassox-mothership",
    "codex plugin remove hc-context@hassox-mothership", "codex plugin marketplace remove hassox-mothership",
    "agy plugin uninstall hc-context",
    `pi remove ${PLUGIN}`,
  ]);
  expect(r.out).toContain("grok: hc-context is not installed");
});
