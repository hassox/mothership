import { expect, test } from "bun:test";
import { kidStatus } from "../shared/subagents.js";

test("the app's own status wins, done included, and error reads as needs you", () => {
  const listed = new Map([["t1", "done"], ["t2", "blocked"], ["t3", "error"]]);
  expect(["t1", "t2", "t3"].map((address) => kidStatus({ address, status: "idle" }, listed))).toEqual(["done", "blocked", "blocked"]);
});

test("a terminal the app does not list uses the core's word, with done as idle", () => {
  expect(["done", "working", "error", null].map((status) => kidStatus({ address: "t9", status }))).toEqual(["idle", "working", "blocked", null]);
});
