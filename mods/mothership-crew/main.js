import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { terminals, spaces, panes, focused, props, run, hc, exec, home, theme, settings, window } from "herdr";
import { crews, head, sayOf } from "./subagents.js";

const place = (k) => JSON.stringify([k.address.includes("/") ? k.address.split("/")[0] : null, k.cwd]);
const tilde = (path) => (path.startsWith(home()) ? `~${path.slice(home().length)}` : path);

export default class Crew extends View {
  init(_props, cx) {
    this.tail = {};
    this.branch = {};
    cx.timer.every(5000, (cx) => this.read(cx));
    this.read(cx);
  }

  shown() {
    const tab = focused()?.tab;
    return window()?.active && focused()?.space === props()?.space && panes().some((p) => p.mod === "mothership-crew" && p.tab === tab);
  }

  read(cx) {
    if (this.reading || !this.shown()) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        const subs = crews(terminals())[props().space] ?? [];
        const places = [...new Set(subs.filter(({ t: k }) => k.cwd).map(({ t: k }) => place(k)))];
        const [screens, heads] = await Promise.all([
          Promise.all(subs.map(({ t: k }) => hc(["read", k.address]))),
          Promise.all(places.map((key) => {
            const [on, cwd] = JSON.parse(key);
            return exec("git", ["--no-optional-locks", "branch", "--show-current"], { cwd, on }).then((r) => r.stdout.trim(), () => "");
          })),
        ]);
        const tail = Object.fromEntries(subs.map(({ t: k }, i) => [k.address, screens[i].stdout.split("\n").filter((l) => !/^[─━═\s]*$/.test(l)).slice(-8)]));
        const branch = Object.fromEntries(places.map((key, i) => [key, heads[i]]));
        const seen = JSON.stringify([tail, branch]);
        if (seen === this.seen) return;
        Object.assign(this, { tail, branch, seen });
        cx.notify();
      } finally {
        this.reading = false;
      }
    });
  }

  render() {
    const t = theme();
    const id = props()?.space;
    const subs = crews(terminals())[id] ?? [];
    const mono = settings().font_family;
    return v_flex().size_full().bg(t.background).p(14).gap(10).text_size(13)
      .child(div().font_semibold().child(`${subs.length} sub-agents in ${spaces().find((s) => s.id === id)?.name ?? id}`))
      .when(!subs.length, (el) => el.child(div().text_color(t.dim).child("No sub-agents are running in this space.")))
      .child(v_flex().id("crew").flex_1().min_h(0).gap(10).overflow_y_scrollbar().children(subs.map(({ t: k }) => {
        const say = sayOf(k);
        const branch = k.cwd ? this.branch[place(k)] : "";
        return v_flex()
          .id(`crew-${k.address}`)
          .p(12)
          .gap(6)
          .rounded(8)
          .bg(t.surface)
          .border(1)
          .border_color(t.border)
          .hover((s) => s.border_color(t.input))
          .on_click(() => run("terminal.peek", { terminal: k.address }))
          .child(head(t, k))
          .when(Boolean(k.cwd), (el) => el.child(h_flex().gap(5).items_center().text_size(12).text_color(t.dim)
            .child(div().min_w(0).overflow_hidden().whitespace_nowrap().text_ellipsis_start().child(tilde(k.cwd)))
            .when(Boolean(branch), (el) => el
              .child(svg("mods/workspace-chrome/branch.svg").flex_none().size(12).text_color(t.dim))
              .child(div().flex_none().child(branch)))))
          .when(Boolean(say), (el) => el.child(div().text_size(12).text_color(t.muted).child(say)))
          .child(v_flex().p(8).rounded(6).bg(t.canvas).font_family(mono).text_size(11.5).text_color(t.muted)
            .children((this.tail[k.address] ?? []).map((l) => div().truncate().child(l))));
      })));
  }
}
