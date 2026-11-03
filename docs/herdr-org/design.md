# Herdr Org: design

Status: for review. Nothing here is built yet.
Facts cited as §N come from [discovery.md](discovery.md).

## Goal

With many agents running, you cannot see who leads whom or what each one is
for. Herdr Org adds two tags and one view:

- Each agent tags its own **profile** when it starts.
- Each parent tags its child's **role** when it starts the child.
- The Agents sidebar gets an **Org** view: the agents as an org chart, with
  role and profile on each row and a filter panel. A toggle switches
  between **Leaders** (leaders and their children) and **All** (every
  agent).

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
| `profile` | label `org.profile` | the agent itself at start | `null` |
| `role` | label `org.role` | the parent at spawn (`hc run --label`), editable later with `hc label` | `null` |
| `harness` | OSC 7501 `app` (`report.app`): `claude-code`, `codex`, `pi` | the program | `null` |
| `machine` | address prefix (`vps/t7` → `vps`) | the core | `local` |
| `status` | `status` word (`working`, `blocked`, `done`, `idle`) | the program | `null` |
| `parent` | `parent`, with the machine prefix added (existing `kidsByParent`) | the core, once at start | no parent |

The mod never infers a role or a profile from a name, a template or argv.
A missing value shows nothing: no text, no placeholder, and no filter
entry.

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
the Org view agree. Nesting works at any depth: a sub-agent with
children is a leader under its own leader. `org.role=lead` is display
data. It does not make a terminal a leader.

When a leader's last child ends, it leaves the Leaders scope. It
stays in the All scope and in the normal Agents list.

### Scope

| Scope | Roots | Under each root |
|---|---|---|
| Leaders | leaders with no live leader above them | the full subtree |
| All | every org member with no live parent: leaders and lone agents | the full subtree |

An org member is a live terminal that reports agent status (OSC 7501) or
has a parent or children. A plain shell outside any tree is not a member,
so All does not list every shell.

### Shape

One pure module, `shared/org.js`. `install.sh` already copies `shared/*.js`
into each mod.

```js
// OrgNode
{
  t,                 // the terminals() record
  address,           // "t7" or "vps/t7"
  role, profile,     // label value or null
  harness,           // report.app or null
  machine,           // prefix or "local"
  status,            // status word or null
  kids: OrgNode[],   // live children, in terminals() order
  leader: boolean,   // kids.length > 0
}

orgTree(terminals, scope) // scope "leaders" | "all" → OrgNode[]: the roots in the Scope table, each with its full subtree
facets(roots)        // → { role, profile, harness, machine, status }: Map<value, count> each, null values left out
parseQuery(text)     // → { words: string[], role: string[], profile: [], harness: [], machine: [], status: [] }
toggleTerm(text, key, value) // → the search text with `key:value` added or removed (the popup's ticks)
filterTree(roots, query) // → OrgNode[]: matches and their ancestors, with node.match = false on ancestors kept only for context
tagText(t)           // → "worker · poteto", "worker", "poteto", or null when neither label is set
```

`orgTree` reuses `kidsByParent(all, false)`, so remote parents resolve the
same way they do today.

### Migration

Existing terminals have no `org.*` labels. They show with no tag text,
still in the right place in the tree, because the tree comes from `parent`. The
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
agent-files' only herdr item (discovery "Existing code"). Herdr Org adds
no new SKILL.md. The plugin's context message is how agents learn the
steps, as it is today.

This repo takes over the install:

- `install.sh` gets agent-files' plugin steps (`claude`, `codex`, `grok`,
  `agy` and `pi`, each skipped when not on `PATH`), after the mod steps.
- `.claude-plugin/marketplace.json` and `.agents/plugins/marketplace.json`
  are added here, with one plugin each: `hc-context`.

agent-files stops installing it, so the hook does not run twice:

- `hc-context` is removed from its two marketplace files and from its
  `install.sh`.
