import { div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { shared } from "herdr";

export const MODES = [
  { id: "follow", label: "Follow selected space", icon: "folder" },
  { id: "tree", label: "Tree in Spaces", icon: "git-branch" },
  { id: "dots", label: "Dots in Spaces", icon: "circle-check" },
  { id: "tab", label: "Agents tab", icon: "files" },
  { id: "off", label: "Off", icon: "minus" },
];
export const modeOf = () => MODES.find((m) => m.id === shared("nested.mode")) ?? MODES[0];

export const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };

export const kidStatus = (k, listed = new Map()) => {
  const shown = listed.get(k.address);
  if (shown) return shown === "error" ? "blocked" : shown;
  return k.status === "error" ? "blocked" : k.status === "done" ? "idle" : k.status ?? null;
};

export const topStatus = (subs) => subs.map((s) => kidStatus(s.t)).reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null);
export const nameOf = (k) => k.name || k.template || k.program?.name || k.address;
export const whereOf = (k) => k.labels?.where || null;
export const sayOf = (k) => (typeof k.report === "string" ? k.report : k.report?.msg) ?? "";

const prefix = (addr) => (addr.includes("/") ? `${addr.split("/")[0]}/` : "");
export const parentOf = (k) => (k.parent ? (k.parent.includes("/") ? k.parent : prefix(k.address) + k.parent) : null);

export function kidsByParent(all, hidePlaced) {
  const by = new Map();
  for (const k of all) {
    if (k.state !== "live" || !k.parent || (hidePlaced && k.labels?.["herdr.space"])) continue;
    by.set(parentOf(k), [...(by.get(parentOf(k)) ?? []), k]);
  }
  return by;
}

export function subTree(by, addr, lead = []) {
  const kids = by.get(addr) ?? [];
  return kids.flatMap((k, i) => {
    const last = i === kids.length - 1;
    return [{ t: k, lines: [...lead, last ? "└" : "├"] }, ...subTree(by, k.address, [...lead, last ? "" : "│"])];
  });
}

export function roles(all) {
  const by = kidsByParent(all, false);
  const byAddress = new Map(all.map((k) => [k.address, k]));
  return (addr) => {
    const k = byAddress.get(addr);
    if (!k) return null;
    const up = parentOf(k);
    const subs = subTree(by, addr);
    if (!up && !subs.length) return null;
    return { parent: up ? byAddress.get(up) ?? { address: up } : null, subs: subs.length, status: topStatus(subs) };
  };
}

export const subOf = (r) => `Sub-agent of ${r.parent.name || whereOf(r.parent) || nameOf(r.parent)}`;

export function leadChip(t, r) {
  if (!r?.subs) return null;
  const color = t[r.status] ?? t.dim;
  return div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(color + "1f").text_size(11).font_medium().text_color(color).child(`Lead of ${r.subs}`);
}

export function crews(all) {
  const by = kidsByParent(all, true);
  const out = {};
  for (const k of all) {
    const space = k.state === "live" && k.labels?.["herdr.space"];
    if (space) (out[prefix(k.address) + space] ??= []).push(...subTree(by, k.address));
  }
  return out;
}

export function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export function badge(t, status) {
  if (status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
  if (status === "blocked") return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
  if (status === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
  return div().size(5).mx(4).flex_none().rounded(3).bg(t.dim);
}

export function head(t, k) {
  const pic = icon(k.program, 14, t.foreground);
  return h_flex().gap(8).items_center()
    .when(Boolean(pic), (el) => el.child(pic))
    .child(div().flex_1().min_w(0).truncate().child(nameOf(k)))
    .when(k.turn != null, (el) => el.child(div().flex_none().text_size(11).text_color(t.dim).child(`turn ${k.turn}`)))
    .child(badge(t, kidStatus(k)));
}
