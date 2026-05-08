/**
 * ToolCallTimeline — Rich tool execution display inspired by pi's TUI.
 *
 * Each tool call renders as a padded block with:
 *   - Colored left accent bar (amber=running, green=done, red=error)
 *   - Rich per-tool call summary (read path, bash command, edit diff, etc.)
 *   - Expandable result with diff highlighting for edit/write
 *   - Partial output streaming while running
 *   - Proper padding on all 4 sides
 */

import { cn } from "@/lib/utils";
import type { ToolCallInfo } from "@/types";
import {
	AlertCircle,
	Check,
	ChevronsUpDown,
	FolderSearch,
	GitCompare,
	Loader2,
	Terminal,
	FileText,
	Pencil,
	FilePlus,
	Search,
	FolderOpen,
	type LucideIcon,
} from "lucide-react";
import { useState } from "react";

// ─── Main timeline component ────────────────────────────────────────

interface ToolCallTimelineProps {
	toolCalls: ToolCallInfo[];
	defaultExpanded?: boolean;
	isLatest?: boolean;
}

export function ToolCallTimeline({
	toolCalls,
	defaultExpanded = false,
	isLatest,
}: ToolCallTimelineProps) {
	if (toolCalls.length === 0) return null;

	return (
		<div className="my-2 flex flex-col gap-1 animate-fade-in">
			{toolCalls.map((tc, idx) => (
				<ToolCallBlock
					key={tc.id}
					toolCall={tc}
					defaultExpanded={
						defaultExpanded || (isLatest && idx === toolCalls.length - 1)
					}
				/>
			))}
		</div>
	);
}

// ─── Single tool call block ──────────────────────────────────────────

interface ToolCallBlockProps {
	toolCall: ToolCallInfo;
	defaultExpanded?: boolean;
}

