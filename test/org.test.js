import { describe, expect, test } from "bun:test";
import { orgTree, facets, tagText } from "../shared/org.js";
import { all, shell, lone, notes, remoteKid } from "./fixture.js";

const shape = (nodes) => nodes.map((n) => [n.address, ...(n.kids.length ? [shape(n.kids)] : [])]);

describe("F3 nested leaders", () => {
  test("leaders scope returns only top leaders, each with its full subtree", () => {
    expect(shape(orgTree(all, "leaders"))).toEqual([
      ["t1", [["t2", [["t3"], ["t4"]]], ["t5"]]],
      ["vps/t2", [["vps/t3"]]],
    ]);
  });

  test("a sub-agent with children is a leader inside its leader's tree", () => {
    const [prime] = orgTree(all, "leaders");
    expect(prime.leader).toBe(true);
    expect(prime.kids.map((k) => [k.address, k.leader])).toEqual([["t2", true], ["t5", false]]);
  });

  test("all scope adds lone agents as roots and still leaves plain shells out", () => {
    expect(orgTree(all, "all").map((n) => n.address)).toEqual(["t1", "t6", "vps/t2"]);
  });

  test("a leader whose last child ends leaves the leaders scope and stays in all", () => {
    const finished = all.map((k) => (k.parent === "t2" && !k.address.includes("/") ? { ...k, state: "finished" } : k));
    const sub = orgTree(finished, "leaders")[0].kids.find((k) => k.address === "t2");
    expect(sub.leader).toBe(false);
    const solo = [{ ...lone, address: "t9" }, { ...notes, address: "t10", parent: "t9", state: "finished" }];
    expect(orgTree(solo, "leaders")).toEqual([]);
    expect(orgTree(solo, "all").map((n) => n.address)).toEqual(["t9"]);
  });

  test("a remote child with a bare parent nests under the parent on its machine", () => {
    const remote = orgTree(all, "leaders")[1];
    expect(remote.machine).toBe("vps");
    expect(remote.kids[0].address).toBe("vps/t3");
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
