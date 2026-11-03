import { afterAll, beforeAll, expect, test } from "bun:test";
import { scratchCore, FAKE } from "./core.js";
import { state, cx, texts, findId } from "./preload.js";
import Agents from "../mods/nested-agents/main.js";

const core = scratchCore();
const terminals = new Map();
let waiters = [];
let events;

const asApp = (k) => ({ ...k, report: k.status ?? undefined, status: k.status?.state ?? null });

function apply({ type, terminal, data }) {
  const k = terminals.get(terminal);
  if (type === "created") terminals.set(terminal, asApp(data));
  else if (!k) return;
  else if (type === "labels") k.labels = data.labels;
  else if (type === "status") Object.assign(k, asApp({ status: data.status ?? data }));
  else if (type === "finished") k.state = "finished";
  else if (type === "removed") terminals.delete(terminal);
}

async function follow() {
  events = Bun.spawn(["hc", "events", "--json"], { env: core.env, stdout: "pipe" });
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of events.stdout) {
    buffer += decoder.decode(chunk);
    let line;
    while ((line = buffer.indexOf("\n")) >= 0) {
      const msg = JSON.parse(buffer.slice(0, line));
      buffer = buffer.slice(line + 1);
      if (msg.terminals) msg.terminals.forEach((k) => terminals.set(k.address, asApp(k)));
      else if (msg.params?.type) apply(msg.params);
      state.terminals = [...terminals.values()];
      waiters = waiters.filter((w) => !w());
    }
  }
}

const view = new Agents();
const rows = () => {
  const tree = view.render(cx());
  return (address) => findId(tree, `org-${address}`);
};

function timeUntil(check) {
  const start = performance.now();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("no render showed the change")), 3000);
    const w = () => check(rows()) && (clearTimeout(timer), resolve(performance.now() - start), true);
    if (!w()) waiters.push(w);
  });
}

const run = (...args) => core.json("run", "--bg", ...args).address;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const BOUND_MS = 500;

beforeAll(async () => {
  core.start();
  Object.assign(state, { agents: [], panes: [], spaces: [], focused: null, props: {}, shared: { "agents.sort": "org", "org.scope": "leaders" } });
  view.init({}, cx());
  follow();
  await new Promise((resolve) => waiters.push(() => (resolve(), true)));
});
afterAll(() => {
  events?.kill();
  core.stop();
});

test("F7 a label change, a new child and an ended child each reach the Org view without a reload", async () => {
  const lead = run("--name", "lead", "--", FAKE, "claude-code", "idle");
  const sub = run("--name", "sub", "--parent", lead, "--label", "org.role=sub-lead", "--label", "org.profile=poteto", "--", FAKE, "codex", "idle");
  const worker = run("--name", "worker", "--parent", sub, "--", FAKE, "pi", "working");
  await timeUntil((row) => row(sub));

  const relabel = [];
  for (const role of ["reviewer", "sub-lead", "reviewer", "sub-lead", "reviewer"]) {
    const shown = timeUntil((row) => texts(row(sub)).includes(`${role} · poteto`));
    core.json("label", sub, `org.role=${role}`);
    relabel.push(await shown);
  }

  const started = timeUntil((row) => texts(row(lead)).includes("2"));
  run("--name", "second", "--parent", lead, "--", FAKE, "pi", "idle");
  const startMs = await started;

  const ended = timeUntil((row) => row(sub) === null);
  core.json("kill", worker);
  const endMs = await ended;

  console.log(`F7 latency ms: relabel median ${median(relabel).toFixed(1)} (runs ${relabel.map((x) => x.toFixed(1)).join(", ")}), new child ${startMs.toFixed(1)}, ended child ${endMs.toFixed(1)}`);
  expect(median(relabel)).toBeLessThan(BOUND_MS);
  expect(startMs).toBeLessThan(BOUND_MS);
  expect(endMs).toBeLessThan(BOUND_MS);
}, 20000);