function ToolCallBlock({ toolCall, defaultExpanded }: ToolCallBlockProps) {
	const [expanded, setExpanded] = useState(defaultExpanded ?? false);

	const isRunning = toolCall.status === "running";
	const isCompleted = toolCall.status === "completed";
	const isError = toolCall.status === "error";

	// Resolve border/bg colors based on status
	const accentColor = isRunning
		? "hsl(var(--tool-running-fg))"
		: isError
			? "hsl(var(--tool-error-fg))"
			: "hsl(var(--tool-complete-fg))";

	const bgColor = isRunning
		? "hsl(var(--tool-running-bg))"
		: isError
			? "hsl(var(--tool-error-bg))"
			: "hsl(var(--tool-complete-bg))";

	const borderColor = isRunning
		? "hsl(var(--tool-running-border))"
		: isError
			? "hsl(var(--tool-error-border))"
			: "hsl(var(--tool-complete-border))";

	const { icon: ToolIcon, label, summary } = getToolCallDisplay(toolCall);

	return (
		<div
			className={cn(
				"rounded-md border overflow-hidden transition-colors duration-200",
				isRunning && "animate-subtle-pulse",
			)}
			style={{
				background: bgColor,
				borderColor,
			}}
		>
			{/* Header row */}
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-2 w-full text-left px-3 py-2 hover:opacity-90 transition-opacity"
			>
				{/* Status indicator */}
				<span className="flex-shrink-0 flex items-center justify-center w-4 h-4">
					{isRunning ? (
						<Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: accentColor }} />
					) : isCompleted ? (
						<Check className="w-3.5 h-3.5" style={{ color: accentColor }} />
					) : (
						<AlertCircle className="w-3.5 h-3.5" style={{ color: accentColor }} />
					)}
				</span>

				{/* Tool icon */}
				<ToolIcon className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />

				{/* Tool label + summary */}
				<span className="flex-1 min-w-0">
					<span className="text-xs font-mono font-semibold" style={{ color: accentColor }}>
						{label}
					</span>
					{summary && (
						<span className="text-xs text-muted-foreground ml-1.5 truncate">{summary}</span>
					)}
				</span>

				{/* Status badge for running */}
				{isRunning && (
					<span
						className="text-[10px] px-1.5 py-0 rounded-sm font-medium flex-shrink-0"
						style={{
							background: "hsl(var(--tool-running-border))",
							color: "hsl(var(--tool-running-fg))",
						}}
					>
						running
					</span>
				)}

				{/* Expand/collapse chevron */}
				<ChevronsUpDown className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />
			</button>

			{/* Partial output while running */}
			{isRunning && toolCall.partialOutput && (
				<div className="px-3 pb-2">
					<pre
						className="text-[11px] font-mono leading-relaxed overflow-x-auto max-h-24 overflow-y-auto opacity-60"
						style={{ color: "hsl(var(--foreground))" }}
					>
						{truncateText(toolCall.partialOutput, 500)}
					</pre>
				</div>
			)}

			{/* Expanded detail */}
			{expanded && (
				<div className="px-3 pb-3 pt-1 border-t" style={{ borderColor }}>
					{/* Arguments */}
					{Object.keys(toolCall.args).length > 0 && (
						<div className="mt-1.5">
							<div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 font-medium">
								Input
							</div>
							<pre
								className="text-[11px] text-foreground overflow-x-auto font-mono leading-relaxed rounded p-2"
								style={{ background: "hsl(var(--muted) / 0.5)" }}
							>
								{formatArgs(toolCall.args)}
							</pre>
						</div>
					)}

					{/* Result */}
					{toolCall.result !== undefined && toolCall.result !== "" && (
						<div className="mt-2">
							<div
								className={cn(
									"text-[10px] uppercase tracking-wider mb-1 font-medium",
									isError ? "text-destructive" : "text-muted-foreground",
								)}
							>
								{isError ? "Error" : "Result"}
							</div>
							<ResultDisplay
								result={toolCall.result}
								toolName={toolCall.name}
								details={toolCall.details}
								isError={isError}
							/>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Result display with diff awareness ─────────────────────────────

interface ResultDisplayProps {
	result: string;
	toolName: string;
	details?: Record<string, unknown>;
	isError: boolean;
}

function ResultDisplay({ result, toolName, details: _details, isError }: ResultDisplayProps) {
	// Check if this is a diff result (from edit tool)
	if (!isError && (toolName === "edit" || toolName === "write") && hasDiffContent(result)) {
		return <DiffDisplay diffText={result} />;
	}

	return (
		<pre
			className={cn(
				"text-[11px] whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto font-mono leading-relaxed rounded p-2",
			)}
			style={{
				background: isError ? "hsl(var(--error-subtle))" : "hsl(var(--success-subtle))",
				color: isError ? "hsl(var(--destructive))" : "hsl(var(--foreground))",
			}}
		>
			{truncateText(result, 3000)}
		</pre>
	);
}

// ─── Diff display component ─────────────────────────────────────────

function DiffDisplay({ diffText }: { diffText: string }) {
	const lines = diffText.split("\n");

	return (
		<div
			className="rounded overflow-hidden text-[11px] font-mono leading-relaxed"
			style={{ background: "hsl(var(--muted) / 0.3)" }}
		>
			{lines.map((line, i) => {
				let lineStyle: React.CSSProperties = {
					padding: "0 0.5rem",
					minHeight: "1.4em",
				};

				if (line.startsWith("+++ ") || line.startsWith("--- ")) {
					lineStyle = {
						...lineStyle,
						color: "hsl(var(--diff-hunk-fg))",
						fontWeight: 600,
					};
				} else if (line.startsWith("@@")) {
					lineStyle = {
						...lineStyle,
						color: "hsl(var(--diff-hunk-fg))",
						background: "hsl(var(--diff-hunk-fg) / 0.06)",
					};
				} else if (line.startsWith("+")) {
					lineStyle = {
						...lineStyle,
						color: "hsl(var(--diff-added-fg))",
						background: "hsl(var(--diff-added-bg))",
					};
				} else if (line.startsWith("-")) {
					lineStyle = {
						...lineStyle,
						color: "hsl(var(--diff-removed-fg))",
						background: "hsl(var(--diff-removed-bg))",
					};
				} else {
					lineStyle = {
						...lineStyle,
						color: "hsl(var(--diff-context-fg))",
					};
				}

				return (
					<div key={`${i}-${line.slice(0, 20)}`} style={lineStyle}>
						{line || " "}
					</div>
				);
			})}
		</div>
	);
}

// ─── Tool-specific call display ─────────────────────────────────────

interface ToolCallDisplay {
	icon: LucideIcon;
	label: string;
	summary: string;
}

function getToolCallDisplay(tc: ToolCallInfo): ToolCallDisplay {
	const args = tc.args;

	switch (tc.name) {
		case "read": {
			const path = shortenPath(str(args.path) || str(args.file_path) || "");
			const offset = num(args.offset);
			const limit = num(args.limit);
			let suffix = "";
			if (offset || limit) {
				const from = offset ?? 1;
				const to = limit ? from + limit - 1 : undefined;
				suffix = to ? `:${from}-${to}` : `:${from}`;
			}
			return {
				icon: FileText,
				label: "read",
				summary: path + suffix,
			};
		}

		case "edit": {
			const path = shortenPath(str(args.path) || str(args.file_path) || "");
			const edits = Array.isArray(args.edits) ? args.edits : [];
			const lineCount = edits.reduce(
				(sum: number, e: Record<string, unknown>) =>
					sum + lineCountStr(str(e.newText) || ""),
				0,
			);
			return {
				icon: Pencil,
				label: "edit",
				summary: `${path} (${lineCount} line${lineCount !== 1 ? "s" : ""})`,
			};
		}

		case "write": {
			const path = shortenPath(str(args.path) || str(args.file_path) || "");
			const content = str(args.content) || "";
			const lc = lineCountStr(content);
			const size = formatSize(new Blob([content]).size);
			return {
				icon: FilePlus,
				label: "write",
				summary: `${path} (${lc} lines · ${size})`,
			};
		}

		case "bash": {
			const cmd = str(args.command) || "";
			const display = cmd.length > 60 ? `${cmd.slice(0, 57)}...` : cmd;
			return {
				icon: Terminal,
				label: "bash",
				summary: `$ ${display}`,
			};
		}

		case "grep": {
			const pattern = str(args.pattern) || "";
			const scope = shortenPath(str(args.path) || ".");
			const glob = str(args.glob);
			return {
				icon: Search,
				label: "grep",
				summary: `/${pattern}/ in ${scope}${glob ? ` (${glob})` : ""}`,
			};
		}

		case "find": {
			const pattern = str(args.pattern) || "";
			const scope = shortenPath(str(args.path) || ".");
			return {
				icon: FolderSearch,
				label: "find",
				summary: `${pattern} in ${scope}`,
			};
		}

		case "ls": {
			const path = shortenPath(str(args.path) || ".");
			return {
				icon: FolderOpen,
				label: "ls",
				summary: path,
			};
		}

		case "web_search":
		case "code_search":
		case "fetch_content":
		case "web_fetch": {
			return {
				icon: Search,
				label: tc.name,
				summary: str(args.query) || str(args.url) || (Array.isArray(args.queries) ? (args.queries as string[]).join(", ") : "") || "",
			};
		}

		default: {
			// Generic display for unknown tools
			return {
				icon: GitCompare,
				label: tc.name,
				summary: Object.keys(args).length > 0
					? Object.keys(args).slice(0, 3).join(", ")
					: "",
			};
		}
	}
}

// ─── ToolCallSummary (for message header) ────────────────────────────

export function ToolCallSummary({ toolCalls }: { toolCalls: ToolCallInfo[] }) {
	const running = toolCalls.filter((tc) => tc.status === "running").length;
	const completed = toolCalls.filter((tc) => tc.status === "completed").length;
	const errors = toolCalls.filter((tc) => tc.status === "error").length;

	const parts: string[] = [];
	if (completed > 0) parts.push(`${completed} done`);
	if (running > 0) parts.push(`${running} running`);
	if (errors > 0) parts.push(`${errors} failed`);

	return (
		<span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
			<span className="text-muted-foreground/60">●</span>
			{toolCalls.length} tool{toolCalls.length !== 1 ? "s" : ""}
			{parts.length > 0 && (
				<>
					<span className="text-muted-foreground/40">·</span>
					{parts.join(" · ")}
				</>
			)}
		</span>
	);
}

// ─── Helpers ─────────────────────────────────────────────────────────

function str(value: unknown): string | undefined {
	if (typeof value === "string") return value;
	return undefined;
}

function num(value: unknown): number | undefined {
	if (typeof value === "number" && Number.isFinite(value)) return value;
	return undefined;
}

function shortenPath(path: string): string {
	if (!path) return "...";
	return path
		.replace(/^\/home\/[^/]+\//, "~/")
		.replace(/^\/Users\/[^/]+\//, "~/")
		.replace(/^C:\\Users\\[^/\\]+\\/, "~/");
}

function lineCountStr(text: string): number {
	if (!text) return 0;
	return text.split("\n").length;
}

function formatArgs(args: Record<string, unknown>): string {
	// For display, simplify common patterns
	const display: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(args)) {
		if (typeof v === "string" && v.length > 200) {
			display[k] = `${v.slice(0, 200)}... (${v.length} chars)`;
		} else {
			display[k] = v;
		}
	}
	try {
		return JSON.stringify(display, null, 2);
	} catch {
		return String(args);
	}
}

function truncateText(text: string, maxLen: number): string {
	if (text.length <= maxLen) return text;
	return `${text.slice(0, maxLen)}\n... (truncated)`;
}

function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function hasDiffContent(text: string): boolean {
	// Check if result looks like a unified diff
	return (
		text.includes("\n+") ||
		text.includes("\n-") ||
		text.includes("@@ ") ||
		text.includes("+++ ") ||
		text.includes("--- ")
	);
}
