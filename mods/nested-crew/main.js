import { View, div } from "gpui-kit";
import { v_flex } from "gpui-base";
import { terminals, spaces, panes, focused, props, run, hc, theme, settings, window } from "herdr";
import { crews, head, sayOf } from "./subagents.js";

export default class Crew extends View {
  init(_props, cx) {
    this.tail = {};
    cx.timer.every(5000, (cx) => this.read(cx));
    this.read(cx);
  }

  shown() {
    const tab = focused()?.tab;
    return window()?.active && focused()?.space === props()?.space && panes().some((p) => p.mod === "nested-crew" && p.tab === tab);
  }

  read(cx) {
    if (this.reading || !this.shown()) return;
    this.reading = true;
    cx.spawn(async (cx) => {
      try {
        const subs = crews(terminals())[props().space] ?? [];
        const screens = await Promise.all(subs.map(({ t: k }) => hc(["read", k.address])));
        let changed = false;
        subs.forEach(({ t: k }, i) => {
          const tail = screens[i].stdout.split("\n").filter((l) => !/^[─━═\s]*$/.test(l)).slice(-8);
          if (tail.join("\n") === (this.tail[k.address] ?? []).join("\n")) return;
          this.tail[k.address] = tail;
          changed = true;
        });
        if (changed) cx.notify();
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
          .when(Boolean(say), (el) => el.child(div().text_size(12).text_color(t.muted).child(say)))
          .child(v_flex().p(8).rounded(6).bg(t.canvas).font_family(mono).text_size(11.5).text_color(t.muted)
            .children((this.tail[k.address] ?? []).map((l) => div().truncate().child(l))));
      })));
  }
}
