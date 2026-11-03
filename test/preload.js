import { mock } from "bun:test";
import { copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
for (const mod of readdirSync(join(root, "mods"))) {
  for (const file of readdirSync(join(root, "shared"))) copyFileSync(join(root, "shared", file), join(root, "mods", mod, file));
}

export function el(kind, arg) {
  const node = { _kind: kind, _arg: arg, _kids: [], _props: {} };
  const proxy = new Proxy(node, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === "then") return undefined;
      if (prop === "child") return (c) => (c == null || c === false ? proxy : (target._kids.push(c), proxy));
      if (prop === "children") return (cs) => ((cs ?? []).forEach((c) => c != null && c !== false && target._kids.push(c)), proxy);
      if (prop === "when") return (c, f) => (c ? f(proxy) : proxy);
      return (...args) => ((target._props[prop] = args), proxy);
    },
  });
  return proxy;
}

const store = new Map();
globalThis.localStorage ??= {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

class View {}
const gpui = { View, div: () => el("div"), svg: (p) => el("svg", p), image: (p) => el("image", p) };

export const InputState = {
  new: (o = {}) => {
    const handlers = [];
    return {
      _value: o.value ?? "",
      placeholder: o.placeholder,
      value() { return this._value; },
      set_value(v) { this._value = v; },
      type(v) { this._value = v; handlers.forEach((h) => h({}, cx())); },
      on(_event, h) { handlers.push(h); },
      focus() {},
    };
  },
};

mock.module("gpui-kit", () => gpui);
mock.module("gpui-base", () => ({
  h_flex: () => el("h_flex"),
  v_flex: () => el("v_flex"),
  InputState,
  Input: { new: (state) => el("input", state) },
}));

export const state = {
  terminals: [], panes: [], spaces: [], agents: [], focused: null, props: {}, shared: {}, ran: [], overlays: [], order: [],
};
const theme = new Proxy({}, { get: (_t, k) => (typeof k === "string" ? `#${k}` : undefined) });
mock.module("herdr", () => ({
  agents: () => state.agents,
  terminals: () => state.terminals,
  panes: () => state.panes,
  spaces: () => state.spaces,
  focused: () => state.focused,
  props: () => state.props,
  theme: () => theme,
  shared: (k) => state.shared[k],
  setShared: (k, v) => { state.shared[k] = v; },
  setAgentOrder: (list) => { state.order = list; },
  run: (name, args) => { state.ran.push([name, args]); },
  openOverlay: (spec) => { state.overlays.push(spec); return "o1"; },
  closeOverlay: () => null,
  window: () => ({ platform: "macos", titlebar: "none", buttons: false, maximized: false, fullscreen: false, active: true }),
  layout: () => ({ id: "root", children: [{ id: "sidebar", size: { px: 268 } }] }),
  nextCommand: () => new Promise(() => {}),
  notify: () => "n1",
  hc: async () => ({ code: 0, stdout: "", stderr: "" }),
  exec: async () => ({ code: 0, stdout: "", stderr: "" }),
  home: () => "/Users/me",
  settings: () => ({ zoom: 1, font_family: "mono" }),
  keys: () => [],
  machines: () => [{ name: null, layout: "ready" }],
  watchFolder: () => new Promise(() => {}),
}));

export const cx = () => ({ notify() {}, stop_propagation() {}, timer: { every() {} }, spawn() {} });

export function texts(node) {
  if (typeof node === "string") return [node];
  if (!node?._kids) return [];
  return node._kids.flatMap(texts);
}

export function findId(node, id) {
  if (!node?._kids) return null;
  if (node._props.id?.[0] === id) return node;
  for (const k of node._kids) {
    const found = findId(k, id);
    if (found) return found;
  }
  return null;
}

export function click(node) {
  node._props.on_click[0]({}, cx());
}
