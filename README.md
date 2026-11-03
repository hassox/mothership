# Mothership

A Herdr layout for agents that start other agents. The Agents
list shows your agents as an org: each leader with the agents it started,
with each agent's role and profile, and a search across them. A plugin
makes agents tag themselves.

![The Org view](preview.png)

[A 12-second video](docs/herdr-org/media/org-view.mp4) shows the Leaders
and All scopes, a search, and a sub-agent's leader button.

## Install

Herdr must be open.

```sh
git clone git@github.com:hassox/mothership.git
cd mothership
make install
```

`make install` (or plain `make`) installs everything. To install only some
pieces, name them:

```sh
make mothership-agents mothership-pane
```

| Name | What it adds | Also installs |
|---|---|---|
| `mothership-agents` | The Agents list: the Org view, the sub-agent mode menu and Follow mode. | |
| `mothership-pane` | The pane header: tags, *Lead of N*, the leader button. | |
| `mothership-tabs` | The tab bar: tags, the `↳` and *Lead of N* marks. | |
| `mothership-status` | The status bar: the focused terminal's mark. | |
| `mothership-spaces` | The Spaces list: the Tree, Dots and Agents tab modes. | `mothership-agents` (it has the mode menu), `mothership-crew` |
| `mothership-crew` | The Agents tab that the Agents tab mode opens. | |
| `launcher` | `herdr-org-launch` in `~/.local/bin`. | |
| `plugin` | The `hc-context` plugin, in the harnesses you choose (below). | |

The Makefile's prerequisite lines are the dependency list; `make -n <name>`
shows what a name would install without doing it.

Each mod:

1. Is copied into `~/.config/herdr-app/mods/<name>/` and checked with
   `herdr-app check`. `make` stops rather than replace a folder there that
   it did not install (one without a `.mothership` file).
2. Takes the place of the Herdr mod it was cloned from in your `mothership`
   layout. `make` creates `mothership` from Herdr's `main` the first time, so
   the panels you did not install stay Herdr's own. It also sets the
   layout's Settings picture.
3. Switches the window to `mothership`.

