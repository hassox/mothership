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

## Mods

`nested-agents` is Herdr's Agents list (cloned from `agents` 0.1.12) with a
Sub-agents mode. Pick the mode in the clock menu in the Agents header.

- **Follow selected space** (default): the list shows only the agents of the
  selected space, with their sub-agents under them.
- **Off**: Herdr's own behavior.

A sub-agent shows under the agent that started it, unless that agent put it
in another space with the `herdr.space` label.
