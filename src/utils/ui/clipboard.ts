/**
 * Cross-platform clipboard utility
 * 
 * Safely copies text to the system clipboard across desktop, Android WebView, and iOS WebKit.
 * Falls back to legacy document.execCommand('copy') when navigator.clipboard is unavailable
 * or blocked by WebView permissions.
 */

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
			const textArea = typeof createEl === "function"
				? createEl("textarea", { cls: "music-clipboard-hidden" })
				: document.createElement("textarea");
			textArea.value = text;
			textArea.setAttribute("readonly", "");
			textArea.className = "music-clipboard-hidden";
			document.body.appendChild(textArea);
			textArea.select();
			const successful = document.execCommand("copy");
			document.body.removeChild(textArea);
			return Boolean(successful);
		} catch {
			return false;
		}
	}

	return false;
}

