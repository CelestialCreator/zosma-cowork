# One-Shot Cron Task Fix (#328) Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Fix zosma-cowork #328 so a fired one-shot cron task never silently vanishes — it is removed from the task list only *after* a successful run, failures are retained + surfaced, and every fire produces a visible Tasks→Activity entry.

**Architecture:** The scheduler lives in the Cowork-owned fork `zosmaai/pi-routines` (vendored into the sidecar, gitignored, pinned by `agent-sidecar/vendor.lock.json`). The bug (`fireTask()` removes a one-shot *before* the async run resolves) is fixed there; Cowork adds no-model surfacing + interrupted-run reconciliation in its own committed layer. Fired runs continue to surface in the Tasks→Activity timeline (per product decision — NOT injected into chat).

**Workflow (IMPORTANT — order of operations):** implement BOTH phases **locally**, vendor the sidecar from the **fork commit** (not a released tag), **build + verify on the throwaway VM with screenshots**, and ONLY once it works end-to-end do we cut the `v0.1.2` tag, open the PRs (fork→`zosmaai` upstream + `zosma-cowork`), re-pin to the real tag, and post both PR links to the Discord `#bugs` channel. No releases or PRs until the VM proves the fix.

**Tech Stack:** TypeScript, vitest (both repos), chokidar file-watch scheduler, pi-coding-agent SDK, Tauri + React (Cowork UI).

---

## Background — the two genuine root causes (with auth present)

1. **Isolated-run output not where the user looks (`#300` design).** A fired one-shot runs in a fresh isolated `AgentSession` (`agent-sidecar/src/task-fire.ts`); its transcript goes to `.pi/task_runs/<id>.jsonl` and surfaces only in Tasks→Activity, and the task correctly leaves `cron_list`. A user watching *chat* perceives a silent vanish.
2. **Remove-before-run data loss.** `zosmaai/pi-routines` `cronScheduler.fireTask()` calls `store.removeTask(id)` for one-shots *before* `onFireCallback` resolves. If the run fails, the task is already deleted, leaving only a `failed, response=null` record — no retry.

> **NOT a cause (retracted false positive):** "scheduler doesn't start without auth." Cowork is AI-first; no connected model = nothing runs, by design. The reporter had auth.

## Repos & mechanics

| Layer | Repo / path | Clone |
|---|---|---|
| Scheduler / `fireTask` | `zosmaai/pi-routines` (fork: `CelestialCreator/pi-routines`) | `/home/zosma/Documents/akshay/code/pi-routines` (origin=CelestialCreator, upstream=zosmaai; HEAD `bba6bb97` == `v0.1.1`) |
| `onFireCallback`, `task-fire.ts`, Tasks UI | `zosma-cowork` (this repo) | `/home/zosma/Documents/akshay/code/zosma-cowork` |

- The vendored copy at `zosma-cowork/agent-sidecar/src/vendor/pi-routines/` is **gitignored + regenerated** from the fork on build. Never edit it directly.
- After the fork fix ships as `v0.1.2`, re-pin via `npm run vendor:latest` (or hand-edit `vendor.lock.json`) in zosma-cowork.

## The double-fire trap (design note — read before Task 2)

Naïvely "remove only after success" reintroduces a bug: while the async run is in flight, the one-shot still has a past `nextRunAt`, so the next 1s `tick()` fires it **again** → duplicate runs. Fix with an **in-memory in-flight guard**: `tick()` skips ids currently running; on success remove; on failure keep + push `nextRunAt` forward by a retry delay so retries are bounded (not a 1s hot-loop). Recurring tasks keep advancing `nextRunAt` pre-fire as today (prevents their double-fire).

---

# PHASE 1 — Fork fix (`/home/zosma/Documents/akshay/code/pi-routines`)

### Task 1: Set up the fork working branch + deps

**TDD scenario:** N/A (setup)

**Steps:**
1. `cd /home/zosma/Documents/akshay/code/pi-routines`
2. `git checkout -b fix/oneshot-remove-after-success`
3. `npm ci` (or `npm install` if no lockfile)
4. `npm test` → Expected: existing `src/index.test.ts` passes (baseline green).
5. Commit nothing yet.

