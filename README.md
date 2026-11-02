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

`ctrl-shift-l` switches layouts, so `main` is one key away.

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

## Mods

- `nested-agents`: Herdr's `agents` 0.1.12 with the mode menu, the mode
  commands and the Follow filter.
- `nested-spaces`: Herdr's `spaces` 0.1.12 with the Tree, Dots and Agents
  tab modes.

Clones do not get Herdr's updates. When Herdr ships a new `agents` or
`spaces`, clone it again and move these changes onto the new copy.
