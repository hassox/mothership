const agent = (address, app, status, more = {}) => ({
  address, state: "live", status, report: { app, state: status }, labels: {},
  program: { key: app, name: app, agent: true }, cwd: "/repo", ...more,
});

export const lead = agent("t1", "claude-code", "working", { name: "prime", labels: { "org.role": "lead", "org.profile": "poteto", "herdr.space": "s1" } });
export const subLead = agent("t2", "codex", "idle", { name: "review", parent: "t1", labels: { "org.role": "sub-lead", "org.profile": "reviewer" } });
export const uiWorker = agent("t3", "pi", "blocked", { name: "r-ui", parent: "t2", labels: { "org.role": "worker", "org.profile": "poteto" }, cwd: "/repo/ui" });
export const apiWorker = agent("t4", "pi", "working", { name: "r-api", parent: "t2", labels: { "org.role": "worker" }, cwd: "/repo/api" });
export const notes = agent("t5", "claude-code", "idle", { name: "notes", parent: "t1", labels: undefined, cwd: "/repo/notes" });
export const lone = agent("t6", "claude-code", "idle", { name: "scratch", labels: { "org.profile": "poteto" } });
export const shell = { address: "t7", state: "live", status: null, labels: {}, program: { key: "shell", name: "zsh", shell: true }, cwd: "/repo" };
export const gone = agent("t8", "pi", "idle", { name: "old", parent: "t1", state: "finished", labels: { "org.role": "worker" } });
export const remoteLead = agent("vps/t2", "claude-code", "idle", { name: "far", labels: { "herdr.space": "s9" } });
export const remoteKid = agent("vps/t3", "pi", "done", { name: "far-kid", parent: "t2", labels: { "org.role": "two words" }, report: undefined });

export const all = [lead, subLead, uiWorker, apiWorker, notes, lone, shell, gone, remoteLead, remoteKid];