---

### Task 2: Failing test — one-shot is retained when the fire fails

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Create: `src/cronScheduler.test.ts`
- Modify: `src/cronScheduler.ts`

**Step 1: Write the failing test**

Create `src/cronScheduler.test.ts`:

```ts
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CronScheduler } from "./cronScheduler.js";
import { CronTaskStore, type ScheduledTask } from "./cronTasks.js";

function tempCwd(): string {
  return mkdtempSync(join(tmpdir(), "cron-test-"));
}

function oneShot(store: CronTaskStore, nextRunAt: string): ScheduledTask {
  const task: ScheduledTask = {
    id: store.generateId(),
    name: "one-shot",
    schedule: "* * * * *",
    prompt: "do the thing",
    type: "durable",
    createdAt: new Date().toISOString(),
    nextRunAt,
    recurring: false,
    maxAgeDays: 0,
  };
  store.addTask(task);
  return task;
}

// Drive fireTask directly (bypass lock/poll timing) for deterministic tests.
function newScheduler(
  cwd: string,
  onFireCallback: CronScheduler["onFireCallback"],
): { sched: CronScheduler; store: CronTaskStore } {
  const store = new CronTaskStore(cwd);
  const sched = new CronScheduler({
    cwd,
    sessionId: "test",
    onFire: () => {},
    onFireCallback,
    lockFilePath: join(cwd, ".pi", "test.lock"),
  });
  return { sched, store: sched.getStore() };
}

describe("CronScheduler.fireTask — remove-after-success", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps a one-shot task when the fire FAILS", async () => {
    const cwd = tempCwd();
    let reject!: () => void;
    const cb = vi.fn(
      () => new Promise<void>((_res, rej) => { reject = () => rej(new Error("boom")); }),
    );
    const { sched, store } = newScheduler(cwd, cb);
    const task = oneShot(store, new Date(Date.now() - 1000).toISOString());

    // @ts-expect-error private access for deterministic unit test
    sched.fireTask(task, new Date());
    reject();
    await Promise.resolve();
    await Promise.resolve();

    expect(store.getTask(task.id)).toBeDefined(); // retained, NOT removed
    const runs = store.getRuns(task.id, 1);
    expect(runs[0]?.status).toBe("failed");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/cronScheduler.test.ts -t "keeps a one-shot"`
Expected: FAIL — task is `undefined` (current code removed it before firing).

**Step 3: Minimal implementation**

In `src/cronScheduler.ts`:

(a) Add the in-flight field after the existing private fields (~line 71, after `private sessionId: string;`):

```ts
  /** Task ids whose fire is currently in flight (prevents 1s double-fire). */
  private inFlight = new Set<string>();
  /** Retry delay applied to a one-shot after a failed fire. */
  private static readonly RETRY_DELAY_MS = 60_000;
```

(b) In `tick()`, skip in-flight tasks — change the loop body top:

```ts
    for (const task of tasks) {
      if (!task.nextRunAt) continue;
      if (this.inFlight.has(task.id)) continue; // skip runs in progress
```

(c) In `fireTask()`, remove the pre-fire one-shot deletion and mark in-flight. Replace:

```ts
    if (task.recurring) {
      // Compute next run
      this.store.refreshNextRun(task.id, now);
    } else {
      // One-shot: remove after firing
      this.store.removeTask(task.id);
    }
```

with:

```ts
    if (task.recurring) {
      // Recurring: advance nextRunAt now so the next tick doesn't re-fire it.
      this.store.refreshNextRun(task.id, now);
    }
    // One-shot: do NOT remove here. Removal happens only after a SUCCESSFUL
    // fire (below). Mark in-flight so the 1s poll doesn't double-fire it.
    this.inFlight.add(task.id);
```

(d) In the `onFireCallback` success handler, remove the one-shot + clear in-flight. Replace the success arm:

