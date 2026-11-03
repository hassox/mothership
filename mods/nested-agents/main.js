// Agents in grouped or priority views; parents take their most urgent sub-agent's place.
// A viewed done agent stays in Done until left.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, InputState, Input } from "gpui-base";
import { agents, terminals, panes, focused, spaces, run, theme, shared, setShared, setAgentOrder, openOverlay, closeOverlay, props, window, layout, nextCommand, notify } from "herdr";
import { MODES, modeOf, RANK, kidStatus, kidsByParent, subTree } from "./subagents.js";
import { KEYS, SCOPES, orgTree, filterTree, facets, parseQuery, toggleTerm, tagText } from "./org.js";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}]+/u, "").trim();

function lead(tab, all = panes()) {
  const mine = all.filter(p => p.tab === tab.id && p.terminal);
  return mine.find(p => p.program?.agent) ?? mine.find(p => p.focused) ?? mine[0];
}

function title(tab, l) {
  const prog = l?.program?.name;
  const live = clean(l?.title);
  const telling = live && live !== prog && !/^[~/]|^[A-Za-z]:\\/.test(live) && !live.includes("@") && live.toLowerCase() !== l?.program?.key;
  return (tab.name === prog || !tab.named) && telling ? live : tab.name;
}
const SORTS = [
  { id: "priority", label: "Priority", icon: "clock" },
  { id: "grouped", label: "Grouped by space", icon: "layers" },
  { id: "org", label: "Org", icon: "git-branch" },
];
const sortOf = () => SORTS.find((s) => s.id === shared("agents.sort")) ?? SORTS[0];
const scopeOf = () => SCOPES.find((s) => s.id === shared("org.scope")) ?? SCOPES[0];
const FACET = { role: "Role", profile: "Profile", harness: "Harness", machine: "Machine", status: "Status" };
const SECTION = { 4: "Needs you", 3: "Done", 2: "Working", 1: "Idle" };
const SECTION_STATUS = { 4: "blocked", 3: "done", 2: "working" };

