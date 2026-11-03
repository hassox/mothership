# Herdr Org: discovery

Date: 2026-11-03. Versions: `hc 0.1.17`, `herdr-app 0.1.12`, `bun 1.4.3`.

All experiments ran on a scratch core with its own `HC_SESSION=org` and its
own XDG paths, never on the person's core. The command output below is
copied from those runs. Long JSON lines are cut where marked `…`.

## Summary

| Question | Answer | Evidence |
|---|---|---|
| Label syntax | `hc label <t> key=value…`; `key=` removes one. `hc run --label k=v` (repeatable) sets labels at start. | §1 |
| Key/value or free-form | Key/value. `labels` is a `string → string` map. The core never interprets it. Dots, spaces, `;`, `=` and `:` in values are kept as-is. | §1, schema |
| Persist across `hc server restart` (what `hc update` does) | Yes. Labels and `parent` are unchanged and the programs keep running. | §4 |
| Persist across `hc server stop` + start | A `--keep` terminal comes back live with its labels. Other terminals finish (`reason: server_stop`), but the finished record keeps its labels. Herdr enables keep on every terminal it shows. | §5, §6 |
| Survive the app closing | Labels are stored in the core, not the app. The app holds no copy to lose. Not run as an experiment. | app guide |
| Label change events | `events.subscribe` / `hc events` sends `{"type":"labels","terminal":"t11","data":{"labels":{…}}}` with the full new map. | §7 |
| Parent/child | `parent` is the starter's address, set once at start by the core. Start from inside a terminal and the parent is set without flags. 3 levels work. | §3 |
| OSC 7501 fields | `ESC ]7501;state=<s>:app=<a>[:msg=<base64>][:title=<base64>][:kind=…][:progress=…][:id=…] BEL or ST`. `state` and `app` reach clients as `status.state` and `status.app`, and `hc ls` shows `app` as `agent`. | §2 |
| Env through `hc run` | Not passed. A child does not see the caller's environment. | §8 |
| Mod data | `terminals()` returns every core terminal with `labels`, `parent`, `status` and `report`. It is live: a mod re-renders when it changes. | §9 |
| `herdr-app check` | Loads a mod, renders it once with **empty data** (`terminals()` is `[]`), exits non-zero on error. `--print-spec` prints the element tree. | §10 |

Labels hold key/value data and persist, so no sidecar is needed.

## Existing code

### herdr-configs (this repo)

- `shared/subagents.js` holds the parent rule. `kidsByParent(all, hidePlaced)`
  groups live terminals by their parent and adds the machine prefix to a
  remote parent. `subTree(by, addr)` walks it at any depth.
  `roles(all)(addr)` gives `{parent, subs, status}`. That drives the
  *Lead of N* chip and the *Sub-agent of X* mark. `install.sh` copies the
  file into each mod.
- `mods/nested-agents` is the Agents sidebar. It has two sorts (Priority,
  Grouped by space), the sub-agent mode menu (`MODES`), folding
  (`this.folded`), sub-agent rows (`subRow`) and a sort popup
  (`openOverlay({mod: "nested-agents", props: {sortMenu: true}})`).
- `mods/nested-tabs`, `mods/nested-pane` and `mods/nested-status` put the
  sub-agent and lead marks on the tab bar, the pane header and the status bar.
- `mods/nested-crew` is the Agents tab. `mods/nested-spaces` is the spaces
  sidebar with the Tree and Dots chips.
- No tests and no `package.json` exist.

### agent-files

The herdr item in agent-files is one plugin, `plugins/hc-context` (source
commit `45c89c3`). It contains:

- `hc-context.txt`. One line: read `hc --skill` and `herdr-app --skill`.
- `hc-context.sh`. Prints that line as hook JSON when `HC_TERMINAL_ID` is set.
- Hooks for Claude Code and Grok Build (`hooks/hooks.json`, SessionStart),
  Codex (`hooks/codex.json`, SessionStart, needs trust), `agy`
  (`hooks.json`), and pi (`pi.ts`, `before_agent_start`).
- Registered in `.claude-plugin/marketplace.json`,
  `.agents/plugins/marketplace.json` and `install.sh`.

agent-files has no herdr SKILL.md. The skill text comes from Herdr itself
(`hc --skill`, `herdr-app --skill`). The agent-files working tree has
uncommitted edits to `README.md` and `install.sh`.

