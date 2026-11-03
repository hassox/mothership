import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./core.js";

const SHARED = readdirSync(join(ROOT, "shared"));
const MODS = readdirSync(join(ROOT, "mods")).filter((m) => existsSync(join(ROOT, "mods", m, "mod.json")));
const imports = (file) => [...readFileSync(file, "utf8").matchAll(/from "\.\/([\w-]+\.js)"/g)].map((m) => m[1]);

function needed(mod) {
  const want = new Set();
  const visit = (file) => {
    for (const name of imports(file)) {
      if (!SHARED.includes(name) || want.has(name)) continue;
      want.add(name);
      visit(join(ROOT, "shared", name));
    }
  };
  visit(join(ROOT, "mods", mod, "main.js"));
  return [...want].sort();
}

test("each mod folder holds exactly the shared files it imports, so it works when copied alone", () => {
  for (const mod of MODS) {
    const present = SHARED.filter((name) => existsSync(join(ROOT, "mods", mod, name))).sort();
    expect([mod, present]).toEqual([mod, needed(mod)]);
  }
});

test("every copy matches shared/ (run make sync after editing shared/)", () => {
  for (const mod of MODS) {
    for (const name of needed(mod)) {
      expect([mod, name, readFileSync(join(ROOT, "mods", mod, name), "utf8") === readFileSync(join(ROOT, "shared", name), "utf8")]).toEqual([mod, name, true]);
    }
  }
});
