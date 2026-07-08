import { describe, expect, it } from "vitest";
import {
	CONTINUATION_MSG,
	MAX_CONTINUATIONS,
	isEmptyStop,
	isTextOnlyStop,
	isUnfinishedToolUse,
	lastAssistantMessage,
	sessionHasToolCalls,
	shouldContinue,
} from "./continuation.js";

// ─── helpers to build fake session state ────────────────────────────────────

function makeSession(messages: unknown[]) {
	return { agent: { state: { messages } } };
}

function assistantText(text = "Let me write that for you..."): unknown {
	return {
		role: "assistant",
		stopReason: "stop",
		content: [{ type: "text", text }],
	};
}

function assistantThinkingAndText(): unknown {
	return {
		role: "assistant",
		stopReason: "stop",
		content: [
			{ type: "thinking", thinking: "<think>ok</think>" },
			{ type: "text", text: "Let me proceed." },
		],
	};
}

function assistantWithToolCall(): unknown {
	return {
		role: "assistant",
		stopReason: "toolUse",
		content: [{ type: "toolCall", name: "bash", input: { command: "ls" } }],
	};
}

function assistantTextAndTool(): unknown {
	return {
		role: "assistant",
		stopReason: "stop",
		content: [
			{ type: "text", text: "I will now run ls." },
			{ type: "toolCall", name: "bash", input: { command: "ls" } },
		],
	};
}

function assistantAborted(): unknown {
	return { role: "assistant", stopReason: "aborted", content: [] };
}

/**
 * idx-2 shape (#329): the model requested tools (stopReason "toolUse") but the
 * agent loop returned without ever producing a final summary turn. In pi SDK
 * state the last *assistant* message is this toolUse message; the completed
 * tools are separate `toolResult` messages that follow it.
 */
function assistantToolUse(ids: string[] = ["call_1"]): unknown {
	return {
		role: "assistant",
		stopReason: "toolUse",
		content: ids.map((id) => ({ type: "toolCall", id, name: "bash", arguments: {} })),
	};
}

function toolResult(id: string): unknown {
	return { role: "toolResult", toolCallId: id, toolName: "bash", content: [], isError: false };
}

/** idx-2 alt shape: a clean "stop" that produced no text and no tool call. */
function assistantEmptyStop(): unknown {
	return { role: "assistant", stopReason: "stop", content: [] };
}

/** A thinking-only stop that produced no visible answer and called no tool. */
function assistantThinkingOnly(): unknown {
	return {
		role: "assistant",
		stopReason: "stop",
		content: [{ type: "thinking", thinking: "hmm" }],
	};
}

function assistantError(): unknown {
	return { role: "assistant", stopReason: "error", content: [{ type: "text", text: "oops" }] };
}

function userMsg(text = "do the thing"): unknown {
	return { role: "user", content: [{ type: "text", text }] };
}

// ─── lastAssistantMessage ────────────────────────────────────────────────────

describe("lastAssistantMessage", () => {
	it("returns null for empty messages", () => {
		expect(lastAssistantMessage(makeSession([]))).toBeNull();
	});

	it("returns null when session shape is wrong", () => {
		expect(lastAssistantMessage({})).toBeNull();
		expect(lastAssistantMessage(null)).toBeNull();
	});

	it("returns the last assistant message", () => {
		const last = assistantText("second");
		const session = makeSession([userMsg(), assistantText("first"), userMsg(), last]);
		expect(lastAssistantMessage(session)).toBe(last);
	});

	it("skips user messages at the tail", () => {
		const assistant = assistantText();
		const session = makeSession([assistant, userMsg()]);
		expect(lastAssistantMessage(session)).toBe(assistant);
	});
});

// ─── isTextOnlyStop ──────────────────────────────────────────────────────────

describe("isTextOnlyStop", () => {
	it("returns true for a text-only stop message", () => {
		expect(isTextOnlyStop(assistantText())).toBe(true);
	});

	it("returns true when content is thinking + text", () => {
		expect(isTextOnlyStop(assistantThinkingAndText())).toBe(true);
	});

	it("returns false when stopReason is toolUse", () => {
		expect(isTextOnlyStop(assistantWithToolCall())).toBe(false);
	});

	it("returns false when stopReason is aborted", () => {
		expect(isTextOnlyStop(assistantAborted())).toBe(false);
	});

	it("returns false when stopReason is error", () => {
		expect(isTextOnlyStop(assistantError())).toBe(false);
	});

	it("returns false when content includes a toolCall block", () => {
		expect(isTextOnlyStop(assistantTextAndTool())).toBe(false);
	});

	it("returns false for empty content (nothing to continue)", () => {
		expect(isTextOnlyStop({ role: "assistant", stopReason: "stop", content: [] })).toBe(false);
	});

	it("returns false for null / non-object", () => {
		expect(isTextOnlyStop(null)).toBe(false);
		expect(isTextOnlyStop(undefined)).toBe(false);
	});
});

// ─── sessionHasToolCalls ─────────────────────────────────────────────────────

