# Herdr Org: design

Status: for review. Nothing here is built yet.
Facts cited as §N come from [discovery.md](discovery.md).

## Goal

With many agents running, you cannot see who leads whom or what each one is
for. Herdr Org adds two tags and one view:

- Each agent tags its own **profile** when it starts.
- Each parent tags its child's **role** when it starts the child.
- The Agents sidebar gets a **Leaders** view: a tree of leaders and their
  children, with role and profile on each row and a filter panel.

The view extends the `nested-agents` mod and `shared/subagents.js`. It does
not fork them.

## 1. Data model

### Source of truth

Everything comes from the core's terminal records, which the app gives to
mods as `terminals()`. The design adds no store, no sidecar file and no
cache. Labels are a persisted `string → string` map (§1, §4, §6), so a
sidecar would only duplicate them.

| Field | Source | Set by | Missing |
|---|---|---|---|
| `profile` | label `org.profile` | the agent itself at start | `untagged` |
| `role` | label `org.role` | the parent at spawn (`hc run --label`), editable later with `hc label` | `untagged` |
| `harness` | OSC 7501 `app` (`report.app`): `claude-code`, `codex`, `pi` | the program | `none` |
| `machine` | address prefix (`vps/t7` → `vps`) | the core | `local` |
| `status` | `status` word (`working`, `blocked`, `done`, `idle`) | the program | `none` |
| `parent` | `parent`, with the machine prefix added (existing `kidsByParent`) | the core, once at start | no parent |

The mod never infers a role or a profile from a name, a template or argv.
A missing label shows as `untagged`.

### Leader rule

**A leader is a live terminal with at least one live child.**

I rejected the other two rules:

- "No parent". Every shell and every lone agent the person opens would be
  a leader. The view would be the whole terminal list again.
- "`role=lead`". An untagged parent would drop out of the view, and its
  children would lose their place. That is guessing by omission. It also
  makes a structural fact depend on a tag that someone must remember to
  write.

"Has children" uses only `parent`, which the core sets and nobody can
edit (§3). It is the same rule as the existing *Lead of N* chip
(`roles()` in `shared/subagents.js`), so the tab bar, the pane header and
the Leaders view agree. Nesting works at any depth: a sub-agent with
children is a leader under its own leader. `org.role=lead` is display
data. It does not make a terminal a leader.

When a leader's last child ends, it leaves the Leaders view. It stays in
the normal Agents list.

### Shape

One pure module, `shared/org.js`. `install.sh` already copies `shared/*.js`
into each mod.

```js
// OrgNode
{
  t,                 // the terminals() record
  address,           // "t7" or "vps/t7"
  role, profile,     // label value or "untagged"
  harness,           // report.app or "none"
  machine,           // prefix or "local"
  status,            // status word or "none"
  kids: OrgNode[],   // live children, in terminals() order
  leader: boolean,   // kids.length > 0
}

orgTree(terminals)   // → OrgNode[]: leaders with no live leader above them, each with its full subtree
facets(roots)        // → { role, profile, harness, machine, status }: Map<value, count> each
filterTree(roots, f) // → OrgNode[]: matches and their ancestors, with node.match = false on ancestors kept only for context
tagText(t)           // → "worker · poteto", or null for a plain shell outside any tree
```

`orgTree` reuses `kidsByParent(all, false)`, so remote parents resolve the
same way they do today.

### Migration

Existing terminals have no `org.*` labels. They show as `untagged`, still
in the right place in the tree, because the tree comes from `parent`. The
design does no backfill. To tag one by hand:

```sh
hc label t7 org.role=reviewer org.profile=poteto
```

## 2. Tag format

- Keys: `org.role` and `org.profile`. The `org.` prefix follows Herdr's own
  `herdr.space` and `herdr.pinned` labels, and it keeps these keys apart
  from any other tool's `role`.
- Values: free text, as written. The view trims them and shows them as
  they are. Names should be short, lowercase words (`worker`, `sub-lead`,
  `reviewer`), but the mod enforces nothing.