```ts
        () => {
          // If the callback didn't update the run status, mark as completed
          const runs = this.store.getRuns(task.id, 1);
          if (runs.length > 0 && runs[0].runId === runId && runs[0].status === "pending") {
            this.store.updateRun(task.id, runId, {
              status: "completed",
              completedAt: new Date().toISOString(),
            });
          }
        },
```

with:

```ts
        () => {
          const runs = this.store.getRuns(task.id, 1);
          if (runs.length > 0 && runs[0].runId === runId && runs[0].status === "pending") {
            this.store.updateRun(task.id, runId, {
              status: "completed",
              completedAt: new Date().toISOString(),
            });
          }
          if (!task.recurring) this.store.removeTask(task.id); // remove ONLY on success
          this.inFlight.delete(task.id);
        },
```

(e) In the `onFireCallback` failure handler, keep the task + bounded retry + clear in-flight. Replace the failure arm:

```ts
        (err) => {
          console.error(`[pi-routines] onFireCallback failed for task ${task.id}:`, err);
          this.store.updateRun(task.id, runId, {
            status: "failed",
            completedAt: new Date().toISOString(),
          });
        },
```

with:

```ts
        (err) => {
          console.error(`[pi-routines] onFireCallback failed for task ${task.id}:`, err);
          this.store.updateRun(task.id, runId, {
            status: "failed",
            completedAt: new Date().toISOString(),
          });
          if (!task.recurring) {
            // Keep the one-shot; retry after a bounded delay (not a 1s hot-loop).
            this.store.updateTask(task.id, {
              nextRunAt: new Date(Date.now() + CronScheduler.RETRY_DELAY_MS).toISOString(),
            });
          }
          this.inFlight.delete(task.id);
        },
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/cronScheduler.test.ts -t "keeps a one-shot"`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/cronScheduler.ts src/cronScheduler.test.ts
git commit -m "fix(#328): keep one-shot task on failed fire; remove only after success"
```

---

### Task 3: Test — one-shot is removed after a SUCCESSFUL fire

**TDD scenario:** New feature.

**File:** Modify `src/cronScheduler.test.ts`

**Step 1: Add test**

```ts
  it("removes a one-shot task after a SUCCESSFUL fire", async () => {
    const cwd = tempCwd();
    const cb = vi.fn(async (t, store, runId) => {
      store.updateRun(t.id, runId, { status: "completed", completedAt: new Date().toISOString() });
    });
    const { sched, store } = newScheduler(cwd, cb);
    const task = oneShot(store, new Date(Date.now() - 1000).toISOString());

    // @ts-expect-error private
    sched.fireTask(task, new Date());
    await Promise.resolve(); await Promise.resolve();

    expect(store.getTask(task.id)).toBeUndefined(); // removed on success
    expect(store.getRuns(task.id, 1)[0]?.status).toBe("completed");
  });
```

**Step 2: Run** `npx vitest run src/cronScheduler.test.ts` → Expected: PASS (both tests).

**Step 3: Commit**

```bash
git add src/cronScheduler.test.ts
git commit -m "test(#328): one-shot removed after successful fire"
```

---

### Task 4: Test — no double-fire while a run is in flight

**TDD scenario:** New feature (guards the in-flight logic).

**File:** Modify `src/cronScheduler.test.ts`

**Step 1: Add test** (drives `tick()` twice while the callback promise is pending; asserts the callback fired once)

```ts
  it("does not double-fire a one-shot while its run is in flight", async () => {
    const cwd = tempCwd();
    let resolve!: () => void;
    const cb = vi.fn(() => new Promise<void>((r) => { resolve = r; }));
    const { sched, store } = newScheduler(cwd, cb);
    oneShot(store, new Date(Date.now() - 1000).toISOString());

    // @ts-expect-error private
    sched.tick();
    // @ts-expect-error private — second poll while still in flight
    sched.tick();
    expect(cb).toHaveBeenCalledTimes(1);
    resolve();
    await Promise.resolve();
  });