describe("sessionHasToolCalls", () => {
	it("returns false for empty session", () => {
		expect(sessionHasToolCalls(makeSession([]))).toBe(false);
	});

	it("returns false for pure chat session (text only)", () => {
		const session = makeSession([userMsg(), assistantText()]);
		expect(sessionHasToolCalls(session)).toBe(false);
	});

	it("returns true when a prior assistant message has a toolCall", () => {
		const session = makeSession([userMsg(), assistantWithToolCall(), userMsg(), assistantText()]);
		expect(sessionHasToolCalls(session)).toBe(true);
	});

	it("returns true when the current message has a tool call mixed in", () => {
		const session = makeSession([userMsg(), assistantTextAndTool()]);
		expect(sessionHasToolCalls(session)).toBe(true);
	});

	it("returns false when session shape is wrong", () => {
		expect(sessionHasToolCalls({})).toBe(false);
		expect(sessionHasToolCalls(null)).toBe(false);
	});
});

// ─── isEmptyStop (#329 idx-2 empty content) ──────────────────────────────────

describe("isEmptyStop", () => {
	it("returns true for a clean stop with empty content", () => {
		expect(isEmptyStop(assistantEmptyStop())).toBe(true);
	});

	it("returns true for a thinking-only stop (no visible answer, no tool)", () => {
		expect(isEmptyStop(assistantThinkingOnly())).toBe(true);
	});

	it("returns false when the turn produced visible text", () => {
		expect(isEmptyStop(assistantText())).toBe(false);
	});

	it("returns false when the turn produced a tool call", () => {
		expect(isEmptyStop(assistantToolUse())).toBe(false);
	});

	it("returns false for aborted / error stops (handled elsewhere)", () => {
		expect(isEmptyStop(assistantAborted())).toBe(false);
		expect(isEmptyStop(assistantError())).toBe(false);
	});

	it("returns false for null / non-object", () => {
		expect(isEmptyStop(null)).toBe(false);
		expect(isEmptyStop(undefined)).toBe(false);
	});
});

// ─── isUnfinishedToolUse (#329 idx-2 no-summary) ─────────────────────────────

describe("isUnfinishedToolUse", () => {
	it("returns true when the last assistant msg is a toolUse whose results are all present", () => {
		const session = makeSession([
			userMsg(),
			assistantToolUse(["call_1", "call_2"]),
			toolResult("call_1"),
			toolResult("call_2"),
		]);
		expect(isUnfinishedToolUse(session)).toBe(true);
	});

	it("returns false when a tool result is still missing (truncated batch — idx 10)", () => {
		// Re-prompting here would append to a malformed (dangling tool-call)
		// conversation, so continuation must NOT fire.
		const session = makeSession([
			userMsg(),
			assistantToolUse(["call_1", "call_2"]),
			toolResult("call_1"),
		]);
		expect(isUnfinishedToolUse(session)).toBe(false);
	});

	it("returns false when the last assistant msg is a normal text stop", () => {
		const session = makeSession([userMsg(), assistantWithToolCall(), toolResult("x"), assistantText()]);
		expect(isUnfinishedToolUse(session)).toBe(false);
	});

	it("returns false for an empty session", () => {
		expect(isUnfinishedToolUse(makeSession([]))).toBe(false);
	});
});

// ─── shouldContinue (#329 extended coverage) ─────────────────────────────────

describe("shouldContinue", () => {
	it("fires on text-only narration mid-workflow (#325, unchanged)", () => {
		const session = makeSession([userMsg(), assistantWithToolCall(), toolResult("x"), assistantText()]);
		expect(shouldContinue(session)).toBe(true);
	});

	it("fires on empty-content stop mid-workflow (#329 idx-2 alt)", () => {
		const session = makeSession([userMsg(), assistantWithToolCall(), toolResult("x"), assistantEmptyStop()]);
		expect(shouldContinue(session)).toBe(true);
	});

	it("fires when tools completed but no summary turn was produced (#329 idx-2)", () => {
		const session = makeSession([
			userMsg(),
			assistantToolUse(["call_1"]),
			toolResult("call_1"),
		]);
		expect(shouldContinue(session)).toBe(true);
	});

	it("does NOT fire in a pure chat session (no tool calls anywhere)", () => {
		expect(shouldContinue(makeSession([userMsg(), assistantText()]))).toBe(false);
		expect(shouldContinue(makeSession([userMsg(), assistantEmptyStop()]))).toBe(false);
	});

	it("does NOT fire when a tool result is missing (truncated batch — idx 10)", () => {
		const session = makeSession([userMsg(), assistantToolUse(["call_1", "call_2"]), toolResult("call_1")]);
		expect(shouldContinue(session)).toBe(false);
	});
});

// ─── constants ───────────────────────────────────────────────────────────────

describe("constants", () => {
	it("MAX_CONTINUATIONS is a positive integer", () => {
		expect(Number.isInteger(MAX_CONTINUATIONS)).toBe(true);
		expect(MAX_CONTINUATIONS).toBeGreaterThan(0);
	});

	it("CONTINUATION_MSG is a non-empty string", () => {
		expect(typeof CONTINUATION_MSG).toBe("string");
		expect(CONTINUATION_MSG.trim().length).toBeGreaterThan(0);
	});
});