- Remove: `hc label <t> org.role=`.

## 3. Skill and hook changes

### Move

`plugins/hc-context/` moves from agent-files into this repo, with
agent-files commit `45c89c3` named in the commit message. That plugin is
agent-files' only herdr item (discovery "Existing code"). The plugin
install steps move from agent-files' `install.sh` into this repo's
`install.sh`. Herdr Org adds no new SKILL.md. The plugin's one-line
context message is how agents learn the steps, as it is today.

### Launch step: self-tag profile

The agent reads its profile from `HC_PROFILE` in its own environment. If
`HC_PROFILE` is unset, it writes no profile label, and the view shows
`untagged`.

| Harness | Where | Change |
|---|---|---|
| Claude Code, Grok Build | `hooks/hooks.json` → `hc-context.sh` | `hc-context.sh` runs `hc label "$HC_TERMINAL_ID" org.profile="$HC_PROFILE"` when both are set, then prints the hook JSON as today. |
| Codex | `hooks/codex.json` → `hc-context.sh` | Same script. |
| agy | `hooks.json` → `hc-context.sh` | Same script. |
| pi | `pi.ts` | On `session_start`, the same `hc label` through `execFile`. The context message stays on `before_agent_start`. |

`HC_PROFILE` gets into the agent's environment in one of these ways:

- the person's shell, for an agent they start themselves
  (`alias poteto='HC_PROFILE=poteto claude'`);
- a template's `command` (`command: herdr-org-launch reviewer claude …`);
- a parent's spawn line, through the launcher below. `hc run` does not
  pass the caller's environment (§8), so a plain `HC_PROFILE=x hc run …`
  does not work.

### Fallback launcher: `bin/herdr-org-launch`

This is for any harness whose hook cannot run (an untrusted Codex hook, a
sandbox that blocks the socket, a harness with no hooks). It also sets
the profile for a child.

```sh
#!/bin/sh
set -eu
profile=$1; shift
export HC_PROFILE="$profile"
[ -z "${HC_TERMINAL_ID:-}" ] || hc label "$HC_TERMINAL_ID" "org.profile=$profile" >/dev/null
exec "$@"
```

The program replaces the launcher through `exec`, so Herdr sees `claude`
(or `codex`, `pi`) as the foreground program. The hook may then write the
same label again, which does no harm.

### Spawn step: tag the child's role

One sentence goes into `hc-context.txt`, which every harness gets at start:

> When you start a sub-agent with `hc run`, add `--label org.role=<role>`,
> and put `herdr-org-launch <profile>` before its command when it should
> have a profile.

```sh
hc run --bg --name fix --label org.role=worker --cwd /repo -- \
  herdr-org-launch poteto claude "Fix x.rs. Report with hc send $HC_TERMINAL_ID."
```

The label is set when the terminal is made, so no client ever sees the
child without a role. The core sets `parent` from the caller (§3).

To change a role later:

```sh
hc label fix org.role=reviewer
```

## 4. Views

### 4.1 Leaders view, in the Agents sidebar

A third entry joins the existing **Sort agents** menu: *Priority*,
*Grouped by space*, **Leaders**. A command, `nested-agents.leaders`, also
selects it. The choice is stored in `shared("agents.sort")`, as today. The
sub-agent modes (`MODES`) do not change. A Leaders entry there would also
change the Spaces and Tabs mods, and Leaders is a different list, not a
different way to show sub-agents.