- `plugins/hc-context/` is replaced by a `README.md` that points to this
  repo and names the commit. git keeps the history.
- Its `README.md` plugin row points here.
- Your uncommitted edits to agent-files' `README.md` and `install.sh` stay
  as they are. My changes go into the same files without touching yours,
  and I show you the diff before I commit there.
- After the move, each harness must uninstall the old plugin from the
  `hassox-agent-files` marketplace and install it from this repo.
  `install.sh` here does the install. The uninstall is one command per
  harness, listed in the README.

### Launch step: the agent tags its own profile

A profile is free text that says what the agent is, such as `poteto` or
`reviewer`. It comes from one of two places. The first one that applies
wins:

1. **`HC_PROFILE` is set.** The start hook tags it before the model runs.
   This path is reliable and tested (F1).
2. **The agent tells us.** The context message asks the agent to tag
   itself when it knows its profile:

   > If `$HC_PROFILE` is unset and you know your profile (a persona, mode
   > or job name that your task or a skill gave you), run
   > `hc label $HC_TERMINAL_ID org.profile=<name>`. Run it again if your
   > profile changes.

   This path depends on the model following the message, so it is best
   effort. It cannot be tested without a model. I check it once by hand
   with a real Claude Code, Codex and pi session, and report what each did.

With neither, there is no profile label and the view shows no profile.

**No new tool.** `hc label` is already a command every agent can run
through its shell. A dedicated tool would mean an MCP server in each
harness for one command, and it would make the model no more likely to
call it. If the best-effort path proves unreliable in the hand check, the
fix is a sharper message, or relying on `HC_PROFILE` alone.

The hook changes for path 1:

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

### 4.1 Org view, in the Agents sidebar

A third entry joins the existing **Sort agents** menu: *Priority*,
*Grouped by space*, **Org**. A command, `nested-agents.org`, also selects
it. The choice is stored in `shared("agents.sort")`, as today. The
sub-agent modes (`MODES`) do not change. An Org entry there would also
change the Spaces and Tabs mods, and Org is a different list, not a
different way to show sub-agents.

A two-way toggle in the header picks the scope (§1 Scope): **Leaders**
or **All**. It is stored in `shared("org.scope")`, default `leaders`. A
command, `nested-agents.org-scope`, flips it, so a key can be bound to it.

Leaders scope:

```
┌ Agents ─────────── [Leaders|All] ⚲ ⊟ ┐   scope toggle, ⚲ filter popup, ⊟ sort menu
│ ┌────────────────────────────────┐   │
│ │ ⌕ role:worker profile:poteto  ×│   │   search box; × clears it
│ └────────────────────────────────┘   │
│                                      │
│ ▾ ◆ prime / 1          lead · poteto ◌│   leader (no live leader above)
│   ├ ✳ fix              worker · poteto ⟳│
│   ├ ▾ ◆ review     sub-lead · reviewer ●│   nested leader, foldable
│   │   ├ ✳ r-ui                 worker ⟳│   no profile label: role only
│   │   └ ✳ r-api                worker !│
│   └ ✳ notes                           ◌│   no labels: no tag text
│ ▸ ◆ vps/t3                          2 │   folded leader: count of children
│                                      │
│ 2 leaders · 7 agents                 │
└──────────────────────────────────────┘
```

All scope, same terminals plus two lone agents:

```
┌ Agents ─────────── [Leaders|All] ⚲ ⊟ ┐
│ ▸ ◆ prime / 1          lead · poteto 5│
│ ▸ ◆ vps/t3                          2 │
│   ✳ scratch                   poteto ◌│   lone agent: a root with no children
│   ✳ docs                            ⟳│
│                                      │
│ 2 leaders · 9 agents                 │
└──────────────────────────────────────┘
```

- Rows use the existing `subRow` look: tree lines, program icon, name,
  then `role · profile` in dim text, then the status badge.
- A leader row folds with the chevron. A folded leader shows its child
  count, colored by its most urgent child, like today's `fold`.
