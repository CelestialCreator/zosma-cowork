# Continuation Over-Fire Guard Implementation Plan

> **REQUIRED SUB-SKILL:** Use the executing-plans skill to implement this plan task-by-task.

**Goal:** Stop the auto-continuation loop from re-prompting `"Continue."` on tasks that are already genuinely finished, while preserving its recovery behaviour for real mid-workflow stops (#325, #329).

**Architecture:** Two independent, layered guards in `agent-sidecar/src/continuation.ts` + the loop in `agent-sidecar/src/index.ts`. **Layer 1 (progress guard, mandatory):** the loop only keeps going while each re-prompt actually advances the workflow (produces a *new* tool call); the moment a continuation makes no progress, stop. This bounds waste to at most one spurious re-prompt. **Layer 2 (completion gate, recommended):** gate only the `isTextOnlyStop` branch of `shouldContinue` behind a conservative "does this narration look unfinished?" heuristic, so a genuine final answer never triggers even the first re-prompt. The `isEmptyStop` and `isUnfinishedToolUse` branches are unambiguous incompleteness signals and stay ungated.

**Tech Stack:** TypeScript, Vitest (`agent-sidecar/vitest.config.ts`). All new logic is pure functions unit-tested without the sidecar.

---

## Background — why it over-fires

Current `shouldContinue` (continuation.ts:149):

```ts
export function shouldContinue(session: unknown): boolean {
	if (!sessionHasToolCalls(session)) return false;
	const last = lastAssistantMessage(session);
	return isTextOnlyStop(last) || isEmptyStop(last) || isUnfinishedToolUse(session);
}
```

A **genuinely completed** tool-using task ends with a final text answer:
`isTextOnlyStop(last) === true` **and** `sessionHasToolCalls(session) === true`
(true forever once any tool ran) → `shouldContinue` returns `true`.

The loop (index.ts:2040-2053) then sends `"Continue."`. The model replies with
more text ("The task is complete…") — another text-only stop, no new tool call —
so `shouldContinue` stays `true` and it loops to `MAX_CONTINUATIONS` (3),
appending up to 3 spurious `Continue.` exchanges to **every** completed
tool-using conversation.

**Two structurally identical shapes, different intent:** a mid-workflow
narration ("Now let me write the file…") and a final answer ("Here are your
projects.") are both text-only stops after tool calls. There is no reliable
*structural* signal to tell them apart — hence Layer 2 is a heuristic and is
fail-safe (when unsure, continue), with Layer 1 bounding the cost.

---

## Task 1: `countToolCalls` — count tool-call blocks across a session

**TDD scenario:** New feature — full TDD cycle.

**Files:**
- Modify: `agent-sidecar/src/continuation.ts` (add exported helper near `sessionHasToolCalls`, ~line 63)
- Test: `agent-sidecar/src/continuation.test.ts`

**Step 1: Write the failing test**

Add to `continuation.test.ts` (import `countToolCalls` in the top import block alongside the existing names):

```ts
// ─── countToolCalls (progress guard, #325 over-fire) ─────────────────────────

describe("countToolCalls", () => {
	it("returns 0 for an empty or malformed session", () => {
		expect(countToolCalls(makeSession([]))).toBe(0);
		expect(countToolCalls(null)).toBe(0);
		expect(countToolCalls({})).toBe(0);
	});

	it("counts toolCall blocks across all assistant messages", () => {
		const session = makeSession([
			userMsg(),
			assistantToolUse(["a", "b"]),
			toolResult("a"),
			toolResult("b"),
			assistantWithToolCall(), // one more toolCall block
		]);
		expect(countToolCalls(session)).toBe(3);
	});

	it("ignores toolResult messages (they are not tool calls)", () => {
		const session = makeSession([userMsg(), toolResult("x"), toolResult("y")]);
		expect(countToolCalls(session)).toBe(0);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd agent-sidecar && npx vitest run src/continuation.test.ts -t countToolCalls`
Expected: FAIL — `countToolCalls is not a function` / import undefined.

**Step 3: Write minimal implementation**

Add to `continuation.ts` (place directly after `sessionHasToolCalls`):

```ts
/**
 * Count every `toolCall` content block across all assistant messages in the
 * session. Used by the continuation loop's progress guard: if a `"Continue."`
 * re-prompt does not increase this count, the model made no forward progress
 * and we must stop re-prompting (#325 over-fire).
 */
export function countToolCalls(session: unknown): number {
	const msgs = (session as any)?.agent?.state?.messages;
	if (!Array.isArray(msgs)) return 0;
	let n = 0;
	for (const m of msgs) {
		if ((m as any)?.role === "assistant" && Array.isArray((m as any).content)) {
			for (const block of (m as any).content) {
				if (block?.type === "toolCall") n++;
			}
		}
	}
	return n;
}
```

**Step 4: Run test to verify it passes**

Run: `cd agent-sidecar && npx vitest run src/continuation.test.ts -t countToolCalls`
Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add agent-sidecar/src/continuation.ts agent-sidecar/src/continuation.test.ts
git commit -m "feat(sidecar): add countToolCalls helper for continuation progress guard (#325)"
```

---

## Task 2: Progress guard in the continuation loop

**TDD scenario:** Modifying tested code — the loop lives inside `main()` and is
not directly unit-testable, so the *decision* is expressed through the pure
`countToolCalls` helper (already tested in Task 1). We verify the loop edit by
reasoning + the full sidecar suite; no new unit test is added for the `while`
body itself (it would require mocking `activeSession.prompt`, out of scope).

**Files:**
- Modify: `agent-sidecar/src/index.ts:2033-2056`

**Step 1: Replace the continuation loop**

Replace the block starting at `// Continuation loop —` (index.ts:2035) through
the closing `}` of the `if (continuations > 0)` log (index.ts:2056) with:

```ts
			// Continuation loop — recovers from models that stop mid-workflow
			// (narration instead of the next tool, empty stop, or a truncated
			// tool loop) — see continuation.ts. Fires only when: shouldContinue
			// matches, at least one prior tool call exists, and no abort was
			// signalled (#325, #329).
			//
			// Progress guard (#325 over-fire): a genuinely finished task is a
			// text-only stop after tool calls, which shouldContinue cannot
			// structurally distinguish from a real mid-workflow narration. To
			// avoid re-prompting a completed task 3× we stop the moment a
			// "Continue." re-prompt fails to add a NEW tool call — i.e. the
			// model just talked instead of doing more work, so it is done.
			let continuations = 0;
			while (
				continuations < MAX_CONTINUATIONS &&
				!abortFired &&
				shouldContinue(activeSession)
			) {
				const toolCallsBefore = countToolCalls(activeSession);
				log(
					"prompt: model stopped mid-workflow — auto-continuing (%d/%d)",
					continuations + 1,
					MAX_CONTINUATIONS,
				);
				await activeSession.prompt(CONTINUATION_MSG);
				continuations++;
				if (countToolCalls(activeSession) === toolCallsBefore) {
					// No new tool call → the re-prompt produced only text. The
					// model is finished; stop before burning more turns.
					log("prompt: continuation made no progress — stopping");
					break;
				}
			}
			if (continuations > 0) {
				log("prompt: auto-continuation complete after %d re-prompt(s)", continuations);
			}
```

**Step 2: Update the import**

Change index.ts:192 from:

```ts
import { CONTINUATION_MSG, MAX_CONTINUATIONS, shouldContinue } from "./continuation.js";
```

to:

```ts
import {
	CONTINUATION_MSG,
	countToolCalls,
	MAX_CONTINUATIONS,
	shouldContinue,
} from "./continuation.js";
```

**Step 3: Verify it compiles and the suite is green**

Run: `cd agent-sidecar && npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

**Step 4: Commit**

```bash
git add agent-sidecar/src/index.ts
git commit -m "fix(sidecar): stop auto-continuation once a re-prompt makes no progress (#325)"
```

---

## Task 3: `looksIncompleteNarration` — conservative "unfinished" heuristic

**TDD scenario:** New feature — full TDD cycle.

> **RECOMMENDED, OPTIONAL.** Layer 2 eliminates even the *first* spurious
> re-prompt. It is a text heuristic, so it is fail-safe: when the text does not
> clearly look finished, it returns `true` (continue), preserving #325/#329
> behaviour. If the team prefers zero heuristics, skip Tasks 3-4 and ship
> Layer 1 only (waste is already bounded to one self-correcting re-prompt).

**Files:**
- Modify: `agent-sidecar/src/continuation.ts`
- Test: `agent-sidecar/src/continuation.test.ts`

**Step 1: Write the failing test**

```ts
// ─── looksIncompleteNarration (Layer 2 completion gate, #325 over-fire) ──────

describe("looksIncompleteNarration", () => {
	const say = (text: string) => ({
		role: "assistant",
		stopReason: "stop",
		content: [{ type: "text", text }],
	});

	it("is true for action-intent narration that promises more work", () => {
		expect(looksIncompleteNarration(say("Now let me write the file."))).toBe(true);
		expect(looksIncompleteNarration(say("I'll now run the tests"))).toBe(true);
		expect(looksIncompleteNarration(say("Next, I need to check the config"))).toBe(true);
	});

	it("is true when the text trails off (ellipsis or colon)", () => {
		expect(looksIncompleteNarration(say("Fetching the latest changes…"))).toBe(true);
		expect(looksIncompleteNarration(say("Here is the plan:"))).toBe(true);
	});

	it("is false for a conclusive final answer", () => {
		expect(looksIncompleteNarration(say("Here are your projects: foo and bar."))).toBe(false);
		expect(looksIncompleteNarration(say("Done. The build passes and the fix is committed."))).toBe(
			false,
		);
	});

	it("is true (fail-safe) for empty / non-text messages", () => {
		expect(looksIncompleteNarration({ role: "assistant", stopReason: "stop", content: [] })).toBe(
			true,
		);
		expect(looksIncompleteNarration(null)).toBe(true);
	});
});
```

Add `looksIncompleteNarration` to the import block at the top of the test file.

**Step 2: Run test to verify it fails**

Run: `cd agent-sidecar && npx vitest run src/continuation.test.ts -t looksIncompleteNarration`
Expected: FAIL — not a function.

**Step 3: Write minimal implementation**

Add to `continuation.ts` (after `isTextOnlyStop`):

```ts
/** Phrases signalling the model intends to keep working (not conclude). */
const INTENT_PATTERNS = [
	/\blet me\b/i,
	/\blet's\b/i,
	/\bi'?ll (now|go|start|run|write|create|check|look|add|update|fix)\b/i,
	/\bi'?m going to\b/i,
	/\bi need to\b/i,
	/\bi will now\b/i,
	/\bnow (let me|i|i'?ll)\b/i,
	/\bnext,?\s/i,
	/\b(first|then),?\s/i,
];

/**
 * Concatenate the visible text of an assistant message's text blocks.
 * Returns "" when there is no usable text.
 */
function assistantText(msg: unknown): string {
	const m = msg as any;
	if (!m || !Array.isArray(m.content)) return "";
	return m.content
		.filter((b: any) => b?.type === "text" && typeof b.text === "string")
		.map((b: any) => b.text)
		.join(" ")
		.trim();
}

/**
 * Heuristic: does this text-only stop look like the model paused MID-workflow
 * (owing more work) rather than delivering a final answer? Fail-safe — when in
 * doubt it returns true so we never regress the #325/#329 recovery. It returns
 * false only when the text is clearly conclusive (has real content, ends in
 * terminal punctuation, and shows no action-intent phrasing).
 */
export function looksIncompleteNarration(msg: unknown): boolean {
	const text = assistantText(msg);
	if (text.length === 0) return true; // nothing said → definitely not "done"
	if (/[…:]$/.test(text)) return true; // trails off / introduces a list
	if (INTENT_PATTERNS.some((re) => re.test(text))) return true;
	// Looks like a wrapped-up answer: has content and ends conclusively.
	const endsConclusively = /[.!?)"'`\]]$/.test(text);
	return !endsConclusively;
}
```

**Step 4: Run test to verify it passes**

Run: `cd agent-sidecar && npx vitest run src/continuation.test.ts -t looksIncompleteNarration`
Expected: PASS (4 tests).

**Step 5: Commit**

```bash
git add agent-sidecar/src/continuation.ts agent-sidecar/src/continuation.test.ts
git commit -m "feat(sidecar): add looksIncompleteNarration completion-gate heuristic (#325)"
```

---

## Task 4: Gate the text-only-stop branch of `shouldContinue`

**TDD scenario:** Modifying tested code — run existing `shouldContinue` tests
first (they must stay green), then add coverage for the new gating.

**Files:**
- Modify: `agent-sidecar/src/continuation.ts:149` (`shouldContinue`)
- Test: `agent-sidecar/src/continuation.test.ts`

**Step 1: Confirm existing tests are green**

Run: `cd agent-sidecar && npx vitest run src/continuation.test.ts -t shouldContinue`
Expected: PASS (existing cases, incl. "fires on text-only narration mid-workflow"
which uses "Let me write that for you…" → still matches intent).

**Step 2: Write the failing test**

Add inside the existing `describe("shouldContinue", …)` block:

```ts
	it("does NOT fire when the final text is a conclusive answer (#325 over-fire)", () => {
		const session = makeSession([
			userMsg(),
			assistantWithToolCall(),
			toolResult("x"),
			{
				role: "assistant",
				stopReason: "stop",
				content: [{ type: "text", text: "Here are your projects: foo and bar." }],
			},
		]);
		expect(shouldContinue(session)).toBe(false);
	});

	it("still fires on empty-content and unfinished-toolUse regardless of narration text", () => {
		const empty = makeSession([userMsg(), assistantWithToolCall(), toolResult("x"), assistantEmptyStop()]);
		const unfinished = makeSession([userMsg(), assistantToolUse(["call_1"]), toolResult("call_1")]);
		expect(shouldContinue(empty)).toBe(true);
		expect(shouldContinue(unfinished)).toBe(true);
	});
```

**Step 3: Run test to verify it fails**

Run: `cd agent-sidecar && npx vitest run src/continuation.test.ts -t shouldContinue`
Expected: FAIL on "does NOT fire when the final text is a conclusive answer"
(currently returns `true`).

**Step 4: Update `shouldContinue`**

Replace the body at continuation.ts:149 with:

```ts
export function shouldContinue(session: unknown): boolean {
	if (!sessionHasToolCalls(session)) return false;
	const last = lastAssistantMessage(session);
	// Text-only stop is ambiguous (narration vs finished answer) — gate it on
	// the completion heuristic. Empty-content and unfinished-toolUse are
	// unambiguous incompleteness, so they fire unconditionally.
	if (isTextOnlyStop(last)) return looksIncompleteNarration(last);
	return isEmptyStop(last) || isUnfinishedToolUse(session);
}
```

**Step 5: Run test to verify it passes**

Run: `cd agent-sidecar && npx vitest run src/continuation.test.ts`
Expected: PASS (all continuation tests, existing + new).

**Step 6: Commit**

```bash
git add agent-sidecar/src/continuation.ts agent-sidecar/src/continuation.test.ts
git commit -m "fix(sidecar): gate text-only continuation behind completion heuristic (#325)"
```

---

## Task 5: Full validation across both packages

**TDD scenario:** Trivial change — verification only.

**Files:** none (verification).

**Step 1: Sidecar typecheck + tests**

Run: `cd agent-sidecar && npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

**Step 2: Frontend/root lint + typecheck + tests**

Run: `cd /home/zosma/Documents/akshay/code/zosma-cowork && npx biome check agent-sidecar/src/continuation.ts agent-sidecar/src/continuation.test.ts && npx tsc --noEmit && npx vitest run`
Expected: biome clean; tsc exit 0; all frontend tests pass.

> Note: root `pnpm run validate` also runs `lint:styles` (UI token guardrail),
> which is irrelevant here but harmless. Running the two commands above is
> sufficient for a sidecar-only change.

**Step 3: Commit (only if biome reformatted anything)**

```bash
git add -A
git commit -m "chore(sidecar): formatting after continuation over-fire guard"
```

---

## Design notes & trade-offs

- **Layer 1 is mandatory and robust.** Even if Layer 2's heuristic
  mis-classifies, Layer 1 caps waste at one self-correcting re-prompt.
- **Layer 2 is fail-safe toward recovery.** `looksIncompleteNarration` returns
  `true` whenever the text is empty, trails off, shows action-intent, or does
  not end conclusively. The only suppression is a text-only stop that clearly
  reads as a finished answer. Worst case of a false negative (a real
  mid-workflow narration phrased like a conclusion) → the user types "Continue"
  once, i.e. the pre-#325 behaviour — never worse.
- **Untouched:** the `isEmptyStop` / `isUnfinishedToolUse` branches (#329) — those
  are unambiguous incompleteness and must always continue.
- **Out of scope:** the opencode-go bridge stream truncation itself (pi SDK, not
  this repo).
