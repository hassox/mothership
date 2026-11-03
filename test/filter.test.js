import { describe, expect, test } from "bun:test";
import { orgTree, filterTree, parseQuery, toggleTerm } from "../shared/org.js";
import { all } from "./fixture.js";

const kept = (nodes) => nodes.flatMap((n) => [`${n.address}${n.match ? "" : "~"}`, ...kept(n.kids)]);
const run = (q, scope = "all") => kept(filterTree(orgTree(all, scope), q));

describe("F6 search and filter", () => {
  test("an empty query keeps the whole tree, all matching", () => {
    expect(run("")).toEqual(["t1", "t2", "t3", "t4", "t5", "t6", "vps/t2", "vps/t3"]);
    expect(run("   ")).toEqual(run(""));
  });

  test("a bare word matches name, address, role, profile or folder, ignoring case", () => {
    expect(run("REVIEW")).toEqual(["t1~", "t2"]);
    expect(run("vps/t3")).toEqual(["vps/t2~", "vps/t3"]);
    expect(run("sub-lead")).toEqual(["t1~", "t2"]);
    expect(run("reviewer")).toEqual(["t1~", "t2"]);
    expect(run("/repo/api")).toEqual(["t1~", "t2~", "t4"]);
  });

  test("each key searches only its field", () => {
    expect(run("role:worker")).toEqual(["t1~", "t2~", "t3", "t4"]);
    expect(run("profile:poteto")).toEqual(["t1", "t2~", "t3", "t6"]);
    expect(run("harness:codex")).toEqual(["t1~", "t2"]);
    expect(run("machine:vps")).toEqual(["vps/t2", "vps/t3"]);
    expect(run("status:blocked")).toEqual(["t1~", "t2~", "t3"]);
  });

  test("the same key twice is OR, different keys and words are AND", () => {
    expect(run("role:lead role:worker")).toEqual(["t1", "t2", "t3", "t4"]);
    expect(run("role:worker profile:poteto")).toEqual(["t1~", "t2~", "t3"]);
    expect(run("role:worker api")).toEqual(["t1~", "t2~", "t4"]);
  });

  test("quotes keep a value with spaces together", () => {
    expect(run('role:"two words"')).toEqual(["vps/t2~", "vps/t3"]);
    expect(parseQuery('role:"two words" x')).toMatchObject({ role: ["two words"], words: ["x"] });
  });

  test("an unknown key is a bare word, and a missing field never matches its key", () => {
    expect(run("foo:bar")).toEqual([]);
    expect(parseQuery("foo:bar").words).toEqual(["foo:bar"]);
    expect(run("role:e", "all").includes("t6")).toBe(false);
  });

  test("the leaders scope filters its own tree", () => {
    expect(run("profile:poteto", "leaders")).toEqual(["t1", "t6"]);
  });

  test("toggleTerm adds a term, then removes it, leaving the rest", () => {
    expect(toggleTerm("", "role", "worker")).toBe("role:worker");
    expect(toggleTerm("api role:worker", "role", "worker")).toBe("api");
    expect(toggleTerm("api", "role", "two words")).toBe('api role:"two words"');
    expect(toggleTerm('api role:"two words"', "role", "two words")).toBe("api");
    expect(toggleTerm("ROLE:Worker", "role", "worker")).toBe("");
  });
});