`layout.switch` (`cmd-shift-l` on macOS) switches layouts, so `main` is
one key away. To drop a mod later, see [Uninstall](#uninstall).

`make plugin` looks for Claude Code, Codex, Grok Build, `agy` and pi on
`PATH`, and skips any that already have `hc-context`. In a terminal it asks
for each one; Enter means yes. Without a terminal, as when an agent runs
`make`, it installs into all of them. `HARNESSES` names the ones you want
and skips the questions:

```sh
make plugin HARNESSES="claude pi"
```

After you edit a mod here, run `make install` again. Herdr reloads a mod, in every
pane and panel that shows it, when a file in `~/.config/herdr-app/mods/`
changes. It does not see changes made through a link, so `make` copies.
Edit the files here, not the copies.

Codex runs a new or changed plugin hook only after you trust it. After the
first install, and after a change to `plugins/hc-context/hooks/codex.json`,
open `codex` and trust the `hc-context` hook.

### Moving from agent-files

`hc-context` used to come from hassox/agent-files. Remove that copy first,
or its hook runs twice:

```sh
claude plugin uninstall hc-context@hassox-agent-files
codex plugin remove hc-context@hassox-agent-files
grok plugin uninstall hc-context
agy plugin uninstall hc-context
pi remove "$(pi list | sed -n 's#^ *\(/.*/agent-files/plugins/hc-context\)$#\1#p')"
```

Then run `make install`.

## Uninstall

```sh
make uninstall
```

removes everything `make` installs. To remove one piece, put `uninstall-` in
front of its name:

```sh
make uninstall-mothership-pane uninstall-plugin
```

| Name | What it removes |
|---|---|
| `uninstall-layout` | Switches the window to `main`, then deletes the `mothership` layout and its picture. |
| `uninstall-<mod>` | The mod's folder, if it holds a `.mothership` file, and puts Herdr's own mod back in its block of the `mothership` layout. Removing `mothership-agents` or `mothership-crew` also removes `mothership-spaces`, which needs them. |
| `uninstall-launcher` | `~/.local/bin/herdr-org-launch`, if it points into this clone. |
| `uninstall-plugin` | `hc-context` and this repo's marketplace from each harness that has it. `HARNESSES` limits it to the ones you name. |

`make uninstall` removes the layout first, so the window is on `main` before
the mods go. Like `make`, it needs Herdr open.

## The Org view

Choose **Org** in the sort menu at the right of the Agents header, or run
`mothership-agents.org`.

- **Leaders | All.** A leader is an agent with no parent, or any terminal
  whose agents it started are still running. Leaders shows only leaders,
  nested at any depth. All shows every agent under its leader.
- **Status.** Each row's badge is that agent's own status, as in Priority:
  `!` needs you, a blue dot for done, a spinner for working, a ring for
  idle. A leader whose reports are hidden or folded shows their count in
  the color of the most urgent status anywhere in its team; hover it for
  the breakdown, such as "3 reports · team: 1 needs you, 2 working".
- **Order.** Whatever needs you comes first, then done, then working, then
  idle, as in Priority. A row ranks by its own status or its team's,
  whichever is more urgent, at every depth, so the path to the agent that
  needs you is at the top. Rows that rank the same keep their order.
  `agent.next` and `agent.prev` follow the rows as shown.
  `mothership-agents.org-scope` flips the two, so you can bind it to a key.
- **Rows.** Each row shows the agent's role and profile, `worker · poteto`.
  Only the labels that are set show; an untagged agent shows none. A
  top-level agent is named by where it shows, `acme-api / 1`. Click a row
  to focus its pane, or to peek at a sub-agent that has none. The chevron
  folds a leader.
- **Search.** The box filters the tree. A row stays when it or a row under
  it matches.

| You type | Keeps |
|---|---|
| `review` | name, address, role, profile or folder contains `review` |
| `role:worker` | role contains `worker` |
| `profile:poteto` | profile contains `poteto` |
| `harness:codex`, `machine:vps`, `status:blocked` | that field contains the value |
| `role:worker role:reviewer` | either role (the same key twice is OR) |
| `role:worker profile:poteto api` | all three (different keys and words are AND) |
| `profile:"two words"` | a value with spaces |

The filter button lists every value in the tree with a count. Ticking one
adds its term to the search; unticking removes it.

![A search](docs/herdr-org/media/search.png)

## Roles and profiles

Both are hc labels on the terminal: `org.role` and `org.profile`.

- **Role.** The agent that starts a sub-agent sets it:

  ```sh
  hc run --bg --name fix --label org.role=worker -- herdr-org-launch poteto claude "Fix x.rs"
  ```

  Change it later with `hc label fix org.role=reviewer`.
- **Profile.** The agent tags itself when it starts. The `hc-context`
  plugin's start hook runs `hc label "$HC_TERMINAL_ID" org.profile="$HC_PROFILE"`
  when `HC_PROFILE` is set. Set it in your shell
  (`alias poteto='HC_PROFILE=poteto claude'`), in a template's `command`,
  or with the launcher.
- **Launcher.** `herdr-org-launch <profile> <command>` sets `HC_PROFILE`,
  tags the profile and runs the command in its place. Use it for a child,
  because `hc run` does not pass your environment to the child, and for a
  harness whose hook cannot run.
- **Agents that know their profile.** The plugin also asks each agent to
  tag itself when `HC_PROFILE` is unset and a skill or its task gave it a
  profile. That depends on the model following the message.

The plugin's message tells every agent the spawn form above, so agents tag
their children's roles without being asked.

## Take me to your leader

A sub-agent's pane header starts with an alien and *Sub-agent of
`<leader>`*. Click it to show the leader; click again there to go up one
more level. Hover it for the leader's role and profile.

![The leader button](docs/herdr-org/media/leader-button.png)

A sub-agent you peek at has no button, because the peek bar is Herdr's own
mod. Keep it as a tab to get one.

## Sub-agent modes

Sub-agents are the terminals an agent starts with `hc run`. A sub-agent
belongs to the space of the agent that started it, unless that agent put it
in another space with the `herdr.space` label.

Pick a mode in the sort menu in the Agents header, or run a command:

| Mode | Command | What you see |
|---|---|---|
| Follow selected space (default) | `mothership-agents.follow` | The Agents list shows only the selected space's agents, with their sub-agents under them. |
| Tree in Spaces | `mothership-agents.tree` | A space row shows its sub-agent count and most urgent status. Click it to list the sub-agents under the row. |
| Dots in Spaces | `mothership-agents.dots` | One dot per sub-agent on its space row. Click the dots for a card with each one's status and report. |
| Agents tab | `mothership-agents.tab` | A count on the space row. Click it to open an Agents tab with a card per sub-agent and the last lines of its screen. |
| Off | `mothership-agents.off` | Herdr's own behavior. |

`mothership-agents.next` goes to the next mode. To bind it to a key, add it to
`~/.config/herdr-app/keys.json`, for example
`"global": { "cmd-shift-m": "mothership-agents.next" }`.

## Sub-agent and lead marks

These show in every mode, Off included.

- Tab bar: a tab whose agent is a sub-agent starts with `↳` and has dimmer
  text. A tab whose agent has sub-agents shows *Lead of N*, colored by the
  most urgent sub-agent. Each tab shows its agent's role and profile.
- Pane header: a sub-agent's header is tinted and has the leader button. A
  lead's header shows *Lead of N*. Each header shows the role and profile.
- Status bar: the same label for the terminal that has focus.
- Agents list: the row of the sub-agent you are looking at is highlighted,
  and its lead's row lightly.

## What is in this repo

- `Makefile` and `scripts/`: install and uninstall. `scripts/swap-layout.py`
  puts a mod in the place of the Herdr mod it was cloned from, and back.
  `scripts/plugin.sh` holds each harness's install, uninstall and
  "already installed?" commands.
- `layouts/mothership.json`: the full layout, a clone of Herdr's `main` 0.1.12
  with every mod swapped in, for herdr.dev. `make` builds yours from `main`
  instead, so it holds only the mods you install.
- `mods/`: clones of Herdr's 0.1.12 mods. `mothership-agents` (`agents`) has
  the Org view, the modes and the Follow filter. `mothership-spaces` (`spaces`)
  has the Tree, Dots and Agents tab chips. `mothership-tabs` (`tabs`),
  `mothership-pane` (`pane`) and `mothership-status` (`workspace-status`) have the
  marks. `mothership-crew` is the Agents tab; it reads each sub-agent's screen
  and branch every 5 seconds, only while the tab is in front.
- `shared/`: `subagents.js` (parents, sub-agent trees, marks) and `org.js`
  (the org tree, search, filter values, tag text). Herdr loads only files
  inside a mod's own folder, so each mod folder holds a copy of the ones it
  imports. Edit them in `shared/`, then run `make sync` to update the
  copies. `bun run check` fails if a copy differs from `shared/`.
- `plugins/hc-context/`: the plugin, with a manifest and hook for each
  harness. Moved from hassox/agent-files at commit `45c89c3`.
- `bin/herdr-org-launch`: the launcher.
- `docs/herdr-org/`: the discovery notes, the design and the media.
- `RECIPE.md` and `preview.png`: the listing for herdr.dev.

Clones do not get Herdr's updates. When Herdr ships a new version of one
of them, clone it again and move these changes onto the new copy.

## Tests

```sh
bun run check
```

It runs `herdr-app check` on every mod,
then `bun test`. The tests need `hc`, `herdr-app` and `bun`, and no model
keys:

- `test/org.test.js`, `test/filter.test.js`: the org tree, the leader
  rule, untagged agents, search and filter values.
- `test/render.test.js`: renders the real mods against stubbed `herdr`
  and `gpui-kit` modules and checks rows, tags, folding, the scope toggle,
  the search box, the filter popup and the leader button.
- `test/self-tag.test.js`, `test/spawn.test.js`, `test/persist.test.js`,
  `test/live.test.js`: start their own scratch hc core under `/tmp` (never
  yours) with fake agents (`test/fake-agent.sh`). They check self-tagging
  through the hook, the launcher and the pi extension, role tagging on
  spawn, labels across a core restart, and that a label change, a new
  child and an ended child reach the rendered view from the event stream.

To run the checks before each commit:

```sh
git config core.hooksPath .githooks
```

`test/demo-org.sh` starts a small fake org under your current terminal;
`test/demo-org.sh --clean` removes it.
