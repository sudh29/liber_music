/**
 * Page state management hook
 * 
 * Manages page-specific state such as lastAction (for PlayPage disc animations).
 */

import * as React from "react";

export interface UsePageStateReturn {
	/** lastAction state for PlayPage animations */
	lastAction: "next" | "prev" | null;
	/** Handles previous track action with flag */
	handlePrevWithFlag: (onPrev: () => void) => void;
	/** Handles next track action with flag */
	handleNextWithFlag: (onNext: () => void) => void;
	/** Clears lastAction flag (used on direct song selection) */
	clearLastAction: () => void;
}

/**
 * Page state management hook
 * 
 * @returns Page state and action handlers
 */
export function usePageState(): UsePageStateReturn {
	const [lastAction, setLastAction] = React.useState<"next" | "prev" | null>(null);

	const handlePrevWithFlag = React.useCallback(
		(onPrev: () => void) => {
			setLastAction("prev");
			onPrev();
		},
		[]
	);

	const handleNextWithFlag = React.useCallback(
		(onNext: () => void) => {
			setLastAction("next");
			onNext();
		},
		[]
	);

	const clearLastAction = React.useCallback(() => {
		setLastAction(null);
	}, []);

	return {
		lastAction,
		handlePrevWithFlag,
		handleNextWithFlag,
		clearLastAction,
	};
}
