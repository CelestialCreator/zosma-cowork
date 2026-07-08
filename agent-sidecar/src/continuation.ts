/**
 * Helpers for detecting and recovering from mid-workflow narration stops.
 *
 * Some models (e.g. DeepSeek V4 Flash) emit a text-only response
 * ("Now let me write...", "Let me draft...") instead of calling the next
 * tool. Pi's agent loop exits on any non-tool response, so the task appears
 * done when it isn't. The continuation loop in runPromptTask uses these
 * helpers to detect the pattern and re-prompt up to MAX_CONTINUATIONS times.
 *
 * All functions are pure and dependency-free so they can be unit-tested
 * without spinning up the full sidecar.
 */

/** Maximum number of automatic re-prompts per original user turn. */
export const MAX_CONTINUATIONS = 3;

/**
 * The re-prompt text sent when a narration stop is detected.
 * Kept minimal and neutral so it doesn't add new constraints to the task.
 */
export const CONTINUATION_MSG = "Continue.";

/**
 * Returns the last assistant message in the session's message list,
 * or null if the session shape is unexpected or no assistant message exists.
 */
export function lastAssistantMessage(session: unknown): unknown | null {
	const msgs = (session as any)?.agent?.state?.messages;
	if (!Array.isArray(msgs)) return null;
	for (let i = msgs.length - 1; i >= 0; i--) {
		if ((msgs[i] as any)?.role === "assistant") return msgs[i];
	}
	return null;
}

/**
 * Returns true when `msg` is an assistant message that stopped with
 * text-only content — i.e. the model narrated instead of calling a tool.
 *
 * Conditions:
 *   - stopReason === "stop"  (not "toolUse", "aborted", or "error")
 *   - content is non-empty
 *   - every content block is "text" or "thinking" (no "toolCall")
 */
export function isTextOnlyStop(msg: unknown): boolean {
	const m = msg as any;
	if (!m || typeof m !== "object") return false;
	if (m.stopReason !== "stop") return false;
	if (!Array.isArray(m.content) || m.content.length === 0) return false;
	return m.content.every(
		(block: any) => block?.type === "text" || block?.type === "thinking",
	);
}

/**
 * Returns true when the session contains at least one assistant message
 * with a "toolCall" content block — indicating we are mid-workflow rather
 * than in a pure conversational turn.
 *
 * Without this guard, any text reply (even a finished, correct answer)
 * would trigger a spurious continuation.
 */
export function sessionHasToolCalls(session: unknown): boolean {
	const msgs = (session as any)?.agent?.state?.messages;
	if (!Array.isArray(msgs)) return false;
	return msgs.some(
		(m: any) =>
			m?.role === "assistant" &&
			Array.isArray(m.content) &&
			m.content.some((block: any) => block?.type === "toolCall"),
	);
}

/** Stop reasons that represent a *clean* end of turn (not an abort/error). */
const CLEAN_STOPS = new Set(["stop", "toolUse", "length"]);

/**
 * Returns true when `msg` is an assistant message that ended a turn cleanly
 * but produced nothing usable — no visible text and no tool call. This is the
 * #329 idx-2 "empty content" symptom: the model hit a stop with an empty (or
 * thinking-only) body instead of answering or calling the next tool, so the
 * turn ended silently and the user is left typing "Continue".
 *
 * Aborted / error stops are excluded: those are surfaced as errors elsewhere
 * and must not be silently re-prompted.
 */
export function isEmptyStop(msg: unknown): boolean {
	const m = msg as any;
	if (!m || typeof m !== "object" || m.role !== "assistant") return false;
	if (!CLEAN_STOPS.has(m.stopReason)) return false;
	if (!Array.isArray(m.content)) return false;
	const hasText = m.content.some(
		(b: any) => b?.type === "text" && typeof b.text === "string" && b.text.trim().length > 0,
	);
	const hasToolCall = m.content.some((b: any) => b?.type === "toolCall");
	return !hasText && !hasToolCall;
}

/** Collect every toolCallId that already has a `toolResult` message. */
function resolvedToolCallIds(session: unknown): Set<string> {
	const msgs = (session as any)?.agent?.state?.messages;
	const ids = new Set<string>();
	if (Array.isArray(msgs)) {
		for (const m of msgs) {
			if ((m as any)?.role === "toolResult" && (m as any).toolCallId) {
				ids.add((m as any).toolCallId);
			}
		}
	}
	return ids;
}

/**
 * Returns true when the last assistant message is a `toolUse` turn whose tool
 * calls have ALL already produced results, yet no follow-up summary turn was
 * produced. This is the #329 idx-2 root shape: the bridge truncated pi's
 * internal tool loop, so `session.prompt()` returned sitting on the toolUse
 * message even though the tools completed. A single re-prompt lets the model
 * emit the summary it owed.
 *
 * Crucially this requires *every* tool call to have a matching result: if a
 * result is still missing (the idx-10 truncated-batch shape), re-prompting
 * would append to a malformed, dangling-tool-call conversation and likely be
 * rejected by the provider — so we deliberately do NOT continue there. That
 * case is handled by marking the orphaned tool calls as errored in the UI
 * reducer (see usePiStream STREAM_COMPLETE/ABORT_STREAM).
 */
export function isUnfinishedToolUse(session: unknown): boolean {
	const last = lastAssistantMessage(session) as any;
	if (!last || last.stopReason !== "toolUse" || !Array.isArray(last.content)) return false;
	const calls = last.content.filter((b: any) => b?.type === "toolCall");
	if (calls.length === 0) return false;
	const resolved = resolvedToolCallIds(session);
	return calls.every((c: any) => typeof c.id === "string" && resolved.has(c.id));
}

/**
 * Returns true when a continuation should be attempted. We only ever continue
 * mid-workflow (at least one tool call exists), and only when the turn ended
 * in one of the recoverable "stopped short" shapes:
 *   - text-only narration           (#325 — "Now let me write…")
 *   - clean stop with empty content  (#329 idx-2 alt)
 *   - toolUse with all results in    (#329 idx-2 — tools ran, no summary)
 *
 * Aborted/error stops and truncated (dangling) tool batches are intentionally
 * excluded — they are handled by the error path / UI reducer, not by silently
 * re-prompting.
 */
export function shouldContinue(session: unknown): boolean {
	if (!sessionHasToolCalls(session)) return false;
	const last = lastAssistantMessage(session);
	return isTextOnlyStop(last) || isEmptyStop(last) || isUnfinishedToolUse(session);
}