```

> Note: `tick()` early-returns unless `this.lock.getIsOwner()` is true. If the lock isn't owned in the test env, stub it: `vi.spyOn((sched as any).lock, "getIsOwner").mockReturnValue(true);` before calling `tick()`.

**Step 2: Run** `npx vitest run src/cronScheduler.test.ts` → Expected: PASS.

**Step 3: Commit**

```bash
git add src/cronScheduler.test.ts
git commit -m "test(#328): no double-fire while one-shot run in flight"
```

---

### Task 5: Typecheck + full test (LOCAL ONLY — no push, no release yet)

**TDD scenario:** N/A (gate)

**Steps:**
1. `npx tsc --noEmit` → Expected: no errors.
2. `npm test` → Expected: all green (`index.test.ts` + `cronScheduler.test.ts`).
3. Push the branch to your fork remote **so the sidecar can vendor from it during local testing** (the vendor fetch clones from a remote, so the commit must exist on `origin`):
   ```bash
   git push origin fix/oneshot-remove-after-success
   ```
4. Record the fork commit SHA for the local pin: `git rev-parse HEAD` → save as `<FORK_SHA>`.

> Do NOT tag `v0.1.2` or open the upstream PR yet. That happens in Phase 4, after the VM proves the fix.

---

# PHASE 2 — Cowork local vendor override + layer improvements (`zosma-cowork`)

### Task 6: New branch + vendor pi-routines from the FORK COMMIT (local test pin)

**TDD scenario:** N/A (dependency bump — temporary local pin)

**Files:**
- Modify: `agent-sidecar/vendor.lock.json`
- Modify: `agent-sidecar/scripts/fetch-vendor.mjs` (pi-routines entry: repo + pin)

**Steps:**
1. `cd /home/zosma/Documents/akshay/code/zosma-cowork`
2. `git checkout -b fix/328-cron-oneshot`
3. In `agent-sidecar/scripts/fetch-vendor.mjs`, temporarily point the `pi-routines` entry at the fork + commit:
   - `repo: "https://github.com/CelestialCreator/pi-routines.git"`
   - replace `tag: "v0.1.1"` with `commit: "<FORK_SHA>"` (commit-pin path; see the file's tag-vs-commit handling).
4. Re-vendor + verify the fix landed:
   ```bash
   cd agent-sidecar && node scripts/fetch-vendor.mjs
   grep -n "remove ONLY on success" src/vendor/pi-routines/src/cronScheduler.ts   # Expected: match
   ```
5. **Do NOT commit this temporary fork-commit pin as the final state** — it's a local test override. Either keep it uncommitted, or commit on the branch with a `TEMP:` marker to be reverted in Phase 4 Task 13. Note it clearly:
   ```bash
   git add agent-sidecar/vendor.lock.json agent-sidecar/scripts/fetch-vendor.mjs
   git commit -m "TEMP(#328): vendor pi-routines from fork commit for local VM verification"
   ```

---

### Task 7: Failing test — no-model fire records an actionable failure

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Modify: `agent-sidecar/src/task-fire.ts`
- Modify: `agent-sidecar/src/task-fire.test.ts`

**Step 1: Write failing test** (in `task-fire.test.ts`) — when `createSession()` rejects with a no-model error, the run is recorded `failed` with a human-readable reason:

```ts
it("records an actionable failure when no model is available", async () => {
  const updates: Array<Record<string, unknown>> = [];
  const store = { updateRun: (_t: string, _r: string, u: Record<string, unknown>) => { updates.push(u); } };
  await runTaskFire({
    task: { id: "t1", name: "n", prompt: "p" },
    runId: "r1",
    store,
    send: () => {},
    createSession: async () => { throw new Error("No model configured"); },
  });
  const failed = updates.find((u) => u.status === "failed");
  expect(failed).toBeDefined();
  expect(String(failed!.response)).toMatch(/model/i);
});
```

**Step 2: Run** `cd agent-sidecar && npx vitest run src/task-fire.test.ts -t "actionable failure"`
Expected: FAIL — current code sets `response: ""` on session-create failure.

**Step 3: Minimal implementation** — in `task-fire.ts`, the `createSession()` catch block, set an actionable response:

```ts
	} catch (err) {
		const reason = err instanceof Error ? err.message : String(err);
		store.updateRun(task.id, runId, {
			status: "failed",
			completedAt: now().toISOString(),
			response: `Task could not run: ${reason}. Connect an AI model to run scheduled tasks.`,
			conversation: [],
		});
		opts.log?.("task fire could not create session for %s (%s): %s", task.id, task.name, reason);
		return;
	}