pi has a `session_start` event as well as `before_agent_start`
(`pi-coding-agent/dist/core/extensions/types.d.ts`).

## §1. Labels: set, change, remove

```text
$ hc run --bg --json --name lead --label org.role=lead -- sh -c sleep 600
{"address":"t11","agent":"sh",…,"name":"lead","state":"live","turn":0}

{"address":"t11","name":"lead","parent":null,"labels":{"org.role":"lead"}}
$ hc label lead org.profile=poteto org.note=two words; a=b:c
{"address":"t11",…,"labels":{"org.note":"two words; a=b:c","org.profile":"poteto","org.role":"lead"},…}

$ hc label lead org.profile=
{"address":"t11",…,"labels":{"org.note":"two words; a=b:c","org.role":"lead"},…}
```

`hc ls --json` is a short form **without labels**. Use `hc get <t> --json`,
`hc ls --label k=v` or the event stream to read them:

```text
$ hc ls --json | jq .terminals
{"address":"t11","agent":"sh","cwd":"…/leaders","name":"lead","state":"live","turn":0}
$ hc ls --json --label org.role=worker
["a1"]          # of a1 (org.role=worker) and a2 (org.role=lead)
```

The person's core shows the same short form, with `parent` and `agent`:

```text
{"address":"t1j","agent":"claude-code","cwd":"…/fix-tests","name":"fix-tests","parent":"t1f","state":"live","status":"done","turn":40,"where":"my-project / 1"}
```

## §2. OSC 7501

Claude Code's encoder (from its binary):

```js
function c8r(e){let r=[`state=${e.state}`,"app=claude-code"];if(e.id!==void 0)r.push(`id=${e.id}`);
if(e.state==="blocked"&&e.kind)r.push(`kind=${e.kind}`); … if(e.title)r.push(`title=${N(e.title,ie)}`);
if(e.msg)r.push(`msg=${N(e.msg,oe)}`);return iS(nh.PROGRAM_STATUS,r.join(":"))}   // N() = base64
```

A plain `msg=hello` (not base64) makes the core drop the whole report.
Valid reports from a shell script:

```text
$ hc run --bg --name q1 -- sh -c "printf '\033]7501;state=working:app=fake\007'; sleep 30"
$ hc run --bg --name q2 -- sh -c "printf '\033]7501;state=working:app=fake:msg=aGVsbG8gd29ybGQ=\033\\'; sleep 30"
{"status":{"app":"fake","state":"working"},"reported":true,"records":null}
{"status":{"app":"fake","msg":"hello world","state":"working"},"reported":true,"records":null}
{"address":"t9","agent":"fake",…,"name":"q1","state":"live","status":"working","turn":0}
```

So a fake agent is one `printf` plus `sleep`. `app=` is the harness word:
`claude-code`, `codex` or `pi` for real agents.

## §3. Parent and child, 3 levels, self-tag

`kid.sh` labels itself, then starts a sub-lead that starts a worker:

```sh
hc label "$HC_TERMINAL_ID" org.profile=self-tagged
hc run --bg --json --name sub --label org.role=sub-lead -- sh -c 'hc run --bg --json --name w1 --label org.role=worker -- sleep 600; sleep 600'
```

```text
{"address":"t12","name":"boss","parent":null,"labels":{"org.profile":"self-tagged"}}
{"address":"t13","name":"sub","parent":"t12","labels":{"org.role":"sub-lead"}}
{"address":"t14","name":"w1","parent":"t13","labels":{"org.role":"worker"}}
env inside a terminal:
HC_TERMINAL_ID=t15
```

## §4. `hc server restart`