- Click a row: `pane.focus` for a terminal with a pane, `terminal.peek`
  for one without, as today.
- With a filter on, rows that are kept only to show where a match sits
  (its ancestors) are dimmed.
- The tag text holds only the labels that are set: `role · profile`,
  `role`, `profile`, or nothing.
- Empty, Leaders scope: "No leaders. A leader is an agent that started
  another with `hc run`." Empty, All scope: "No agents."

### 4.2 Search and filter

The search box is the filter. Its text is the only filter state. It uses
the pattern of GitHub's issue search, where a bare word searches
everything and `key:value` searches one field:

| You type | Keeps nodes whose |
|---|---|
| `review` | name, address, role, profile or folder contains `review` |
| `role:worker` | role contains `worker` |
| `profile:poteto` | profile contains `poteto` |
| `harness:codex`, `machine:vps`, `status:blocked` | that field contains the value |
| `role:worker role:reviewer` | role contains either (the same key twice is OR) |
| `role:worker profile:poteto api` | all three match (different keys and bare words are AND) |
| `profile:"two words"` | quotes keep a value with spaces together |

Matching ignores case. A node with no role never matches `role:…`. An
unknown key, such as `foo:bar`, is searched as a bare word.

The ⚲ button opens a popup that lists the values in the current tree.
Ticking a value adds its `key:value` term to the search text, and
unticking it removes the term. So the popup is a shortcut for typing,
the same as the label dropdown in GitHub's issue list. The popup opens the
same way the sort menu does
(`openOverlay({mod: "nested-agents", kind: "popup", props: {filterMenu: true}})`).

```
┌ Filter ─────────────────────┐
│ Role                        │
│  ☑ worker            4      │
│  ☐ sub-lead          1      │
│  ☐ lead              1      │
│ Profile                     │
│  ☐ poteto            3      │
│  ☐ reviewer          1      │
│ Harness                     │
│  ☐ claude-code       6  …   │
│ Machine                     │
│  ☐ local  ☐ vps             │
│ Status                      │
│  ☐ working ☐ blocked ☐ idle │
│                 Clear all   │
└─────────────────────────────┘
```

- The values and counts come from the current tree in the current scope
  (`facets`). A value shows only when some node has it. A missing label is
  not a value, so the popup has no "untagged" entry.
- A node stays if it matches, or if any node below it matches. That is how
  the VS Code and GitHub file trees filter.
- The search text lives in `shared("org.filter")` as one string. The box,
  the popup's ticks and the list all read it, and setting it re-renders
  all three.

### 4.3 Tab bar and pane header

`tagText(t)` appears in dim text after the name:

```
Tab bar:   [ ◆ prime  lead · poteto  Lead of 3 ⟳ ]  [ ↳ ✳ fix  worker · poteto ⟳ ]  [ ✳ docs ⟳ ]
Pane head: Sub-agent of prime  ✳ fix  worker · poteto   ~/repo        ⟳  ⊞ ⊟ ⤢ ×
```

`tagText` holds only the labels that are set. A terminal with neither
label shows exactly what it shows today (`docs` above).

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
       nested-agents.render(): orgTree(terminals(), scope) → filterTree → rows
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
The agent-tells-us path (§3, path 2) has no automated test, because it
needs a model. It gets the hand check described in §3.

**F2. Role on spawn.** `test/spawn.test.js`: a fake parent runs the spawn
line from `hc-context.txt` with `org.role=worker` and the launcher with
`poteto`. Then the child has `org.role=worker` and `org.profile=poteto`,
its `parent` is the parent's address, and `hc label <child> org.role=reviewer`
changes the role.

