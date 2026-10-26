/**
 * Buffer Polyfill utility module
 *
 * Provides a Buffer polyfill for mobile environments where Node.js built-ins are absent.
 * Required by music-metadata-browser globally.
 */

import { Buffer } from "buffer-polyfill";

type WindowWithBuffer = Window & { Buffer?: typeof Buffer; activeWindow?: Window };

function ensureBufferOn(win: Window | undefined | null): void {
	if (!win) return;
	const w = win as unknown as WindowWithBuffer;
	if (!w.Buffer) {
		w.Buffer = Buffer;
	}
}

/**
 * Initializes the Buffer polyfill globally across window contexts.
 */
export function initBufferPolyfill(): void {
	if (typeof window === "undefined") return;
	const root = window as unknown as WindowWithBuffer;
	ensureBufferOn(root);
	// Obsidian: may differ from main window when a popout window has focus
	ensureBufferOn(root.activeWindow);
}
