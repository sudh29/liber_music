import { MusicPlayerView } from "@/views/MusicPlayerView";

/**
 * Keyboard shortcut handler interface
 */
export interface KeyboardShortcutHandler {
	/** Cleans up and removes all keyboard event listeners */
	cleanup: () => void;
}

/**
 * Registers keyboard shortcuts for the music player view:
 * - Space: toggle play/pause
 * - ArrowUp: previous track
 * - ArrowDown: next track
 * - ArrowLeft: seek backward 5s
 * - ArrowRight: seek forward 5s
 * - Ctrl + ArrowLeft: seek backward 15s
 * - Ctrl + ArrowRight: seek forward 15s
 * 
 * Shortcuts are only handled when:
 * 1. View is mounted and connected to DOM
 * 2. View is currently active
 * 3. Focus is not within an input or textarea
 * 
 * @param view MusicPlayerView instance
 * @returns KeyboardShortcutHandler with cleanup method
 */
export function setupKeyboardShortcuts(view: MusicPlayerView): KeyboardShortcutHandler {
	const handleKeyDown = (e: KeyboardEvent) => {
		if (!view.containerEl || !view.containerEl.isConnected) {
			return;
		}

		const app = view.plugin.app;
		const activeLeaf = app.workspace.getActiveViewOfType(MusicPlayerView);
		if (!activeLeaf || activeLeaf !== view) {
			return;
		}

		const target = e.target as HTMLElement;
		if (
			target.tagName === "INPUT" ||
			target.tagName === "TEXTAREA" ||
			target.isContentEditable ||
			target.closest("input") ||
			target.closest("textarea")
		) {
			return;
		}

		// Space: Play / Pause
		if (e.code === "Space" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			void view.togglePlay();
			return;
		}

		// ArrowUp: Previous track
		if (e.code === "ArrowUp" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			void view.playPrevious();
			return;
		}

		// ArrowDown: Next track
		if (e.code === "ArrowDown" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			void view.playNext();
			return;
		}

		// ArrowLeft: Seek backward 5s
		if (e.code === "ArrowLeft" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			view.seekBackward(5);
			return;
		}

		// ArrowRight: Seek forward 5s
		if (e.code === "ArrowRight" && !e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			view.seekForward(5);
			return;
		}

		// Ctrl + ArrowLeft: Seek backward 15s
		if (e.code === "ArrowLeft" && e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			view.seekBackward(15);
			return;
		}

		// Ctrl + ArrowRight: Seek forward 15s
		if (e.code === "ArrowRight" && e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			view.seekForward(15);
			return;
		}
	};

	window.addEventListener("keydown", handleKeyDown, true);

	return {
		cleanup: () => {
			window.removeEventListener("keydown", handleKeyDown, true);
		},
	};
}
