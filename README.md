# herdr-configs

My Herdr mods and layout.

## Install

```sh
git clone <this repo> ~/Dev/personal/herdr-configs
~/Dev/personal/herdr-configs/install.sh
```

Herdr must be open. The script:

1. Links each folder in `mods/` into `~/.config/herdr-app/mods/`.
2. Makes the layout `nested` from Herdr's `main` layout, if it does not exist.
3. Points that layout at the mods here, in place of the Herdr mods they were cloned from.
4. Switches the window to `nested` and checks each mod.

`layout.switch` (`cmd-shift-l` on macOS) switches layouts, so `main` is one key away.

After you edit a mod here, run `install.sh` again. Herdr does not see edits
made through a link; re-making the link reloads the mod.

## Sub-agent modes

Sub-agents are the terminals an agent starts with `hc run`. A sub-agent
belongs to the space of the agent that started it, unless that agent put it
in another space with the `herdr.space` label.

Pick a mode in the clock menu in the Agents header, or run a command:

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

In every mode, clicking a sub-agent opens it with `terminal.peek`.

## Sub-agent and lead marks

These show in every mode, Off included.

- Tab bar: a tab whose agent is a sub-agent starts with `↳` and has dimmer
  text. A tab whose agent has sub-agents shows *Lead of N*, colored by the
  most urgent sub-agent.
- Pane header: a sub-agent's header is tinted and says *Sub-agent of
  `<parent>`*. A lead's header shows *Lead of N*.
- Status bar: the same label for the terminal that has focus.
- Agents list: the row of the sub-agent you are looking at is highlighted,
  and its lead's row lightly.

## Mods

- `nested-agents`: Herdr's `agents` 0.1.12 with the mode menu, the mode
  commands and the Follow filter.
- `nested-spaces`: Herdr's `spaces` 0.1.12 with the Tree, Dots and Agents
  tab chips, and the Dots card.
- `nested-tabs`: Herdr's `tabs` 0.1.12 with the sub-agent and lead marks.
- `nested-pane`: Herdr's `pane` 0.1.12 (the pane header) with the marks.
- `nested-status`: Herdr's `workspace-status` 0.1.12 with the focused
  terminal's mark.
- `nested-crew`: the Agents tab. It reads each sub-agent's screen and branch every 5
  seconds, only while the tab is in front.

`shared/subagents.js` holds the ownership rule, the mode list and the
sub-agent helpers. Herdr loads only files inside a mod's own folder, so
`install.sh` copies it into each mod. Edit it in `shared/`.

Clones do not get Herdr's updates. When Herdr ships a new version of one
of them, clone it again and move these changes onto the new copy.
