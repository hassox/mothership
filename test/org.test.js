import { describe, expect, test } from "bun:test";
import { orgTree, facets, tagText } from "../shared/org.js";
import { all, shell, lone, notes, remoteKid } from "./fixture.js";

const shape = (nodes) => nodes.map((n) => [n.address, ...(n.kids.length ? [shape(n.kids)] : [])]);

describe("F3 nested leaders", () => {
  test("leaders scope keeps only leaders: top-level agents and sub-agents with children", () => {
    expect(shape(orgTree(all, "leaders"))).toEqual([["t1", [["t2"]]], ["t6"], ["vps/t2"]]);
  });

  test("all scope keeps every agent, each leader with its full subtree, and leaves plain shells out", () => {
    expect(shape(orgTree(all, "all"))).toEqual([
      ["t1", [["t2", [["t3"], ["t4"]]], ["t5"]]],
      ["t6"],
      ["vps/t2", [["vps/t3"]]],
    ]);
  });

  test("a leader counts its direct reports, including the ones the leaders scope hides", () => {
    const [prime] = orgTree(all, "leaders");
    expect([prime.leader, prime.reports]).toEqual([true, 2]);
    expect([prime.kids[0].address, prime.kids[0].leader, prime.kids[0].reports]).toEqual(["t2", true, 2]);
    expect(orgTree(all, "all")[0].kids.map((k) => [k.address, k.leader])).toEqual([["t2", true], ["t5", false]]);
  });

  test("a top-level agent stays a leader with no children; a sub-agent stops leading when its last child ends", () => {
    const finished = all.map((k) => (k.parent === "t2" && !k.address.includes("/") ? { ...k, state: "finished" } : k));
    expect(shape(orgTree(finished, "leaders"))[0]).toEqual(["t1"]);
    const solo = [{ ...lone, address: "t9" }, { ...notes, address: "t10", parent: "t9", state: "finished" }];
    expect(orgTree(solo, "leaders").map((n) => [n.address, n.leader, n.reports])).toEqual([["t9", true, 0]]);
  });

  test("a sub-agent whose parent ended is top-level, so it leads", () => {
    const orphan = all.map((k) => (k.address === "t1" ? { ...k, state: "finished" } : k));
    expect(orgTree(orphan, "leaders").map((n) => n.address)).toEqual(["t2", "t5", "t6", "vps/t2"]);
  });

  test("a plain shell with agent children leads them; a lone plain shell is not in the org", () => {
    const sh = { ...shell, address: "t30" };
    const kid = { ...notes, address: "t31", parent: "t30" };
    expect(orgTree([sh, kid, shell], "leaders").map((n) => n.address)).toEqual(["t30"]);
  });

  test("a remote child with a bare parent nests under the parent on its machine", () => {
    const remote = orgTree(all, "all")[2];
    expect(remote.machine).toBe("vps");
    expect(remote.kids[0].address).toBe("vps/t3");
  });
});

describe("names", () => {
  test("a row is named by its terminal name, then where a top-level one is shown, then its program", () => {
    const where = { address: "t20", state: "live", status: "idle", report: {}, labels: { where: "prime / 1" }, program: { name: "Claude Code" } };
    const names = orgTree([where, { ...where, address: "t21", parent: "t20" }, { ...where, address: "t22", parent: "t20", name: "fix" }], "all")[0];
    expect([names.name, ...names.kids.map((k) => k.name)]).toEqual(["prime / 1", "Claude Code", "fix"]);
  });
});

describe("F4 untagged", () => {
  test("missing labels, report and status read as null, never a placeholder", () => {
    const bare = { address: "t11", state: "live", parent: "t5", status: undefined, report: undefined, labels: undefined };
    const [notesNode] = orgTree([{ ...notes, parent: undefined }, bare], "all");
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
    const f = facets(orgTree(all, "all"));
    expect(Object.fromEntries(f.role)).toEqual({ lead: 1, "sub-lead": 1, worker: 2, "two words": 1 });
    expect(Object.fromEntries(f.profile)).toEqual({ poteto: 3, reviewer: 1 });
    expect(Object.fromEntries(f.harness)).toEqual({ "claude-code": 4, codex: 1, pi: 2 });
    expect(Object.fromEntries(f.machine)).toEqual({ local: 6, vps: 2 });
    expect(Object.fromEntries(f.status)).toEqual({ working: 2, idle: 4, blocked: 1, done: 1 });
  });
});