```
┌ Agents ─────────────────────── ⚲ ⊟ ┐   ⚲ filter popup   ⊟ sort menu
│ ┌──────────────────────────────┐   │
│ │ ⌕ search                     │   │   text search
│ └──────────────────────────────┘   │
│  role: worker ×   machine: vps ×   │   active filters; × removes one
│                                    │
│ ▾ ◆ prime / 1        lead · poteto ◌│   leader (no live leader above)
│   ├ ✳ fix            worker · poteto ⟳│
│   ├ ▾ ◆ review   sub-lead · reviewer ●│   nested leader, foldable
│   │   ├ ✳ r-ui     worker · untagged ⟳│
│   │   └ ✳ r-api    worker · untagged !│
│   └ ✳ notes        untagged · untagged│
│ ▸ ◆ vps/t3    untagged · untagged  2 │   folded leader: count of children
│                                    │
│ 2 leaders · 7 agents               │
└────────────────────────────────────┘
```

- Rows use the existing `subRow` look: tree lines, program icon, name,
  then `role · profile` in dim text, then the status badge.
- A leader row folds with the chevron. A folded leader shows its child
  count, colored by its most urgent child, like today's `fold`.
- Click a row: `pane.focus` for a terminal with a pane, `terminal.peek`
  for one without, as today.
- With a filter on, rows that are kept only to show where a match sits
  (its ancestors) are dimmed.
- Empty: "No leaders. A leader is an agent that started another with
  `hc run`."

### 4.2 Filter panel

The ⚲ button opens a popup, the same way the sort menu opens
(`openOverlay({mod: "nested-agents", kind: "popup", props: {filterMenu: true}})`).

```
┌ Filter ─────────────────────┐
│ Role                        │
│  ☑ worker            4      │
│  ☐ sub-lead          1      │
│  ☐ lead              1      │
│  ☐ untagged          3      │
│ Profile                     │
│  ☐ poteto            3      │
│  ☐ reviewer          1      │
│  ☐ untagged          5      │
│ Harness                     │
│  ☐ claude-code       6  …   │
│ Machine                     │
│  ☐ local  ☐ vps             │
│ Status                      │
│  ☐ working ☐ blocked ☐ idle │
│                 Clear all   │
└─────────────────────────────┘
```

- The values and counts come from the current tree (`facets`). A value
  shows only when some node has it.
- Inside one facet the values are OR. Across facets they are AND. The text
  search is AND with the rest. It matches name, address, role, profile
  and folder, ignoring case.
- A node stays if it matches, or if any node below it matches. That is how
  the VS Code and GitHub file trees filter.
- State lives in `shared("org.filter")`:
  `{ q, role: [], profile: [], harness: [], machine: [], status: [] }`.
  The popup and the list both read it, and setting it re-renders both.

### 4.3 Tab bar and pane header

`tagText(t)` appears in dim text after the name:

```
Tab bar:   [ ◆ prime  lead · poteto  Lead of 3 ⟳ ]  [ ↳ ✳ fix  worker · poteto ⟳ ]
Pane head: Sub-agent of prime  ✳ fix  worker · poteto   ~/repo        ⟳  ⊞ ⊟ ⤢ ×
```

`tagText` returns text for a terminal that reports agent status or is part
of a tree (it has a parent or children). An untagged one reads
`untagged · untagged`. A plain shell outside any tree shows nothing, so
every shell tab does not say "untagged".

In this design, the "agent panel" means the Agents sidebar rows and the
pane header.

## 5. Event flow

```
program ──OSC 7501──▶ core ◀──hc label / hc run --label── agent
                       │
                       │ events.subscribe: created, labels, status, finished, removed, …
                       ▼
                 Herdr app: terminals()
                       │ re-render on change
                       ▼
       nested-agents.render(): orgTree(terminals()) → filterTree → rows
       nested-tabs / nested-pane.render(): tagText(t)
```

The mod does not poll, start `hc events` or keep a cache. `render`
rebuilds the tree from `terminals()` on every call. The core already sends
`labels` events with the full map (§7), and the app re-renders mods when
`terminals()` changes (§9). The one link not yet observed is a label event
re-rendering a mod in the real window. F7 measures it.

Cost: `orgTree` is O(n) in live terminals. It runs on every render, so it
must stay a plain pass with no `hc` calls.

## 6. Testing