**F3. Nested leaders.** `test/org.test.js`, pure, on a fixture with lead →
sub-lead → 2 workers, a lone agent and a plain shell. `orgTree(…, "leaders")`
returns exactly one root (lead). Its kids are sub-lead and any direct
workers. The sub-lead has `leader: true` and the 2 workers. The lone agent
and the shell are not in the result. `orgTree(…, "all")` returns two
roots, the lead (same subtree) and the lone agent, and still not the
shell. A second test builds the same 3 levels from
fake agents on the scratch core and runs `orgTree` on the `hc get`
records. A remote fixture (`vps/t3` with bare `parent: "t2"`) nests under
`vps/t2`.

**F4. Untagged.** `test/org.test.js`: terminals with no labels, empty
labels, `labels: undefined`, a missing `report` and a missing `status`
give `role`, `profile`, `harness` and `status` of `null`. `tagText`
returns `null` for them, `"worker"` for a role alone and `"poteto"` for a
profile alone. `facets` leaves `null` out, so no facet has an empty or
"untagged" entry. Rendering the Org view in both scopes with only
untagged terminals does not throw, shows a row per terminal, and has no
text `untagged` anywhere in the tree.

**F5. Display.** `test/render.test.js`, through the stubs: render
`nested-agents` in Org sort on the F3 fixture. The tree contains a row
per node in depth-first order with its tag text, and folding the sub-lead
hides its 2 rows. Clicking the scope toggle sets `shared("org.scope")`,
and the next render adds the lone agent's row. Render `nested-tabs` and
`nested-pane` for the worker's pane. Each contains `worker · poteto`. For
an untagged agent's pane, the rendered text equals what it renders today
with no labels.

**F6. Filters.** `test/filter.test.js`, pure, on a fixed 12-terminal
fixture, one case per row of the §4.2 table: a bare word, each
`key:value` key, the same key twice (OR), two keys (AND), keys plus a bare
word, a quoted value, an unknown key, and `role:x` against nodes with no
role. Each case asserts the exact set of addresses kept and which kept
ancestors have `match: false`. An empty query returns the full tree. A
query with no match returns `[]`. A second test file,
`test/render.test.js`, ticks `role:worker` in the rendered popup, then
unticks it. The search text becomes `role:worker` and then empty.

**F7. Live updates.** `test/live.test.js`, on the scratch core. A test
`herdr` stub keeps `terminals()` from `hc events --json` (snapshot, then
`created`, `labels`, `status`, `finished` and `removed` applied in seq
order). After each event the test renders the real `nested-agents`. It
measures the time from the command to the first render that shows the
change:
(a) `hc label <worker> org.role=reviewer` → `reviewer · …` row;
(b) start a child under a lead → a new row, and the lead becomes a leader;
(c) `hc kill` the last child → the leader leaves the Leaders scope, and
stays in the All scope.
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

Build order: move the plugin and its install into this repo, then stop
agent-files installing it, then F1 to F9 in order. Each F is one commit
with its test, and the whole suite passes before the next starts.

### Wrap-up

- A README section: the skills and hooks, the launcher, the Org view and
  its search syntax, and how to run the checks.
- `preview.png`, a `herdr-app shot` of the Org view with the 3-level
  fixture and a search applied. herdr.dev needs it to list a shared mod
  or layout.
- `RECIPE.md`. herdr.dev also needs it, written in the order the app
  guide gives: what you see, how it behaves, built from, watch out, done
  when.
- A short video of the Leaders and All scopes, folding, and the search.
  `herdr-app shot` saves single frames, so the video is a sequence of
  shots joined into one file.
- The fixture agents for the captures run on your real core, with a
  `herdr.space` label so the window shows them, and I remove them after.

## 8. Risks

| Risk | Effect | Handling |
|---|---|---|
| A kept terminal comes back as a shell with its old labels (§6). | The row says `poteto` on a plain shell. | The shell reports no harness, so no harness shows. When the agent starts again, its hook writes the profile again. No auto-clear. |
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

They get, for free: a row under their own row in the Org view, at any
depth; `role · profile` on the child's tab and pane header; filter values
for that role and profile; and live updates when either changes.
