import { Brain, ChevronRight } from "lucide-react";
import { useState } from "react";

interface ThinkingBlockProps {
	thinking: string;
	isThinking?: boolean;
	expanded?: boolean;
}

export function ThinkingBlock({
	thinking,
	isThinking,
	expanded: expandedProp,
}: ThinkingBlockProps) {
	const [localExpanded, setLocalExpanded] = useState(false);
	// Controlled by global Ctrl+O toggle via expanded prop
	const expanded = expandedProp !== undefined ? expandedProp : localExpanded;

	if (!thinking && !isThinking) return null;

	return (
		<div className="mb-1">
			<button
				type="button"
				onClick={() => setLocalExpanded(!localExpanded)}
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
				{!expanded && thinking && (
					<span className="text-[10px] opacity-40 ml-1">· Ctrl+O to expand</span>
				)}
			</button>
			{expanded && (
				<div className="mt-0.5 pl-4 text-[11px] whitespace-pre-wrap opacity-70 leading-relaxed">
					{thinking || "..."}
				</div>
			)}
		</div>
	);
}