```

**Step 4: Run** → Expected: PASS.

**Step 5: Commit**

```bash
git add agent-sidecar/src/task-fire.ts agent-sidecar/src/task-fire.test.ts
git commit -m "feat(#328): surface actionable reason when a task fire cannot start a session"
```

---

### Task 8: Interrupted-run reconciliation on startup

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Modify: `agent-sidecar/src/vendor/pi-routines/...` ❌ (gitignored — do NOT). Instead implement in the fork **or** in a committed Cowork helper.
- Decision: implement as a committed Cowork helper `agent-sidecar/src/task-reconcile.ts` invoked at sidecar startup, scanning `.pi/task_runs/*.jsonl` for `pending|running` older than a threshold and flipping them to `failed (interrupted)`.
- Create: `agent-sidecar/src/task-reconcile.ts`
- Create: `agent-sidecar/src/task-reconcile.test.ts`
- Modify: `agent-sidecar/src/index.ts` (call it once after `retargetTasksWatcher`/workspace resolve).

**Step 1: Write failing test** — a `running` run with `startedAt` 10 min ago is flipped to `failed`; a fresh `running` (10s ago) is left untouched.

```ts
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reconcileInterruptedRuns } from "./task-reconcile.js";

describe("reconcileInterruptedRuns", () => {
  it("flips stale running runs to failed and leaves fresh ones", () => {
    const ws = mkdtempSync(join(tmpdir(), "recon-"));
    const dir = join(ws, ".pi", "task_runs");
    mkdirSync(dir, { recursive: true });
    const stale = { runId: "a", taskId: "t", prompt: "p", status: "running", startedAt: new Date(Date.now() - 600000).toISOString() };
    const fresh = { runId: "b", taskId: "t", prompt: "p", status: "running", startedAt: new Date(Date.now() - 10000).toISOString() };
    writeFileSync(join(dir, "t.jsonl"), JSON.stringify(stale) + "\n" + JSON.stringify(fresh) + "\n");

    reconcileInterruptedRuns(ws, 120000);

    const lines = readFileSync(join(dir, "t.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    expect(lines.find((r) => r.runId === "a").status).toBe("failed");
    expect(lines.find((r) => r.runId === "b").status).toBe("running");
  });
});
```

**Step 2: Run** `npx vitest run src/task-reconcile.test.ts` → Expected: FAIL (module missing).

**Step 3: Minimal implementation** — `agent-sidecar/src/task-reconcile.ts`:

```ts
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * On startup, any run still marked pending/running is orphaned (the app was
 * closed mid-fire). Flip runs older than `thresholdMs` to failed(interrupted)
 * so the Activity timeline never shows a permanently "running" ghost.
 */
export function reconcileInterruptedRuns(workspaceCwd: string, thresholdMs = 120000): void {
	const dir = join(workspaceCwd, ".pi", "task_runs");
	if (!existsSync(dir)) return;
	const cutoff = Date.now() - thresholdMs;
	for (const f of readdirSync(dir)) {
		if (!f.endsWith(".jsonl")) continue;
		const p = join(dir, f);
		let changed = false;
		const lines = readFileSync(p, "utf8").split("\n").filter(Boolean).map((line) => {
			try {
				const r = JSON.parse(line);
				if ((r.status === "running" || r.status === "pending") && new Date(r.startedAt).getTime() < cutoff) {
					changed = true;
					return JSON.stringify({ ...r, status: "failed", completedAt: new Date().toISOString(), response: r.response ?? "Interrupted: the app closed before this run finished." });
				}
			} catch { /* preserve malformed */ }
			return line;
		});
		if (changed) writeFileSync(p, lines.join("\n") + "\n");
	}
}
```

**Step 4: Wire into `index.ts`** — after `workspaceCwd` is resolved (near `retargetTasksWatcher(workspaceCwd)`), add:

```ts
		reconcileInterruptedRuns(workspaceCwd);