One command, `bun run check`, runs `scripts/check.sh`:

1. Copies `shared/*.js` into each mod, as `install.sh` does.
2. Runs `herdr-app check` on each mod (F9).
3. Runs `bun test` (F1 to F8).

The same script runs as a pre-commit hook (`.githooks/pre-commit`; enable
with `git config core.hooksPath .githooks`). GitHub CI cannot run it,
because `herdr-app check` needs the macOS app.

Pieces:

- `test/core.js` starts a scratch core for a test file: `HC_SESSION=org-<pid>`,
  XDG paths under `mktemp -d /tmp/hco.XXXX` (short enough for the 103-byte
  socket limit), and it removes `HC_TERMINAL_ID`, `HC_TERMINAL_SOCKET` and
  `HC_SCOPE` from the environment. It stops that core after the tests. It
  never touches the person's core.
- `test/fake-agent.sh <app> <state> [child spec…]` prints one OSC 7501
  report (§2), starts any children it is told to, then sleeps.
- `test/stub/herdr.js` and `test/stub/gpui.js` are loaded with bun's
  `mock.module`. The gpui stub records the element tree: element kind,
  text children, and `id`. The herdr stub serves a fixture `terminals()`,
  `panes()`, `spaces()` and `theme()`. Then a test imports the real
  `main.js` and calls `render()`. `herdr-app check` cannot do this,
  because it renders with empty data (§10).
- Labels are read with `hc get <t> --json`, because `hc ls --json` leaves
  them out (§1).

## 7. Features and acceptance tests

Each test is written before its feature and fails on the commit before it.

**F1. Self-tag.** `test/self-tag.test.js`, on the scratch core:
(a) run `herdr-org-launch poteto test/fake-agent.sh claude-code idle`, then
`hc get` shows `labels["org.profile"] == "poteto"`;
(b) run `hc-context.sh claude` inside a terminal with `HC_PROFILE=poteto`.
The label is set and stdout is still valid hook JSON;
(c) load `pi.ts` with a fake `pi` object and fire `session_start`. The
label is set;
(d) with `HC_PROFILE` unset, no `org.profile` label appears.

**F2. Role on spawn.** `test/spawn.test.js`: a fake parent runs the spawn
line from `hc-context.txt` with `org.role=worker` and the launcher with
`poteto`. Then the child has `org.role=worker` and `org.profile=poteto`,
its `parent` is the parent's address, and `hc label <child> org.role=reviewer`
changes the role.

**F3. Nested leaders.** `test/org.test.js`, pure, on a fixture with lead →
sub-lead → 2 workers, a lone agent and a plain shell. `orgTree` returns
exactly one root (lead). Its kids are sub-lead and any direct workers. The
sub-lead has `leader: true` and the 2 workers. The lone agent and the
shell are not in the result. A second test builds the same 3 levels from
fake agents on the scratch core and runs `orgTree` on the `hc get`
records. A remote fixture (`vps/t3` with bare `parent: "t2"`) nests under
`vps/t2`.

**F4. Untagged.** `test/org.test.js`: terminals with no labels, empty
labels, `labels: undefined`, a missing `report` and a missing `status`
give `role == profile == "untagged"`, `harness == "none"` and
`status == "none"`. `facets` counts them under `untagged`. Rendering the
Leaders view with only untagged terminals does not throw and shows the
text `untagged · untagged`.

**F5. Display.** `test/render.test.js`, through the stubs: render
`nested-agents` in Leaders sort on the F3 fixture. The tree contains a row
per node in depth-first order with its `role · profile` text, and folding
the sub-lead hides its 2 rows. Render `nested-tabs` and `nested-pane` for
the worker's pane. Each contains `worker · poteto`. For a plain shell's
pane, neither contains `untagged`.

**F6. Filters.** `test/filter.test.js`, pure, on a fixed 12-terminal
fixture: each facet alone, two values in one facet (OR), two facets (AND),
text search on name, role and folder, and search plus facets. Each case
asserts the exact set of addresses kept and which kept ancestors have
`match: false`. An empty filter returns the full tree. A filter with no
match returns `[]`.

