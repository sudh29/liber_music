/**
 * Resolves the highlight end time for each character/word based on all timestamps in the line:
 * Picks the next timestamp strictly greater than the character's start time from the tag stream,
 * without using the next line's time.
 */
export function resolveCharEndTimes(
	chars: ReadonlyArray<{ time: number }>,
	lineTimeStamps?: ReadonlyArray<number>
): number[] {
	const stamps =
		lineTimeStamps && lineTimeStamps.length > 0
			? [...new Set(lineTimeStamps)].sort((a, b) => a - b)
			: null;

	return chars.map((charData, i) => {
		const t0 = charData.time;
		if (stamps) {
			const nextStamp = stamps.find((t) => t > t0);
			if (nextStamp !== undefined) {
				return nextStamp;
			}
		}
		const rest = chars.slice(i + 1);
		const next = rest.find((c) => c.time > t0);
		if (next !== undefined) {
			return next.time;
		}
		return t0 + 0.12;
	});
}

/**
 * Linear fill progress (0 - 1) mapped across real time interval [t0, t1].
 */
export function linearFillProgress(
	currentTime: number,
	t0: number,
	t1: number
): number {
	if (currentTime <= t0) return 0;
	if (currentTime >= t1) return 1;
	const gap = t1 - t0;
	if (gap <= 0) return 1;
	return (currentTime - t0) / gap;
}
