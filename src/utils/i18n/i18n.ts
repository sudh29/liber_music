// i18n.ts
// Internationalization utility functions.
import en from "@/locales/en.json";

/**
 * Locale dictionary mappings.
 */
const locales: Record<string, Record<string, string>> = {
	en,
};

/**
 * Get translation text by key.
 * @param key Translation key
 * @returns Translated text, or the key itself if not found
 */
export function t(key: string): string {
	return locales["en"]?.[key] || key;
}

/**
 * Get translated text with parameters replaced.
 * @param key Translation key
 * @param params Parameters object
 * @returns Translated text with replaced parameters
 */
export function tWithParams(key: string, params: Record<string, string | number>): string {
	let text = t(key);
	Object.entries(params).forEach(([paramKey, paramValue]) => {
		text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
	});
	return text;
}