**F7. Live updates.** `test/live.test.js`, on the scratch core. A test
`herdr` stub keeps `terminals()` from `hc events --json` (snapshot, then
`created`, `labels`, `status`, `finished` and `removed` applied in seq
order). After each event the test renders the real `nested-agents`. It
measures the time from the command to the first render that shows the
change:
(a) `hc label <worker> org.role=reviewer` → `reviewer · …` row;
(b) start a child under a lead → a new row, and the lead becomes a leader;
(c) `hc kill` the last child → the leader leaves the view.
Pass when each is under 500 ms, the median of 5 runs. I will check that
bound against a measured baseline first. This proves the core sends each
fact and that the view keeps no stale state. It does not prove that the
real window re-renders on a `labels` event. One scripted live check covers
that: `hc label` on a fixture terminal, then `herdr-app shot`, and the
row's new role appears in the image. That check goes into the wrap-up
media, not `bun test`.

**F8. Persistence.** `test/persist.test.js`, on the scratch core: build
the F3 fixture with labels, run `hc server restart`, and the labels and
`parent` of every terminal are unchanged. A `--keep` terminal keeps its
labels across `hc server stop` and `hc server start` (§6). The app
closing is not tested. Labels live only in the core, and the app keeps no
copy.

**F9. Mod validity.** `scripts/check.sh` runs `herdr-app check` on every
mod folder and fails on any non-zero exit. The pre-commit hook runs it.

Build order: move the plugin, then F1 to F9 in order. Each is one commit
with its test, and the whole suite passes before the next starts.

## 8. Risks

| Risk | Effect | Handling |
|---|---|---|
| A kept terminal comes back as a shell with its old labels (§6). | The row says `poteto` on a plain shell. | The harness column shows `none`, which makes it plain. When the agent starts again, its hook writes the profile again. No auto-clear. |
| A Codex hook is untrusted, or a sandbox blocks the hc socket. | No self-tag. | `herdr-org-launch` is the fallback. F1 tests both paths. |
| `hc run` does not pass env (§8). | `HC_PROFILE=x hc run …` silently gives no profile. | The spawn sentence and the README use the launcher form only. |
| A label re-render in the window is not observed (§9). | F7's automated part could pass while the window stays stale. | The scripted `herdr-app shot` check in F7. |
| `herdr-app check` uses empty data (§10). | It cannot catch a crash on real data. | The stub harness renders real mod code on fixtures (F4, F5). |
| Socket path limit of 103 bytes. | The tests' core fails to start in a deep temp folder. | `mktemp -d /tmp/hco.XXXX`. |
| The mods are clones of Herdr 0.1.12 mods. | A Herdr update needs the changes moved onto new copies. | Already true today. The org logic is in `shared/org.js` to keep the per-mod diff small. |
| Another tool writes `org.*` labels. | Wrong text. | Low. The prefix makes it unlikely. |

## 9. Out of scope

- Editing a role from the UI. Use `hc label`.
- Inferring a profile from harness flags (`codex --profile`, `claude --agent`)
  or template names.
- Backfilling labels on existing terminals.
- Remembering folded leaders across restarts (`this.folded` is in memory
  today, and it stays that way).
- The status bar (`nested-status`), the Agents tab (`nested-crew`) and the
  Spaces sidebar. They keep their current marks.
- End-to-end tests on a remote machine. The remote parent rule is covered
  by a fixture (F3).
- GitHub CI.

## 10. What a caller writes

To make a terminal show up with a role and profile, a parent writes:

```sh
hc run --bg --name <n> --label org.role=<role> -- herdr-org-launch <profile> <agent command>
```

They get, for free: a row under their own row in the Leaders view, at any
depth; `role · profile` on the child's tab and pane header; filter values
for that role and profile; and live updates when either changes.
