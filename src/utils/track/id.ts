/**
 * Track ID utility module
 * 
 * Provides stable track ID generation and management helpers.
 */

/**
 * Generates a stable track ID based on file path hash.
 * 
 * @param filePath - File path in vault
 * @returns Track ID (16-character hexadecimal string)
 */
export function generateTrackId(filePath: string): string {
	let hash = 0;
	for (let i = 0; i < filePath.length; i++) {
		const char = filePath.charCodeAt(i);
		hash = ((hash << 5) - hash) + char;
		hash = hash & hash; // Convert to 32-bit integer
	}
	
	const positiveHash = Math.abs(hash);
	return positiveHash.toString(16).padStart(16, '0');
}

/**
 * Retrieves existing track ID or generates and registers a new one.
 * 
 * @param filePath - File path
 * @param settings - Plugin settings object
 * @returns Track ID
 */
export function getOrCreateTrackId(
	filePath: string,
	settings: { trackIndex: Record<string, string> }
): string {
	for (const [trackId, path] of Object.entries(settings.trackIndex)) {
		if (path === filePath) {
			return trackId;
		}
	}
	
	const trackId = generateTrackId(filePath);
	settings.trackIndex[trackId] = filePath;
	return trackId;
}

/**
 * Resolves file path from track ID.
 * 
 * @param trackId - Track ID
 * @param settings - Plugin settings object
 * @returns File path, or null if ID does not exist
 */
export function getTrackPath(
	trackId: string,
	settings: { trackIndex: Record<string, string> }
): string | null {
	return settings.trackIndex[trackId] || null;
}

/**
 * Checks whether track ID exists in trackIndex.
 * 
 * @param trackId - Track ID
 * @param settings - Plugin settings object
 * @returns True if ID is registered
 */
export function isValidTrackId(
	trackId: string,
	settings: { trackIndex: Record<string, string> }
): boolean {
	return trackId in settings.trackIndex;
}
