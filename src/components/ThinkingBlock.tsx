import { Brain, ChevronRight } from "lucide-react";
import { useState } from "react";

interface ThinkingBlockProps {
	thinking: string;
	isThinking?: boolean;
}

export function ThinkingBlock({ thinking, isThinking }: ThinkingBlockProps) {
	const [expanded, setExpanded] = useState(false);

	if (!thinking && !isThinking) return null;

	return (
		<div className="mb-1">
			<button
				type="button"
				onClick={() => setExpanded(!expanded)}
				className="flex items-center gap-1 text-[11px] opacity-60 hover:opacity-90 transition-opacity"
			>
				<ChevronRight
					className="w-3 h-3 flex-shrink-0 transition-transform"
					style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
				/>
				<Brain className="w-3 h-3 flex-shrink-0" />
				<span>
					{isThinking ? "Thinking" : "Thoughts"}
					{thinking && ` · ${thinking.length} chars`}
				</span>
			</button>
			{expanded && (
				<div className="mt-0.5 pl-4 text-[11px] whitespace-pre-wrap opacity-70 leading-relaxed">
					{thinking || "..."}
				</div>
			)}
		</div>
	);
}
