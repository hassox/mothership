import { expect, test } from "bun:test";
import { spaceOf } from "../shared/subagents.js";
import { all, uiWorker, lead, lone, remoteKid } from "./fixture.js";

test("a terminal belongs to its own space, or to its nearest ancestor's", () => {
  expect(spaceOf(all, lead.address)).toBe("s1");
  expect(spaceOf(all, uiWorker.address)).toBe("s1");
});

test("a remote terminal's space id carries its machine", () => {
  expect(spaceOf(all, remoteKid.address)).toBe("vps/s9");
});

test("a terminal with no space up its chain has none", () => {
  expect(spaceOf(all, lone.address)).toBe(null);
  expect(spaceOf(all, "t404")).toBe(null);
});
