/**
 * Cross-platform clipboard utility
 * 
 * Safely copies text to the system clipboard across desktop, Android WebView, and iOS WebKit.
 * Falls back to legacy document.execCommand('copy') when navigator.clipboard is unavailable
 * or blocked by WebView permissions.
 */

interface LegacyClipboardDocument {
	execCommand(commandId: string): boolean;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
	if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
		try {
			await navigator.clipboard.writeText(text);
			return true;
		} catch {
			// Fall through to execCommand fallback if modern API throws (e.g. unfocused/permission)
		}
	}

	if (typeof document !== "undefined") {
		try {
			const textArea = createEl("textarea", { cls: "music-clipboard-hidden" });
			textArea.value = text;
			textArea.setAttribute("readonly", "");
			document.body.appendChild(textArea);
			textArea.select();
			const legacyDoc = document as unknown as LegacyClipboardDocument;
			const successful = typeof legacyDoc.execCommand === "function"
				? legacyDoc.execCommand("copy")
				: false;
			textArea.remove();
			return Boolean(successful);
		} catch {
			return false;
		}
	}

	return false;
}

