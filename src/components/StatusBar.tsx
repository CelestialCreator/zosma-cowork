/**
 * StatusBar — Premium real-time status shown during streaming.
 *
 * Features:
 *   - Elapsed time counter
 *   - Current state label with tool-specific detail (bash $ cmd, read /path, etc.)
 *   - Tool call progress (n/total) with colored indicators
 *   - Animated status dot
 *   - Abort button
 */

import type { ChatMessage } from "@/types";
import type { ToolPhase } from "@/hooks/usePiStream";
import { Loader2, Square } from "lucide-react";
import { useEffect, useState } from "react";

type StreamStateStatus = "idle" | "thinking" | "tool_call" | "responding" | "error";

interface StatusBarProps {
	isRunning: boolean;
	status: StreamStateStatus;
	streamingMessage: ChatMessage | null;
	toolPhase?: ToolPhase | null;
	onAbort: () => void;
}

export function StatusBar({ isRunning, status, streamingMessage, toolPhase, onAbort }: StatusBarProps) {
	const [elapsed, setElapsed] = useState(0);
	const [startTime] = useState(() => Date.now());

	// Elapsed time counter
	useEffect(() => {
		if (!isRunning) {
			setElapsed(0);
			return;
		}
		const tick = () => setElapsed(Math.floor((Date.now() - startTime) / 1000));
		tick();
		const id = setInterval(tick, 1000);
		return () => clearInterval(id);
	}, [isRunning, startTime]);

	if (!isRunning) return null;

	const toolCalls = streamingMessage?.toolCalls || [];
	const completedTools = toolCalls.filter(
		(tc) => tc.status === "completed" || tc.status === "error",
	).length;
	const totalTools = toolCalls.length;

	// Build status label with rich tool detail
	let statusLabel: string;
	let toolDetail = "";

	if (status === "thinking") {
		statusLabel = "Thinking";
	} else if (status === "tool_call") {
		// Use toolPhase for richer display
		if (toolPhase) {
			switch (toolPhase.type) {
				case "calling":
					statusLabel = "Calling";
					toolDetail = getToolSummary(toolPhase.toolName, toolPhase.args);
					break;
				case "executing":
					statusLabel = toolPhase.toolName;
					if (toolPhase.partialOutput) {
						const firstLine = toolPhase.partialOutput.split("\n")[0] || "";
						toolDetail = firstLine.length > 40 ? `${firstLine.slice(0, 37)}...` : firstLine;
					}
					break;
				case "done":
					statusLabel = "Completed";
					toolDetail = toolPhase.toolName;
					break;
				case "error":
					statusLabel = "Error";
					toolDetail = toolPhase.message;
					break;
			}
		} else {
			const runningTool = toolCalls.find((tc) => tc.status === "running");
			statusLabel = runningTool ? runningTool.name : "Running tool";
		}
	} else if (status === "responding") {
		statusLabel = "Writing";
	} else if (status === "error") {
		statusLabel = "Error";
	} else {
		statusLabel = status;
	}

	return (
		<div
			className="flex items-center justify-between px-4 py-2 border-t animate-fade-in"
			style={{
				background: "hsl(var(--status-bg))",
				borderColor: "hsl(var(--status-divider))",
			}}
		>
			<div className="flex items-center gap-2.5 min-w-0">
				{/* Spin icon */}
				<Loader2
					className="w-3.5 h-3.5 animate-spin flex-shrink-0"
					style={{ color: "hsl(var(--status-active-fg))" }}
				/>

				{/* Primary status label */}
				<span className="text-xs font-medium flex-shrink-0" style={{ color: "hsl(var(--status-active-fg))" }}>
					{statusLabel}
				</span>

				{/* Tool detail — the specific command/path */}
				{toolDetail && (
					<span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0 rounded font-mono truncate max-w-[200px]">
						{toolDetail}
					</span>
				)}

				{/* Tool progress dots */}
				{totalTools > 0 && (
					<span className="flex items-center gap-1 flex-shrink-0">
						{toolCalls.map((tc) => (
							<span
								key={tc.id}
								className="inline-block w-1.5 h-1.5 rounded-full"
								style={{
									background:
										tc.status === "running"
											? "hsl(var(--tool-running-fg))"
											: tc.status === "error"
												? "hsl(var(--tool-error-fg))"
												: "hsl(var(--tool-complete-fg))",
									animation: tc.status === "running" ? "pulse-dot 1.5s ease-in-out infinite" : undefined,
								}}
							/>
						))}
						<span className="text-[10px] text-muted-foreground ml-0.5 tabular-nums">
							{completedTools}/{totalTools}
						</span>
					</span>
				)}

				{/* Separator */}
				<span className="text-muted-foreground/30 flex-shrink-0">·</span>

				{/* Elapsed time */}
				<span className="text-[10px] text-muted-foreground/60 tabular-nums font-mono flex-shrink-0">
					{formatElapsed(elapsed)}
				</span>

				{/* Model badge */}
				{streamingMessage?.model && (
					<>
						<span className="text-muted-foreground/30 flex-shrink-0">·</span>
						<span className="text-[10px] text-muted-foreground/50 bg-muted/40 px-1.5 py-0 rounded font-mono flex-shrink-0 truncate max-w-[120px]">
							{streamingMessage.provider}/{streamingMessage.model}
						</span>
					</>
				)}
			</div>

			{/* Abort button */}
			<button
				type="button"
				onClick={onAbort}
				className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
			>
				<Square className="w-3 h-3 fill-current" />
				Stop
			</button>
		</div>
	);
}

/** Build a short summary for a tool call from its args */
function getToolSummary(name: string, args: Record<string, unknown>): string {
	switch (name) {
		case "bash": {
			const cmd = typeof args.command === "string" ? args.command : "";
			return `$ ${cmd.length > 50 ? `${cmd.slice(0, 47)}...` : cmd}`;
		}
		case "read": {
			const p = typeof args.path === "string" ? args.path : "";
			return p.split("/").pop() || p;
		}
		case "edit":
		case "write": {
			const p = typeof args.path === "string" ? args.path : "";
			return p.split("/").pop() || p;
		}
		case "grep": {
			return typeof args.pattern === "string" ? `/${args.pattern}/` : name;
		}
		default:
			return name;
	}
}

function formatElapsed(seconds: number): string {
	if (seconds < 60) return `${seconds}s`;
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}m ${s.toString().padStart(2, "0")}s`;
}
