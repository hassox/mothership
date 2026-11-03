# herdr-configs

A Herdr layout, `nested`, for agents that start other agents. The Agents
list shows your agents as an org: each leader with the agents it started,
with each agent's role and profile, and a search across them. A plugin
makes agents tag themselves.

![The Org view](preview.png)

[A 12-second video](docs/herdr-org/media/org-view.mp4) shows the Leaders
and All scopes, a search, and a sub-agent's leader button.

## Install

```sh
git clone git@github.com:hassox/herdr-configs.git hassox-herdr-configs
cd hassox-herdr-configs
./install.sh
```

Herdr must be open. The script:

1. Copies each folder in `mods/` into `~/.config/herdr-app/mods/` and
   checks it. It replaces only folders it installed before (they hold a
   `.herdr-configs` file) and links from older installs.
2. Copies `layouts/nested.json` into `~/.config/herdr-app/layouts/` if you
   have no `nested` layout yet, and always copies its Settings picture,
   `layouts/nested.png`. Then it switches the window to `nested`.
3. Links `bin/herdr-org-launch` into `~/.local/bin`.
4. Installs the `hc-context` plugin into each harness on `PATH`: Claude
   Code, Codex, Grok Build, `agy` and pi.

`layout.switch` (`cmd-shift-l` on macOS) switches layouts, so `main` is
one key away.

After you edit a mod here, run `install.sh` again. Herdr reloads a mod, in
every pane and panel that shows it, when a file in
`~/.config/herdr-app/mods/` changes. It does not see changes made through
a link, so the script copies. Edit the files here, not the copies.

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
pi remove ~/Dev/personal/agent-files/plugins/hc-context
```

Then run `./install.sh`.

## The Org view

Choose **Org** in the sort menu at the right of the Agents header, or run
`nested-agents.org`.

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
  `nested-agents.org-scope` flips the two, so you can bind it to a key.
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
| Follow selected space (default) | `nested-agents.follow` | The Agents list shows only the selected space's agents, with their sub-agents under them. |
| Tree in Spaces | `nested-agents.tree` | A space row shows its sub-agent count and most urgent status. Click it to list the sub-agents under the row. |
| Dots in Spaces | `nested-agents.dots` | One dot per sub-agent on its space row. Click the dots for a card with each one's status and report. |
| Agents tab | `nested-agents.tab` | A count on the space row. Click it to open an Agents tab with a card per sub-agent and the last lines of its screen. |
| Off | `nested-agents.off` | Herdr's own behavior. |

`nested-agents.next` goes to the next mode. To bind it to a key, add it to
`~/.config/herdr-app/keys.json`, for example
`"global": { "cmd-shift-m": "nested-agents.next" }`.

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

- `layouts/nested.json`: the layout, a clone of Herdr's `main` 0.1.12.
- `mods/`: clones of Herdr's 0.1.12 mods. `nested-agents` (`agents`) has
  the Org view, the modes and the Follow filter. `nested-spaces` (`spaces`)
  has the Tree, Dots and Agents tab chips. `nested-tabs` (`tabs`),
  `nested-pane` (`pane`) and `nested-status` (`workspace-status`) have the
  marks. `nested-crew` is the Agents tab; it reads each sub-agent's screen
  and branch every 5 seconds, only while the tab is in front.
- `shared/`: `subagents.js` (parents, sub-agent trees, marks) and `org.js`
  (the org tree, search, filter values, tag text). Herdr loads only files
  inside a mod's own folder, so `install.sh` copies them into each mod.
  Edit them in `shared/`.
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

It copies `shared/` into each mod, runs `herdr-app check` on every mod,
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
