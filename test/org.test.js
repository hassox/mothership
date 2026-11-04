import { describe, expect, test } from "bun:test";
import { orgTree, facets, tagText } from "../shared/org.js";
import { all, shell, lone, notes, remoteKid } from "./fixture.js";

const shape = (nodes) => nodes.map((n) => [n.address, ...(n.kids.length ? [shape(n.kids)] : [])]);

describe("F3 nested leaders", () => {
  test("the tree holds every agent under its leader, and leaves plain shells out", () => {
    expect(shape(orgTree(all))).toEqual([
      ["t1", [["t2", [["t3"], ["t4"]]], ["t5"]]],
      ["t6"],
      ["vps/t2", [["vps/t3"]]],
    ]);
  });

  test("a leader counts its direct reports; a crew member with its own crew leads too", () => {
    const [prime] = orgTree(all);
    expect([prime.leader, prime.reports]).toEqual([true, 2]);
    expect(prime.kids.map((k) => [k.address, k.leader, k.reports])).toEqual([["t2", true, 2], ["t5", false, 0]]);
  });

  test("a top-level agent stays a leader with no crew; a sub-lead whose crew ends stays in its lead's crew", () => {
    const finished = all.map((k) => (k.parent === "t2" && !k.address.includes("/") ? { ...k, state: "finished" } : k));
    const [prime] = orgTree(finished);
    expect(shape([prime])).toEqual([["t1", [["t2"], ["t5"]]]]);
    expect([prime.kids[0].leader, prime.kids[0].reports]).toEqual([false, 0]);
    const solo = [{ ...lone, address: "t9" }, { ...notes, address: "t10", parent: "t9", state: "finished" }];
    expect(orgTree(solo).map((n) => [n.address, n.leader, n.reports])).toEqual([["t9", true, 0]]);
  });

  test("a sub-agent whose parent ended is top-level, so it leads", () => {
    const orphan = all.map((k) => (k.address === "t1" ? { ...k, state: "finished" } : k));
    expect(orgTree(orphan).map((n) => n.address)).toEqual(["t2", "t5", "t6", "vps/t2"]);
  });

  test("a plain shell with agent children leads them; a lone plain shell is not in the org", () => {
    const sh = { ...shell, address: "t30" };
    const kid = { ...notes, address: "t31", parent: "t30" };
    expect(orgTree([sh, kid, shell]).map((n) => n.address)).toEqual(["t30"]);
  });

  test("a remote child with a bare parent nests under the parent on its machine", () => {
    const remote = orgTree(all)[2];
    expect(remote.machine).toBe("vps");
    expect(remote.kids[0].address).toBe("vps/t3");
  });
});

describe("status", () => {
  test("a row's status is the agent's own, with the app's done kept", () => {
    const [prime] = orgTree(all, new Map([["t1", "done"]]));
    expect([prime.status, prime.kids[0].status, prime.kids[0].kids[0].status]).toEqual(["done", "idle", "blocked"]);
  });

  test("a leader's team status is the most urgent anywhere below it, with a tally", () => {
    const [prime] = orgTree(all);
    expect([prime.urgent, prime.tally]).toEqual(["blocked", { idle: 2, blocked: 1, working: 1 }]);
    expect([prime.kids[0].urgent, prime.kids[0].tally]).toEqual(["blocked", { blocked: 1, working: 1 }]);
    const [, lone] = orgTree(all);
    expect([lone.urgent, lone.tally]).toEqual([null, {}]);
  });
});

describe("order", () => {
  const roots = (listed) => orgTree(all, new Map(Object.entries(listed))).map((n) => n.address);

  test("whatever needs you rises to the top, then done, then working, then idle", () => {
    expect(roots({})).toEqual(["t1", "t6", "vps/t2"]);
    expect(roots({ t6: "blocked", t3: "idle" })).toEqual(["t6", "t1", "vps/t2"]);
    expect(roots({ t3: "idle", "vps/t2": "done" })).toEqual(["vps/t2", "t1", "t6"]);
  });

  test("a leader rises with its team, and siblings sort the same way at every depth", () => {
    const [prime] = orgTree(all, new Map([["t3", "idle"], ["t4", "idle"], ["t5", "blocked"]]));
    expect(prime.kids.map((k) => k.address)).toEqual(["t5", "t2"]);
    const [lead] = orgTree(all, new Map([["t3", "idle"], ["t4", "blocked"]]));
    expect(lead.kids[0].kids.map((k) => k.address)).toEqual(["t4", "t3"]);
  });

  test("a leader keeps the order its whole crew earns, at any depth", () => {
    expect(orgTree(all, new Map([["vps/t3", "blocked"], ["t3", "idle"]])).map((n) => n.address)).toEqual(["vps/t2", "t1", "t6"]);
  });
});

describe("names", () => {
  test("a row is named by its terminal name, then where a top-level one is shown, then its program", () => {
    const where = { address: "t20", state: "live", status: "idle", report: {}, labels: { where: "prime / 1" }, program: { name: "Claude Code" } };
    const names = orgTree([where, { ...where, address: "t21", parent: "t20" }, { ...where, address: "t22", parent: "t20", name: "fix" }])[0];
    expect([names.name, ...names.kids.map((k) => k.name)]).toEqual(["prime / 1", "Claude Code", "fix"]);
  });
});

describe("F4 untagged", () => {
  test("missing labels, report and status read as null, never a placeholder", () => {
    const bare = { address: "t11", state: "live", parent: "t5", status: undefined, report: undefined, labels: undefined };
    const [notesNode] = orgTree([{ ...notes, parent: undefined }, bare]);
    const pick = (n) => ({ role: n.role, profile: n.profile, harness: n.harness, status: n.status });
    expect(pick(notesNode)).toEqual({ role: null, profile: null, harness: "claude-code", status: "idle" });
    expect(pick(notesNode.kids[0])).toEqual({ role: null, profile: null, harness: null, status: null });
  });

  test("tagText holds only the labels that are set", () => {
    expect(tagText({ labels: { "org.role": "worker", "org.profile": "poteto" } })).toBe("worker · poteto");
    expect(tagText({ labels: { "org.role": "worker" } })).toBe("worker");
    expect(tagText({ labels: { "org.profile": "poteto" } })).toBe("poteto");
    expect(tagText({ labels: { "org.role": "  " } })).toBe(null);
    expect(tagText(shell)).toBe(null);
    expect(tagText({})).toBe(null);
  });

  test("facets count set values and leave missing ones out", () => {
    const f = facets(orgTree(all));
    expect(Object.fromEntries(f.role)).toEqual({ lead: 1, "sub-lead": 1, worker: 2, "two words": 1 });
    expect(Object.fromEntries(f.profile)).toEqual({ poteto: 3, reviewer: 1 });
    expect(Object.fromEntries(f.harness)).toEqual({ "claude-code": 4, codex: 1, pi: 2 });
    expect(Object.fromEntries(f.machine)).toEqual({ local: 6, vps: 2 });
    expect(Object.fromEntries(f.status)).toEqual({ working: 2, idle: 5, blocked: 1 });
  });
});