```

and the import at top: `import { reconcileInterruptedRuns } from "./task-reconcile.js";`

**Step 5: Run** `npx vitest run src/task-reconcile.test.ts` → Expected: PASS. Then `npx tsc --noEmit`.

**Step 6: Commit**

```bash
git add agent-sidecar/src/task-reconcile.ts agent-sidecar/src/task-reconcile.test.ts agent-sidecar/src/index.ts
git commit -m "feat(#328): reconcile interrupted task runs to failed on startup"
```

---

### Task 9: Verify failed runs render in the Tasks→Activity UI

**TDD scenario:** Modifying tested code — run existing tests first.

**Files:**
- Read: `src/components/RunHistory.tsx` (already maps `failed` → ✕ / red badge, lines ~154–187).
- Test: `src/components/RunHistory.test.tsx` (create if absent).

**Steps:**
1. Confirm current behavior: `grep -n "failed" src/components/RunHistory.tsx` → red badge exists.
2. If no test exists, add one asserting a `failed` run renders the "Failed" label + response text. (Vitest + React Testing Library per AGENTS.md.)
3. Run: `npm test -- RunHistory` → Expected: PASS.
4. Commit if a test was added.

> YAGNI: no new UI needed — the failed state already renders. This task only locks it with a test.

---

### Task 10: Typecheck, lint, full test suite (Cowork)

**TDD scenario:** N/A (gate)

**Steps:**
1. `cd agent-sidecar && npx tsc --noEmit` → no errors.
2. `cd agent-sidecar && npm test` → all green.
3. Repo root: `npm run typecheck && npm test` (frontend) → all green.
4. `npm run lint` → clean.
5. Commit any fixes.

---

# PHASE 3 — End-to-end verification on the throwaway VM

### Task 11: Rebuild `.deb`, reinstall on VM, re-run the seeded-task repro

**TDD scenario:** N/A (manual verification)

**Steps:**
1. Build the Linux artifact (per repo build docs) and copy the `.deb` into `/home/zosma/vms/linux-throwaway/share/`.
2. On the VM (VNC `127.0.0.1:5901`; close `remote-viewer` first so vncdotool can drive — QEMU VNC is single-client): install the new `.deb`, connect the opencode-go model (deepseek-v4-flash) via the 9p-seeded `models.json`.
3. Reuse `/home/zosma/vms/linux-throwaway/share/make-task.sh` to seed a one-shot due in ~70s.
4. **Expected (authed):** task appears in list → fires → Activity shows `running → completed`; task removed from list only after success.
5. Force a failure (disconnect model / point baseUrl at a dead port) and re-seed: **Expected:** Activity shows `failed` with the actionable reason; task **retained** in the list; retries after ~60s.
6. Capture screenshots to `/home/zosma/vms/linux-throwaway/cron-repro/` (`19-*` success path, `20-*` failure-retained path).
7. **Gate:** do NOT proceed to Phase 4 until the VM shows: success → completed + removed; failure → failed(actionable) + retained + retried.

---

# PHASE 4 — Ship it (only after VM verification passes)

### Task 12: Release `zosmaai/pi-routines` v0.1.2

**Steps:**
1. In the fork clone, open a PR: `CelestialCreator:fix/oneshot-remove-after-success` → `zosmaai/pi-routines:main` (upstream PR). Include the #328 context + test summary.
2. After merge to upstream `main`:
   ```bash
   git checkout main && git pull upstream main
   git tag v0.1.2 && git push upstream v0.1.2
   ```
3. Record the tag SHA: `git rev-list -n1 v0.1.2` → `<V012_SHA>`.

> If upstream merge is delayed, you may tag `v0.1.2` on the fork and pin there as an interim, but the goal is upstream.

### Task 13: Re-pin zosma-cowork to the real `v0.1.2` tag (revert the TEMP pin)

**Files:** `agent-sidecar/scripts/fetch-vendor.mjs`, `agent-sidecar/vendor.lock.json`

**Steps:**
1. Revert the Task 6 TEMP changes: restore `repo: "https://github.com/zosmaai/pi-routines.git"` and set `tag: "v0.1.2"`.
2. `cd agent-sidecar && npm run vendor:latest` (or hand-edit `vendor.lock.json` → `{ "ref": "v0.1.2", "sha": "<V012_SHA>" }` then `node scripts/fetch-vendor.mjs`).
3. Verify: `grep -n "remove ONLY on success" src/vendor/pi-routines/src/cronScheduler.ts` → match.
4. `npx tsc --noEmit && npm test` (sidecar) + repo-root `npm run typecheck && npm test && npm run lint` → all green.
5. Commit:
   ```bash
   git add agent-sidecar/vendor.lock.json agent-sidecar/scripts/fetch-vendor.mjs
   git commit -m "chore(deps): pin vendored pi-routines to v0.1.2 (#328 fireTask fix)"
   ```

### Task 14: Open the zosma-cowork PR

**Steps:**
1. Push: `git push origin fix/328-cron-oneshot` (ensure the branch history no longer contains the TEMP fork-commit pin as its final state — squash/fixup if needed).
2. Open PR against `zosma-cowork` main. Body: link #328, the two root causes, the fix approach, VM screenshots (success + failure paths), and the linked `zosmaai/pi-routines` PR/tag.

### Task 15: Post both PRs to Discord `#bugs`

