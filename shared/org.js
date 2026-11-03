import { kidsByParent, parentOf, nameOf, whereOf, kidStatus, RANK } from "./subagents.js";

export const KEYS = ["role", "profile", "harness", "machine", "status"];
export const SCOPES = [
  { id: "leaders", label: "Leaders" },
  { id: "all", label: "All" },
];

const urgency = (n) => Math.max(RANK[n.status] ?? 0, RANK[n.urgent] ?? 0);
const byUrgency = (nodes) => nodes.sort((a, b) => urgency(b) - urgency(a));
const label = (k, key) => k.labels?.[key]?.trim() || null;
const isAgent = (k) => k.status != null || k.report != null;

export function tagText(k) {
  return [label(k, "org.role"), label(k, "org.profile")].filter(Boolean).join(" · ") || null;
}

export function orgTree(all, scope, listed = new Map()) {
  const live = new Set(all.filter((k) => k.state === "live").map((k) => k.address));
  const by = kidsByParent(all, false);
  const node = (k, top) => {
    const kids = byUrgency((by.get(k.address) ?? []).map((c) => node(c, false)));
    const tally = {};
    const add = (s, n = 1) => s && (tally[s] = (tally[s] ?? 0) + n);
    for (const c of kids) {
      add(c.status);
      for (const [s, n] of Object.entries(c.tally)) add(s, n);
    }
    return {
      t: k,
      address: k.address,
      name: k.name || (k.parent ? null : whereOf(k)) || nameOf(k),
      role: label(k, "org.role"),
      profile: label(k, "org.profile"),
      harness: k.report?.app ?? null,
      machine: k.address.includes("/") ? k.address.split("/")[0] : "local",
      status: kidStatus(k, listed),
      kids,
      reports: kids.length,
      tally,
      urgent: Object.keys(tally).reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null),
      leader: kids.length > 0 || (top && isAgent(k)),
    };
  };
  const leadersOnly = (n) => ({ ...n, kids: n.kids.filter((c) => c.leader).map(leadersOnly) });
  const roots = byUrgency(all
    .filter((k) => k.state === "live" && !live.has(parentOf(k)))
    .map((k) => node(k, true))
    .filter((n) => n.leader));
  return scope === "all" ? roots : roots.map(leadersOnly);
}

export function facets(roots) {
  const out = Object.fromEntries(KEYS.map((key) => [key, new Map()]));
  const walk = (n) => {
    for (const key of KEYS) if (n[key] != null) out[key].set(n[key], (out[key].get(n[key]) ?? 0) + 1);
    n.kids.forEach(walk);
  };
  roots.forEach(walk);
  return out;
}

const TOKEN = /(\w+):"([^"]*)"|(\w+):(\S+)|"([^"]*)"|(\S+)/g;

function tokens(text) {
  return [...(text ?? "").matchAll(TOKEN)].map((m) => {
    const key = (m[1] ?? m[3])?.toLowerCase();
    const known = KEYS.includes(key);
    const value = known ? m[2] ?? m[4] : m[5] ?? m[0];
    return { raw: m[0], key: known ? key : null, value: value.toLowerCase() };
  });
}

export function parseQuery(text) {
  const q = Object.fromEntries(KEYS.map((key) => [key, []]));
  q.words = [];
  for (const t of tokens(text)) (t.key ? q[t.key] : q.words).push(t.value);
  return q;
}

export function toggleTerm(text, key, value) {
  const all = tokens(text);
  const rest = all.filter((t) => !(t.key === key && t.value === value.toLowerCase()));
  const term = /\s/.test(value) ? `${key}:"${value}"` : `${key}:${value}`;
  return (rest.length < all.length ? rest.map((t) => t.raw) : [...all.map((t) => t.raw), term]).join(" ");
}

export function filterTree(roots, text) {
  const q = parseQuery(text);
  if (!q.words.length && KEYS.every((key) => !q[key].length)) return roots.map(function mark(n) { return { ...n, match: true, kids: n.kids.map(mark) }; });
  const has = (field, v) => field != null && field.toLowerCase().includes(v);
  const matches = (n) =>
    q.words.every((w) => [n.name, n.address, n.role, n.profile, n.t.cwd].some((f) => has(f, w))) &&
    KEYS.every((key) => !q[key].length || q[key].some((v) => has(n[key], v)));
  const keep = (n) => {
    const kids = n.kids.map(keep).filter(Boolean);
    const match = matches(n);
    return match || kids.length ? { ...n, kids, match } : null;
  };
  return roots.map(keep).filter(Boolean);
}
