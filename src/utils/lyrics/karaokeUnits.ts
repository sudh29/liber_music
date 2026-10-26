import type { ExtendedLyricChar, ExtendedLyricLine } from "./extendedParser";
import { resolveCharEndTimes } from "./charFillProgress";

/**
 * Karaoke display unit: single character for CJK languages; whole word for Latin text.
 */
export interface KaraokeUnit {
	text: string;
	charTime: number;
	charEndTime: number;
}

function isLatinAlphanumeric(char: string): boolean {
	return char.length === 1 && /[A-Za-z0-9]/.test(char);
}

/**
 * Checks whether the character belongs to the current Latin word segment
 * (alphanumeric, or apostrophe/hyphen sandwiched between alphanumeric characters).
 */
function isLatinWordContinuation(
	chars: ReadonlyArray<ExtendedLyricChar>,
	wordStartIdx: number,
	idx: number
): boolean {
	if (idx < 0 || idx >= chars.length) return false;
	const ch = chars[idx]?.char ?? "";
	if (isLatinAlphanumeric(ch)) return true;
	if (idx > wordStartIdx) {
		const prev = chars[idx - 1]?.char ?? "";
		const next = chars[idx + 1]?.char ?? "";
		if (
			(ch === "'" || ch === "-") &&
			isLatinAlphanumeric(prev) &&
			isLatinAlphanumeric(next)
		) {
			return true;
		}
	}
	return false;
}

/**
 * Merges parsed character array `chars` into display units;
 * end times are determined solely by line `lineTimeStamps` and character start times.
 */
export function buildKaraokeUnits(
	chars: ReadonlyArray<ExtendedLyricChar>,
	line: Pick<ExtendedLyricLine, "lineTimeStamps">
): KaraokeUnit[] {
	if (!chars.length) return [];
	const ends = resolveCharEndTimes(chars, line.lineTimeStamps);
	const units: KaraokeUnit[] = [];
	let i = 0;
	const n = chars.length;
	while (i < n) {
		if (isLatinWordContinuation(chars, i, i)) {
			const start = i;
			let j = i;
			while (j < n && isLatinWordContinuation(chars, start, j)) {
				j++;
			}
			const last = j - 1;
			const text = chars
				.slice(start, j)
				.map((c) => c.char)
				.join("");
			const charTime = chars[start]?.time ?? 0;
			const lastChar = chars[last];
			const charEndTime =
				(last !== undefined ? ends[last] : undefined) ??
				(lastChar?.time ?? charTime) + 0.12;
			units.push({ text, charTime, charEndTime });
			i = j;
		} else {
			const charTime = chars[i]?.time ?? 0;
			const charEndTime = ends[i] ?? (chars[i]?.time ?? charTime) + 0.12;
			units.push({ text: chars[i]?.char ?? "", charTime, charEndTime });
			i++;
		}
	}
	return units;
}
