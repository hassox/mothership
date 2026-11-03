import { beforeEach, describe, expect, test } from "bun:test";
import { state, cx, texts, findId, click } from "./preload.js";
import { all, lone } from "./fixture.js";
import Agents from "../mods/mothership-agents/main.js";
import Tabs from "../mods/mothership-tabs/main.js";
import Pane from "../mods/mothership-pane/main.js";

const program = { key: "pi", name: "pi", agent: true };
const space = { id: "s1", name: "prime", active: true, tabs: [{ id: "tb1", name: "r-ui", named: true, active: true, status: null }, { id: "tb2", name: "notes", named: true, active: false, status: null }] };

beforeEach(() => {
  Object.assign(state, {
    terminals: all, agents: [], spaces: [space], focused: null, props: {}, ran: [], overlays: [],
    shared: { "agents.sort": "org", "org.scope": "all" },
    panes: [
      { pane: "p1", tab: "tb1", terminal: "t3", title: "r-ui", program, status: "blocked", cwd: "/repo/ui" },
      { pane: "p2", tab: "tb2", terminal: "t5", title: "notes", program, status: "idle", cwd: "/repo/notes" },
    ],
  });
});

function sidebar() {
  const view = new Agents();
  view.init({}, cx());
  return { view, tree: () => view.render(cx()) };
}

const rowIds = (tree) => {
  const ids = [];
  const walk = (n) => {
    if (!n?._kids) return;
    const id = n._props.id?.[0];
    if (typeof id === "string" && /^org-(?!fold|scope|filter|search|team)/.test(id)) ids.push(id.slice(4));
    n._kids.forEach(walk);
  };
  walk(tree);
  return ids;
};

describe("F5 display", () => {
  test("the Org view lists the tree depth first, with tag text on each row", () => {
    const { tree } = sidebar();
    const t = tree();
    expect(rowIds(t)).toEqual(["t1", "t2", "t3", "t4", "t5", "t6", "vps/t2", "vps/t3"]);
    expect(texts(findId(t, "org-t3"))).toContain("worker · poteto");
    expect(texts(findId(t, "org-t4"))).toContain("worker");
    expect(texts(findId(t, "org-t1"))).toContain("lead · poteto");
    expect(texts(findId(t, "org-t5")).some((s) => s.includes("·") || s.includes("untagged"))).toBe(false);
  });

  test("agent.next follows the Org view's rows", () => {
    state.agents = [{ address: "t6", status: "blocked" }, { address: "t3", status: "idle" }];
    const t = sidebar().tree();
    expect(rowIds(t)[0]).toBe("t6");
    expect(state.order).toEqual(rowIds(t));
  });

  test("folding a nested leader hides its children", () => {
    const { tree } = sidebar();
    click(findId(tree(), "org-fold-t2"));
    expect(rowIds(tree())).toEqual(["t1", "t2", "t5", "t6", "vps/t2", "vps/t3"]);
  });

  test("a leader row shows its own status and its team's most urgent status", () => {
    state.agents = [{ address: "t1", status: "done" }];
    state.shared["org.scope"] = "leaders";
    const t = sidebar().tree();
    const row = findId(t, "org-t1");
    const all = (n) => (n?._kids ? [n, ...n._kids.flatMap(all)] : []);
    expect(all(row).some((n) => n._props.bg?.[0] === "#done")).toBe(true);
    const count = findId(t, "org-team-t1");
    expect(texts(count)).toEqual(["2"]);
    expect(count._props.text_color[0]).toBe("#blocked");
    expect(count._props.tooltip[0]).toBe("2 reports · team: 1 needs you, 1 working, 2 idle");
  });

  test("the Leaders scope shows only leaders, with a count of each leader's reports", () => {
    const { tree } = sidebar();
    click(findId(tree(), "org-scope-leaders"));
    expect(state.shared["org.scope"]).toBe("leaders");
    const t = tree();
    expect(rowIds(t)).toEqual(["t1", "t2", lone.address, "vps/t2"]);
    expect(texts(findId(t, "org-t2"))).toContain("2");
    click(findId(t, "org-scope-all"));
    expect(rowIds(tree())).toContain("t3");
  });

  test("typing in the search box filters the tree", () => {
    const { view, tree } = sidebar();
    tree();
    view.search.type("role:worker profile:poteto");
    expect(state.shared["org.filter"]).toBe("role:worker profile:poteto");
    expect(rowIds(tree())).toEqual(["t1", "t2", "t3"]);
  });

  test("ticking a value in the filter popup adds its term, and ticking again removes it", () => {
    state.props = { filterMenu: true };
    const popup = new Agents();
    popup.init(state.props, cx());
    click(findId(popup.render(cx()), "filter-role-worker"));
    expect(state.shared["org.filter"]).toBe("role:worker");
    click(findId(popup.render(cx()), "filter-role-worker"));
    expect(state.shared["org.filter"]).toBe("");
  });

  test("clicking a row with a pane focuses it, and one without a pane peeks it", () => {
    const { tree } = sidebar();
    click(findId(tree(), "org-t3"));
    click(findId(tree(), "org-t4"));
    expect(state.ran).toEqual([["pane.focus", { pane: "p1" }], ["terminal.peek", { terminal: "t4" }]]);
  });

  test("the tab bar shows tag text only for a tagged terminal", () => {
    const t = new Tabs();
    t.init();
    const tree = t.render();
    expect(texts(findId(tree, "tab-tb1"))).toContain(`worker · poteto`);
    expect(texts(findId(tree, "tab-tb2")).some((s) => s.includes("·") || s.includes("untagged"))).toBe(false);
  });

  test("a sub-agent's pane header takes you to its leader", () => {
    state.props = { pane: "p1" };
    const p = new Pane();
    p.init();
    const button = findId(p.render(cx()), "pane-leader-p1");
    expect(texts(button)).toContain("Sub-agent of review");
    expect(button._props.tooltip[0]).toBe("Take me to your leader: review · sub-lead · reviewer");
    click(button);
    expect(state.ran).toEqual([["agent.focus", { terminal: "t2" }]]);
  });

  test("a top-level agent's pane header has no leader button", () => {
    state.panes = [...state.panes, { pane: "p3", tab: "tb1", terminal: "t1", title: "prime", program, status: "working", cwd: "/repo" }];
    state.props = { pane: "p3" };
    const p = new Pane();
    p.init();
    expect(findId(p.render(cx()), "pane-leader-p3")).toBe(null);
  });

  test("the pane header shows tag text only for a tagged terminal", () => {
    for (const [pane, want] of [["p1", true], ["p2", false]]) {
      state.props = { pane };
      const p = new Pane();
      p.init();
      const shown = texts(p.render(cx()));
      expect(shown.includes(`worker · poteto`)).toBe(want);
      expect(shown.some((s) => s.includes("untagged"))).toBe(false);
    }
  });
});

