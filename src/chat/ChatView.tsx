import { ChatMessageItem } from "@/components/ChatMessage";
import { ErrorBanner } from "@/components/ErrorBanner";
import { MessageInput } from "@/components/MessageInput";
import { StatusBar } from "@/components/StatusBar";
import type { ToolPhase } from "@/hooks/usePiStream";
import type { ChatMessage, ModelInfo } from "@/types";
import { useCallback, useEffect, useRef, useState } from "react";

export type StreamStateStatus = "idle" | "thinking" | "tool_call" | "responding" | "error";

interface ChatViewProps {
	messages: ChatMessage[];
	streamingMessage: ChatMessage | null;
	isRunning: boolean;
	status: StreamStateStatus;
	error: string | null;
	onSend: (text: string) => void;
	onAbort: () => void;
	onRetry?: () => void;
	models?: ModelInfo[];
	currentModelId?: string;
	onModelSelect?: (provider: string, modelId: string) => void;
	toolPhase?: ToolPhase | null;
}

export function ChatView({
	messages,
	streamingMessage,
	isRunning,
	status,
	error,
	onSend,
	onAbort,
	onRetry,
	models,
	currentModelId,
	onModelSelect,
	toolPhase,
}: ChatViewProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<{ focus: () => void }>(null);
	const isUserScrolledUp = useRef(false);
	const [detailsExpanded, setDetailsExpanded] = useState(false);

	// Ctrl+O toggles expanded detail view (thinking, tool calls)
	useEffect(() => {
		function handleKeyDown(e: KeyboardEvent) {
			if (e.ctrlKey && e.key === "o") {
				e.preventDefault();
				setDetailsExpanded((prev) => !prev);
			}
		}
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	const handleScroll = useCallback(() => {
		const container = scrollContainerRef.current;
		if (!container) return;
		const { scrollTop, scrollHeight, clientHeight } = container;
		isUserScrolledUp.current = scrollHeight - scrollTop - clientHeight > 100;
	}, []);

	// Build a stable key from tool call state so scroll fires on tool changes too
	const toolCallsKey =
		streamingMessage?.toolCalls
			?.map(
				(tc) => `${tc.id}:${tc.status}:${tc.partialOutput?.length ?? 0}:${tc.result?.length ?? 0}`,
			)
			.join("|") ?? "";

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll on any content change including tools
	useEffect(() => {
		if (!isUserScrolledUp.current && messagesEndRef.current) {
			// Use instant scroll for streaming to avoid jitter from queued smooth animations
			messagesEndRef.current.scrollIntoView({ behavior: "auto" });
		}
	}, [
		messages.length,
		streamingMessage?.content.length,
		streamingMessage?.thinking?.length,
		toolCallsKey,
	]);

	const allMessages = streamingMessage ? [...messages, streamingMessage] : messages;
	const isEmpty = messages.length === 0 && !streamingMessage;

	return (
		<>
			<div
				ref={scrollContainerRef}
				onScroll={handleScroll}
				className="flex-1 overflow-y-auto"
				style={{ scrollbarGutter: "stable" }}
			>
				{isEmpty ? (
					<div className="flex flex-col items-center justify-center h-full gap-5 px-8">
						<div className="text-4xl font-bold" style={{ color: "hsl(var(--primary))" }}>
							✦
						</div>
						<h1 className="text-2xl font-semibold" style={{ color: "hsl(var(--foreground))" }}>
							What are you working on?
						</h1>
						<p
							className="text-sm max-w-md text-center"
							style={{ color: "hsl(var(--muted-foreground))" }}
						>
							Type a message to start chatting with Zosma Cowork.
						</p>
					</div>
				) : (
					<div className="pb-4">
						{allMessages.map((msg) => (
							<ChatMessageItem key={msg.id} message={msg} detailsExpanded={detailsExpanded} />
						))}
						<div ref={messagesEndRef} />
					</div>
				)}
			</div>

			{error && <ErrorBanner error={error} onRetry={onRetry} onSwitchModel={onRetry} />}

			<StatusBar
				isRunning={isRunning}
				status={status}
				streamingMessage={streamingMessage}
				toolPhase={toolPhase}
				onAbort={onAbort}
			/>

			<MessageInput
				ref={inputRef}
				onSend={onSend}
				disabled={isRunning}
				models={models}
				currentModelId={currentModelId}
				onModelSelect={onModelSelect}
			/>
		</>
	);
}