**Steps:**
1. Reuse the msg-bridge Discord pattern (token at `~/.pi/msg-bridge.json` `.discord.token`; channel `1504133054925508668`; multipart `payload_json=<FILE`; verify with GET). Tag `<@665320206910095370>` (arjun) with `allowed_mentions.users`.
2. Message content: “#328 fixed — PRs up” + both links:
   - `zosmaai/pi-routines` PR (scheduler `fireTask` fix, v0.1.2)
   - `zosma-cowork` PR (re-pin + no-model surfacing + reconciliation)
   - GitHub issue: https://github.com/zosmaai/zosma-cowork/issues/328
3. Attach the success + failure VM screenshots (`19-*`, `20-*`) and, optionally, the fixed-flow diagram HTML.
4. Confirm delivery via `GET /channels/{id}/messages/{msg_id}` (attachments non-empty).

---

## Definition of done

_Order matters: everything local + VM-verified BEFORE any release/PR._

- [ ] Fork `fireTask` fix implemented locally: remove-after-success + in-flight guard + 60s retry; unit tests green (`cronScheduler.test.ts`).
- [ ] Cowork layer implemented locally: actionable no-model failure + interrupted-run reconciliation; tests green.
- [ ] Sidecar temporarily vendored from the **fork commit**; local build succeeds.
- [ ] **VM verified with screenshots**: success → completed + removed from list; failure → failed(actionable) + retained + retried (`19-*`, `20-*`).
- [ ] `zosmaai/pi-routines` `v0.1.2` released (upstream PR merged + tag).
- [ ] zosma-cowork re-pinned to real `v0.1.2` (TEMP fork pin reverted); vendored copy contains the fix; all CI gates pass (typecheck, lint, tests, both repos).
- [ ] Both PRs opened: `zosmaai/pi-routines` + `zosma-cowork` (+ upstream PR).
- [ ] Discord `#bugs` post with both PR links + issue link + screenshots, arjun tagged.

## Out of scope (YAGNI — note in issue, don't build now)

- Chat injection of fired prompts (product decision: runs live in Tasks→Activity).
- GUI "New task" create button (creation stays via `cron_create`).
- Retry backoff policy / max-retries config (fixed 60s retry is enough for #328).
- OS desktop notification on fire (nice-to-have; can be a fast-follow PR2 if desired).