`hc update` restarts an older running core in the same way ("terminals keep
running", `hc --skill`). I did not run `hc update`, because it replaces the
installed binary.

```text
$ hc server restart --json
{"core":{…},"live":4,…,"version":"0.1.17"}

{"address":"t11","name":"lead","parent":null,"labels":{"org.note":"two words; a=b:c","org.role":"lead"}}
{"address":"t12","name":"boss","parent":null,"labels":{"org.profile":"self-tagged"}}
{"address":"t13","name":"sub","parent":"t12","labels":{"org.role":"sub-lead"}}
{"address":"t14","name":"w1","parent":"t13","labels":{"org.role":"worker"}}
```

## §5. `hc server stop` + start, without `--keep`

```text
$ hc server stop --json
{"stopped":true}
$ hc server start --json
{"core":{…},"finished":5,"live":0,…}

{"address":"t11","name":"lead","state":"finished","parent":null}
{"address":"t13","name":"sub","state":"finished","parent":"t12"}
{"address":"t11","name":"lead","state":"finished","reason":"server_stop","labels":{"org.note":"two words; a=b:c","org.role":"lead"}}
```

## §6. `hc server stop` + start, with `--keep`

```text
$ hc run --bg --json --keep --name kept --label org.role=lead --label org.profile=poteto -- sh -c 'sleep 600'
{"address":"t16","name":"kept"}
{"stopped":true}
{"address":"t16","name":"kept","state":"live","keep":true,"argv":["sh","-c","sleep 600"],"labels":{"org.profile":"poteto","org.role":"lead"}}
```

The program is replaced by a shell, and the labels stay. So a kept terminal
can keep `org.profile` after its agent is gone. See the design's risks.

## §7. Label events

`hc events --json` ran in the background during §1 to §3. The first line is
the snapshot. Each change follows as one JSON-RPC notification:

```text
{"channel":null,"seq":47,"terminals":[]}
{"jsonrpc":"2.0","method":"event","params":{"data":{"labels":{"org.note":"two words; a=b:c","org.profile":"poteto","org.role":"lead"}},"seq":49,"terminal":"t11","type":"labels"}}
```

`jq -c '.params | {type,seq,terminal}'` over the capture:

```text
{"type":"created","seq":48,"terminal":"t11"}
{"type":"labels","seq":49,"terminal":"t11"}
{"type":"labels","seq":50,"terminal":"t11"}
{"type":"created","seq":51,"terminal":"t12"}
{"type":"foreground","seq":52,"terminal":"t11"}
{"type":"foreground","seq":53,"terminal":"t12"}
{"type":"labels","seq":54,"terminal":"t12"}
{"type":"created","seq":55,"terminal":"t13"}
{"type":"created","seq":56,"terminal":"t14"}
```

A `labels` event carries the full new map, not a diff. The schema's list
of types is created, lost, restarted, keep, finished, removed, status,
turn, title, labels, size, doc. `foreground` also appears in the stream. A `heartbeat`
comes every 15 s. A subscriber that falls behind gets `missed` and a fresh
snapshot.

## §8. Environment through `hc run`

```text
$ HC_PROFILE=poteto hc run -- sh -c 'echo profile=$HC_PROFILE'
profile=
```

A parent cannot hand a value to a child through its own environment. It
must go in the child's argv (`env X=… cmd`, or a launcher) or in a label.

## §9. Mod API (`~/.config/herdr-app/herdr.d.ts`, `AGENTS.md`)

- `terminals()`: "Every core terminal as `hc ls --json` describes it
  (address, argv, name, template, parent, labels, state, ...), with
  `status` as a plain word, the agent's report in `report`, and `program`.
  Live." The existing mods read `k.labels?.["herdr.space"]` and `k.parent`
  from it.
- `render(cx)` "runs again after `cx.notify()` and whenever Herdr's live
  data changes (spaces, agents, terminals, focus, theme, shared state).
  Don't poll those."
- `agents()[i].app` is the OSC 7501 `app` ("claude-code", "pi", "codex").
- `shared(key)` / `setShared(key, v)` is persisted state that every mod sees.
  Setting it re-renders all mods.
- `openOverlay({mod, kind: "popup", props})` opens a popup. The sort menu
  already uses it.
- gpui-kit has unstyled `InputState` + `Input` for a search field.
- `herdr-app status` shows layout, focus and errors only. It does not
  expose a mod's rendered output.

That a label change re-renders a mod is documented, but I did not observe
it in the window. F7 covers it.

## §10. `herdr-app check`

```text
$ herdr-app check mods/nested-agents
Check passed: mods/nested-agents

$ herdr-app check probe-mod --print-spec     # renders terminals().length and agents().length
div
  text "n=0 first=[] agents=0"
check passed: …/probe-mod
```

`check` cannot load fixture data. Data-dependent rendering needs its own
harness (design §Testing).

## Limits found

- A Unix socket path is at most 103 bytes. The scratch core failed under the
  session's long scratch path ("the socket path for session "orgtest" is too
  long here (186 bytes; this system allows 103)"). Tests must put their core
  under a short directory.
- `hc ls --json` omits labels (§1).
- `check` renders with empty data (§10).