function duration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return "<1m";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`;
}

// The agent's icon from the app's program table: a one-color glyph or a picture.
function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Agents extends View {
  init(_props, cx) {
    if (props()?.sortMenu || props()?.filterMenu) return;
    this.search = InputState.new({ placeholder: "Search, or role:  profile:", value: shared("org.filter") ?? "" });
    this.search.on("change", () => setShared("org.filter", this.search.value()));
    this.folded = new Set();
    // Each agent's last state and when it changed (ms), kept across restarts.
    this.changed = JSON.parse(localStorage.getItem("changed") ?? "{}");
    this.pendingPins = JSON.parse(localStorage.getItem("pins") ?? "[]");
    if (!this.pendingPins.length) localStorage.removeItem("pins");
    this.migratingPins = new Set();
    cx.timer.every(30000, (cx) => cx.notify());
    cx.spawn(async () => {
      for (;;) {
        const command = await nextCommand();
        if (command === "org") { setShared("agents.sort", "org"); continue; }
        if (command === "org-scope") { setShared("org.scope", scopeOf().id === "all" ? "leaders" : "all"); continue; }
        const next = command === "next" ? MODES[(MODES.indexOf(modeOf()) + 1) % MODES.length] : MODES.find((m) => m.id === command);
        if (!next) continue;
        setShared("nested.mode", next.id);
        notify({ title: `Sub-agents: ${next.label}`, timeout: 2000 });
      }
    });
  }

  // Stamps agents whose state changed. Done and idle count as one: looking at a
  // finished agent turns done into idle, and looking isn't the agent doing anything.
  track(list, now) {
    let dirty = false;
    for (const a of list) {
      const s = a.status === "done" ? "idle" : a.status;
      if (this.changed[a.address]?.s === s) continue;
      this.changed[a.address] = { s, at: now };
      dirty = true;
    }
    if (!dirty) return;
    // Gone and old: the list alone is empty right after a start.
    const listed = new Set(list.map((a) => a.address));
    for (const [k, c] of Object.entries(this.changed)) if (!listed.has(k) && now - c.at > 30 * 86400000) delete this.changed[k];
    localStorage.setItem("changed", JSON.stringify(this.changed));
  }

  // Keep offline pins until their terminal returns, and keep each pending until
  // core echoes the label so a failed write doesn't erase the old pin.
  migratePins(all) {
    const listed = new Map(all.filter((t) => t.state === "live").map((t) => [t.address, t]));
    const pending = this.pendingPins.filter((address) => {
      const terminal = listed.get(address);
      if (!terminal) return true;
      if (terminal.labels?.["herdr.pinned"]) return false;
      if (!this.migratingPins.has(address)) {
        this.migratingPins.add(address);
        run("terminal.pin", { terminal: address, pinned: true });
      }
      return true;
    });
    if (pending.length === this.pendingPins.length) return;
    this.pendingPins = pending;
    if (pending.length) localStorage.setItem("pins", JSON.stringify(pending));
    else localStorage.removeItem("pins");
  }

  since(a) {
    return this.changed[a.address]?.at ?? 0;
  }

  // Looking at a done agent makes it idle; it stays with Done until you leave
  // it rather than drop away under you. Any other change moves it at once.
  hold(list) {
    const cur = list.find((a) => a.focused);
    const same = cur && cur.address === this.held?.address;
    // Arriving, or any change but done turning idle, sets what it was.
    if (!same || cur.status !== "idle") this.held = cur ? { address: cur.address, rank: RANK[cur.status] ?? 0 } : null;
  }

  rank(a) {
    const sawDone = a.address === this.held?.address && this.held.rank === RANK.done && a.status === "idle";
    return sawDone ? RANK.done : RANK[a.status] ?? 0;
  }

  sortMenu(t) {
    const section = (title, key, options, on) => [
      div().px(8).pt(4).pb(6).text_size(11).text_color(t.dim).child(title),
      ...options.map((o) => h_flex()
        .id(`${key}-${o.id}`)
        .h(31)
        .px(8)
        .gap(9)
        .rounded(7)
        .items_center()
        .text_color(t.foreground)
        .hover((el) => el.bg(t.hover))
        .on_click(() => {
          setShared(key, o.id);
          closeOverlay(props().overlay);
        })
        .child(svg(`mods/workspace-chrome/${o.icon}.svg`).size(14).flex_none().text_color(t.muted))
        .child(div().flex_1().child(o.label))
        .when(o.id === on, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(14).flex_none().text_color(t.foreground)))),
    ];
    return v_flex()
      .w_full()
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .children(section("Sort agents", "agents.sort", SORTS, sortOf().id))
      .children(section("Sub-agents", "nested.mode", MODES, modeOf().id));
  }

  peek(addr) {
    run("terminal.peek", { terminal: addr });
  }

  filterMenu(t) {
    const q = shared("org.filter") ?? "";
    const on = parseQuery(q);
    const f = facets(orgTree(terminals(), scopeOf().id));
    const shown = KEYS.filter((key) => f[key].size);
    return v_flex()
      .id("filter-menu")
      .size_full()
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .overflow_y_scrollbar()
      .when(!shown.length, (el) => el.child(div().p(8).text_color(t.dim).child("Nothing to filter yet.")))
      .children(shown.flatMap((key) => [
        div().px(8).pt(6).pb(4).text_size(11).text_color(t.dim).child(FACET[key]),
        ...[...f[key]].map(([value, count]) => {
          const ticked = on[key].includes(value.toLowerCase());
          return h_flex()
            .id(`filter-${key}-${value}`)
            .h(28)
            .px(8)
            .gap(9)
            .rounded(7)
            .items_center()
            .text_color(t.foreground)
            .hover((el) => el.bg(t.hover))
            .on_click(() => setShared("org.filter", toggleTerm(shared("org.filter") ?? "", key, value)))
            .child(div().size(14).flex_none().rounded(4).border(1.5).border_color(ticked ? t.foreground : t.input).flex().items_center().justify_center()
              .when(ticked, (el) => el.child(svg("mods/workspace-chrome/check.svg").size(11).text_color(t.foreground))))
            .child(div().flex_1().min_w(0).truncate().child(value))
            .child(div().flex_none().text_size(11).text_color(t.dim).child(String(count)));
        }),
      ]))
      .when(Boolean(q.trim()), (el) => el.child(div().id("filter-clear").mt(4).px(8).h(28).flex().items_center().justify_end().rounded(7).text_size(12).text_color(t.muted)
        .hover((el) => el.bg(t.hover).text_color(t.foreground)).on_click(() => setShared("org.filter", "")).child("Clear all")));
  }

  treeLines(t, lines) {
    return lines.map((l) => div().self_start().mt(-4).w(9).h(17).mr(4).flex_none()
      .when(Boolean(l), (el) => el.border_l(1.5).border_color(t.input))
      .when(l === "└" || l === "├", (el) => el.border_b(1.5).rounded_bl(6)));
  }

  orgRows(t, roots, shown) {
    const rows = [];
    const walk = (nodes, lead) => nodes.forEach((n, i) => {
      const last = i === nodes.length - 1;
      rows.push(this.orgRow(t, n, lead ? [...lead, last ? "└" : "├"] : [], shown));
      if (n.kids.length && !this.folded.has(`org:${n.address}`)) walk(n.kids, lead ? [...lead, last ? "" : "│"] : []);
    });
    walk(roots, null);
    return rows;
  }

  orgRow(t, n, lines, shown) {
    const k = n.t;
    const pic = icon(k.program, 14, t.foreground);
    const on = n.address === shown;
    const open = !this.folded.has(`org:${n.address}`);
    const tag = tagText(k);
    const pane = panes().find((p) => p.terminal === n.address);
    return h_flex()
      .id(`org-${n.address}`)
      .px(8)
      .h(26)
      .flex_none()
      .gap(0)
      .rounded(8)
      .items_center()
      .text_size(12.5)
      .cursor_pointer()
      .when(on, (el) => el.bg(t.selected))
      .hover((el) => el.bg(t.hover))
      .on_click(() => (pane ? run("pane.focus", { pane: pane.pane }) : this.peek(n.address)))
      .children(this.treeLines(t, lines))
      .child(div().id(`org-fold-${n.address}`).w(15).h(18).mr(3).flex_none().flex().items_center().justify_center().rounded(4)
        .when(n.kids.length > 0, (el) => el.text_color(t.dim).hover((el) => el.bg(t.hover).text_color(t.foreground))
          .on_click((_e, cx) => {
            cx.stop_propagation();
            open ? this.folded.add(`org:${n.address}`) : this.folded.delete(`org:${n.address}`);
            cx.notify();
          })
          .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11))))
      .when(Boolean(pic), (el) => el.child(div().mr(7).child(pic)))
      .child(div().flex_1().min_w(0).truncate().text_color(n.match === false ? t.dim : on || n.kids.length ? t.foreground : t.muted).child(n.name))
      .when(Boolean(tag), (el) => el.child(div().flex_none().max_w(130).ml(6).truncate().text_size(11).text_color(t.dim).child(tag)))
      .when((n.kids.length > 0 && !open) || n.reports > n.kids.length, (el) => el.child(div().flex_none().ml(6).text_size(11).text_color(t[n.urgent] ?? t.dim).tooltip(`${n.reports} reporting`).child(String(n.reports))))
      .child(div().ml(6).child(this.status(t, { status: kidStatus(k, this.listed) }, true)));
  }

  orgHeader(t) {
    const scope = scopeOf().id;
    const seg = (s) => div()
      .id(`org-scope-${s.id}`)
      .px(7)
      .h(20)
      .flex()
      .items_center()
      .rounded(5)
      .text_size(11)
      .when(s.id === scope, (el) => el.bg(t.selected).text_color(t.foreground))
      .when(s.id !== scope, (el) => el.text_color(t.dim).hover((el) => el.text_color(t.foreground)))
      .on_click(() => setShared("org.scope", s.id))
      .child(s.label);
    return h_flex().gap(6).items_center()
      .child(h_flex().p(1).gap(1).rounded(6).border(1).border_color(t.border).children(SCOPES.map(seg)))
      .child(div()
        .id("org-filter")
        .text_color(parseQuery(shared("org.filter") ?? "").words.length || KEYS.some((key) => parseQuery(shared("org.filter") ?? "")[key].length) ? t.accent : t.dim)
        .hover((el) => el.text_color(t.foreground))
        .tooltip("Filter")
        .on_click(() => openOverlay({ mod: "nested-agents", kind: "popup", width: 240, height: 420, props: { filterMenu: true } }))
        .child(svg("mods/nested-agents/filter.svg").size(14)));
  }

  orgSearch(t) {
    const q = shared("org.filter") ?? "";
    if (this.search.value() !== q) this.search.set_value(q);
    return h_flex()
      .id("org-search")
      .mx(8)
      .mb(6)
      .h(28)
      .px(8)
      .gap(6)
      .flex_none()
      .items_center()
      .rounded(7)
      .border(1)
      .border_color(t.border)
      .bg(t.background)
      .cursor_text()
      .on_click(() => this.search.focus())
      .child(svg("mods/workspace-chrome/search.svg").size(13).flex_none().text_color(t.dim))
      .child(div().flex_1().min_w(0).child(Input.new(this.search).h_full().text_size(12).text_color(t.foreground)))
      .when(Boolean(q), (el) => el.child(div().id("org-search-clear").text_color(t.dim).hover((el) => el.text_color(t.foreground))
        .on_click((_e, cx) => { cx.stop_propagation(); setShared("org.filter", ""); })
        .child(svg("mods/workspace-chrome/x.svg").size(12))));
  }

  subRow(t, s, shown, compact) {
    const k = s.t;
    const st = kidStatus(k, this.listed);
    const pic = icon(k.program, 14, t.foreground);
    const on = k.address === shown;
    return h_flex()
      .id(`sub-${k.address}`)
      .pl(39)
      .pr(8)
      .rounded(8)
      .h(26)
      .flex_none()
      .gap(0)
      .items_center()
      .text_size(12.5)
      .when(on, (el) => el.bg(t.selected))
      .hover((s) => s.bg(t.hover))
      .on_click(() => this.peek(k.address))
      .children(s.lines.map(l => div().self_start().mt(-4).w(9).h(17).mr(4).flex_none()
        .when(Boolean(l), el => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", el => el.border_b(1.5).rounded_bl(6))))
      .when(Boolean(pic), el => el.child(div().mr(8).child(pic)))
      .child(div().flex_1().truncate().text_color(on ? t.foreground : t.muted).child(k.name || k.template || k.program?.name || k.address))
      .child(this.status(t, { status: st }, compact));
  }

  // compact: a ! for blocked where a header already says "Needs you".
  status(t, a, compact = false) {
    const color = t[a.status] ?? t.dim;
    if (a.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
    if (a.status === "blocked" && compact) return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (a.status === "blocked") return div().flex_none().px(6).h(18).rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).flex().items_center().child("Needs you");
    // Idle: a ring; done: a dot.
    if (a.status === "idle") return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
    return div().size(7).mx(3).flex_none().rounded(4).bg(a.status === "done" ? color : t.dim + "00");
  }

  render(cx) {
    const t = theme();
    if (props()?.sortMenu) return this.sortMenu(t);
    if (props()?.filterMenu) return this.filterMenu(t);
    const collapsed = narrow();
    const sort = sortOf();
    let list = agents();
    this.listed = new Map(list.map((a) => [a.address, a.status]));
    const all = terminals();
    this.migratePins(all);
    const shown = focused()?.agent ?? focused()?.terminal;
    const now = Date.now();
    this.track(list, now);
    this.hold(list);
    const mode = modeOf().id;
    const kids = kidsByParent(all, mode !== "off");
    const here = mode === "follow" ? spaces().find((s) => s.active) : null;
    if (here) list = list.filter((a) => a.space === here.id);
    const byPriority = sort.id === "priority";
    const urgency = new Map(list.map((a) => [a.address, Math.max(this.rank(a), ...subTree(kids, a.address).map((s) => RANK[kidStatus(s.t, this.listed)] ?? 0))]));
    const rankOf = (a) => urgency.get(a.address);
    if (byPriority) list = [...list].sort((x, y) => rankOf(y) - rankOf(x) || this.since(y) - this.since(x) || y.seq - x.seq);
    const pinned = list.filter((a) => a.pinned);
    const rest = list.filter((a) => !a.pinned);
    list = [...pinned, ...rest];
    setAgentOrder(list.map((a) => a.address));

    const withKids = (a, i) => {
      const subs = collapsed ? [] : subTree(kids, a.address);
      const r = row(a, i, subs);
      if (this.folded.has(a.address)) return [r];
      return [r, ...subs.map((s) => this.subRow(t, s, shown, byPriority))];
    };

    // The fold chevron; folded, the count too, colored by the most urgent one.
    const fold = (a, subs) => {
      const sts = subs.map((s) => kidStatus(s.t, this.listed));
      const top = sts.reduce((m, s) => ((RANK[s] ?? 0) > (RANK[m] ?? 0) ? s : m), null);
      const open = !this.folded.has(a.address);
      return div()
        .id(`fold-${a.address}`)
        .h(18)
        .px(3)
        .gap(3)
        .flex()
        .items_center()
        .rounded(4)
        .text_size(11)
        .text_color(open ? t.dim : (t[top] ?? t.dim))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          open ? this.folded.add(a.address) : this.folded.delete(a.address);
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/chevron-${open ? "down" : "right"}.svg`).size(11).flex_none())
        .when(!open, (el) => el.child(String(subs.length)));
    };

    // A row reads "space \u00b7 detail": the detail is a tab someone named or the
    // agent's own title, never an automatic tab number unless two rows would
    // otherwise read the same.
    const tabs = spaces().flatMap(s => s.tabs);
    const label = (a) => {
      const tab = tabs.find(tab => tab.id === a.tab);
      return tab ? title(tab, lead(tab)) : a.title || a.program?.name || "";
    };
    const detail = new Map(list.map(a => [a.address, /^\d+$/.test(label(a)) ? null : label(a)]));
    const seen = {};
    for (const a of list) { const k = `${a.space_name}\u0000${detail.get(a.address) ?? ""}`; seen[k] = (seen[k] ?? 0) + 1; }
    for (const a of list) {
      if (detail.get(a.address) == null && seen[`${a.space_name}\u0000`] > 1) detail.set(a.address, label(a));
    }

    const row = (a, i, subs = []) => {
      const pic = icon(a.program, 16, t.foreground);
      const more = detail.get(a.address);
      // An agent on another machine (`vps/t7`) says which.
      const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
      if (collapsed) {
        return h_flex()
          .id(`ag-${a.address}`)
          .h(26)
          .px(8)
          .flex_none()
          .items_center()
          .gap(4)
          .hover((s) => s.bg(t.hover))
          .on_click(() => run("pane.focus", { pane: a.pane }))
          .child(div().flex_1().min_w(0).whitespace_nowrap().text_right().text_color(t.muted).child(String(i + 1)))
          .child(h_flex().w(14).flex_none().items_center().justify_center().child(this.status(t, a, true)));
      }
      const when = this.since(a);
      const idle = a.status === "idle" && !a.focused;
      const isPinned = a.pinned;
      const pin = div()
        .id(`pin-${a.address}`)
        .flex_none()
        .p(2)
        .rounded(4)
        .text_color(t.dim)
        .cursor_pointer()
        .hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(isPinned ? "Unpin" : "Pin to the top")
        .on_click((_e, cx) => {
          cx.stop_propagation();
          run("terminal.pin", { terminal: a.address, pinned: !isPinned });
          // The row moves away from under the pointer, and no hover-out comes.
          this.hovered = null;
          cx.notify();
        })
        .child(svg(`mods/workspace-chrome/${isPinned ? "pin-off" : "pin"}.svg`).size(13));
      // Under a space header the space goes without saying; an automatic tab number says nothing.
      // Without a space header above (priority, pinned) the row names its space.
      const full = (byPriority && !here) || isPinned;
      const name = full ? a.space_name || label(a) : more ?? (/^\d+$/.test(label(a)) ? a.program?.name || label(a) : label(a));
      return h_flex()
        .id(`ag-${a.address}`)
        .px(8)
        .h(30)
        .flex_none()
        .rounded(8)
        .items_center()
        .gap(9)
        .when(a.focused, (el) => el.bg(t.selected))
        .when(!a.focused && subs.some((s) => s.t.address === shown), (el) => el.bg(t.raised))
        .cursor_pointer()
        .hover((s) => s.bg(t.hover))
        .on_hover((on, cx) => {
          if (on) this.hovered = a.address;
          else if (this.hovered === a.address) this.hovered = null;
          cx.notify();
        })
        .on_click(() => run("pane.focus", { pane: a.pane }))
        .when(Boolean(pic), el => el.child(div().id(`agent-fold-${a.address}`)
          .when(subs.length > 0, el => el.on_click((_e, cx) => {
            cx.stop_propagation();
            this.folded.has(a.address) ? this.folded.delete(a.address) : this.folded.add(a.address);
            cx.notify();
          })).child(pic)))
        .child(h_flex().flex_1().min_w(0).gap(5).items_center()
          .child(div().min_w(0).max_w(full && more ? 120 : 200).truncate().text_color(idle ? t.muted : t.foreground).child(name))
          .when(full && Boolean(more), el => el.child(div().flex_1().min_w(0).truncate().text_color(t.dim).child(`\u00b7 ${more}`))))
        .when(Boolean(machine), el => el.child(div().text_size(10).text_color(t.dim).child(machine)))
        .when(subs.length > 0, el => el.child(fold(a, subs)))
        .when(this.hovered === a.address, el => el.child(pin))
        .when(this.hovered !== a.address && Boolean(when), el => el.child(div().flex_none().text_size(11).text_color(t.dim).child(duration(now - when))))
        .child(this.status(t, a, byPriority && !isPinned));
    };

    // Groups in list order: spaces (grouped) or priority sections. Agents of a
    // space are next to each other in agents(), so neighbours make a group.
    const groups = pinned.length ? [{ id: "pinned", label: "Pinned", status: null, members: pinned }] : [];
    for (const a of rest) {
      const r = rankOf(a) || RANK.idle;
      const id = byPriority ? `sec-${r}` : `sp-${a.space}`;
      if (groups.at(-1)?.id === id) groups.at(-1).members.push(a);
      else groups.push({ id, label: byPriority ? SECTION[r] : a.space_name || "", status: byPriority ? SECTION_STATUS[r] : null, members: [a] });
    }

    // A group's header; it folds the group. Folded, it says how many and the most urgent state.
    const header = (g) => {
      const open = !this.folded.has(g.id);
      const top = g.members.reduce((m, a) => ((RANK[a.status] ?? 0) > (RANK[m] ?? 0) ? a.status : m), null);
      return h_flex()
        .id(g.id)
        .px(8)
        .pt(8)
        .h(30)
        .flex_none()
        .gap(6)
        .items_center()
        .text_size(11)
        .font_medium()
        .cursor_pointer()
        .hover((s) => s.text_color(t.foreground))
        .on_click((_e, cx) => {
          open ? this.folded.add(g.id) : this.folded.delete(g.id);
          cx.notify();
        })
        .child(div().truncate().text_color(t[g.status] ?? t.dim).child(g.label))
        .when(byPriority || !open, (el) => el.child(div().text_color(t.dim).child(String(g.members.length))))
        .child(div().flex_1())
        .when(!open, (el) => el
          .when(!byPriority && top && top !== "idle", (el) => el.child(this.status(t, { status: top }, true)))
          .child(svg("mods/workspace-chrome/chevron-right.svg").size(11).flex_none().text_color(t.dim)));
    };
    const isOrg = sort.id === "org" && !collapsed;
    const org = isOrg ? filterTree(orgTree(all, scopeOf().id), shared("org.filter") ?? "") : [];
    const rows = isOrg
      ? this.orgRows(t, org, shown)
      : collapsed
        ? list.flatMap(withKids)
        : groups.flatMap((g) => [header(g), ...(this.folded.has(g.id) ? [] : g.members.flatMap(withKids))]);
    const count = (nodes) => nodes.reduce((n, x) => [n[0] + (x.leader ? 1 : 0), n[1] + 1].map((v, i) => v + count(x.kids)[i]), [0, 0]);
    const [leads, members] = count(org);
    const shownAs = scopeOf().id === "leaders" ? `${leads} leaders` : `${leads} leaders · ${members} agents`;
    const orgEmpty = (shared("org.filter") ?? "").trim() ? "Nothing matches." : "No agents.";

    return v_flex()
      .size_full()
      .min_h(0)
      .bg(t.chrome)
      .border_t(1)
      .border_color(t.border)
      .text_size(13)
      .when(!collapsed, (el) =>
        el.child(
          h_flex()
            .px(16)
            .h(41)
            .pt(14)
            .pb(5)
            .flex_none()
            .items_center()
            .justify_between()
            .child(div().min_w(0).truncate().text_size(11.5).font_medium().text_color(t.dim).child(here && !isOrg ? `Agents in ${here.name}` : "Agents"))
            .child(h_flex().gap(8).items_center().when(isOrg, (el) => el.child(this.orgHeader(t))).child(
              div()
                .id("ag-sort")
                .text_size(11)
                .text_color(t.dim)
                .hover((s) => s.text_color(t.foreground))
                .on_click(() => openOverlay({ mod: "nested-agents", kind: "popup", width: 224, height: 320, props: { sortMenu: true } }))
                .tooltip(`Sort agents: ${sort.label}`)
                .child(svg(`mods/workspace-chrome/${sort.icon}.svg`).size(14)),
            )),
        ),
      )
      .when(isOrg, (el) => el.child(this.orgSearch(t)))
      .when(isOrg && org.length === 0, (el) => el.child(div().px(12).text_size(12).text_color(t.dim).child(orgEmpty)))
      .when(!isOrg && list.length === 0 && !collapsed, (el) =>
        el.child(div().px(12).text_size(12).text_color(t.dim).child(here ? `No agents in ${here.name}.` : "No agent status yet. Agents show up here when they report their status. Older versions and agents inside tmux may not.")),
      )
      .child(v_flex().id("ag-list").flex_1().min_h(0).px(collapsed ? 0 : 8).overflow_y_scrollbar().mode("always").children(rows))
      .when(isOrg && org.length > 0, (el) => el.child(div().px(16).h(26).flex_none().flex().items_center().text_size(11).text_color(t.dim).child(shownAs)))
      .when(collapsed, (el) =>
        el.child(
          h_flex()
            .h(28)
            .items_center()
            .justify_center()
            .child(
              div()
                .id("collapse")
                .text_size(13)
                .text_color(t.dim)
                .hover((s) => s.text_color(t.foreground))
                .on_click(toggleSidebar)
                .child("»"),
            ),
        ),
      );
  }
}
