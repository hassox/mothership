import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..");
export const FAKE = join(ROOT, "test/fake-agent.sh");

export function scratchCore() {
  const dir = mkdtempSync("/tmp/hco.");
  const env = { ...process.env };
  delete env.HC_TERMINAL_ID;
  delete env.HC_TERMINAL_SOCKET;
  delete env.HC_SCOPE;
  Object.assign(env, {
    HC_SESSION: `org${process.pid}`,
    XDG_STATE_HOME: join(dir, "s"),
    XDG_CONFIG_HOME: join(dir, "c"),
    XDG_DATA_HOME: join(dir, "d"),
    XDG_RUNTIME_DIR: join(dir, "r"),
    PATH: `${join(ROOT, "bin")}:${process.env.PATH}`,
  });
  const hc = (...args) => {
    const r = Bun.spawnSync(["hc", ...args], { env, stdout: "pipe", stderr: "pipe" });
    return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
  };
  const json = (...args) => {
    const r = hc(args[0], "--json", ...args.slice(1));
    if (r.code !== 0) throw new Error(`hc ${args.join(" ")}: ${r.err}`);
    return JSON.parse(r.out);
  };
  const get = (t) => json("get", t);
  const start = () => json("server", "start");
  const stop = () => {
    hc("server", "stop");
    rmSync(dir, { recursive: true, force: true });
  };
  const until = async (check, ms = 5000) => {
    const end = Date.now() + ms;
    for (;;) {
      const value = check();
      if (value) return value;
      if (Date.now() > end) throw new Error("timed out");
      await Bun.sleep(25);
    }
  };
  return { env, hc, json, get, start, stop, until };
}
