/**
 * Fisher-Yates smart non-repeating shuffle manager
 * 
 * Manages randomized playback queue ensuring:
 * 1. Zero repeats until every single track in the list has been played once.
 * 2. Going previous navigates back through the actual history of played tracks in the cycle.
 * 3. When the entire deck is exhausted, a new cycle is generated such that the first song
 *    of the new cycle is never the same as the last song played.
 * 4. Manual track selection integrates cleanly: the selected track is placed in history,
 *    and the remaining unplayed pool is shuffled around it.
 */

export class ShuffleManager {
	private unplayedDeck: number[] = [];
	private playedHistory: number[] = [];
	private totalCount: number = 0;

	/**
	 * Initializes or resets the shuffle deck for a given playlist length.
	 *
	 * @param totalTracks - Total number of tracks in current list
	 * @param currentPlayingIndex - Index of currently playing track (optional)
	 */
	initialize(totalTracks: number, currentPlayingIndex: number = -1): void {
		this.totalCount = totalTracks;
		this.playedHistory = [];
		this.unplayedDeck = [];

		if (totalTracks <= 0) {
			return;
		}

		if (currentPlayingIndex >= 0 && currentPlayingIndex < totalTracks) {
			this.playedHistory.push(currentPlayingIndex);
			const remaining = Array.from({ length: totalTracks }, (_, i) => i)
				.filter(i => i !== currentPlayingIndex);
			this.unplayedDeck = this.shuffleArray(remaining);
		} else {
			const all = Array.from({ length: totalTracks }, (_, i) => i);
			this.unplayedDeck = this.shuffleArray(all);
		}
	}

	/**
	 * Resets or reinitializes the shuffle deck.
	 *
	 * @param totalTracks - Total number of tracks (defaults to current totalCount)
	 * @param currentPlayingIndex - Index of currently playing track (optional)
	 */
	reset(totalTracks: number = this.totalCount, currentPlayingIndex: number = -1): void {
		this.initialize(totalTracks, currentPlayingIndex);
	}

	/**
	 * Manually sets the active track (e.g. user clicked a specific song in the library).
	 * Preserves the clicked song in history and removes it from the unplayed pool,
	 * ensuring all remaining unplayed songs are still played before any repeats.
	 *
	 * @param index - Index of track user selected
	 * @param totalTracks - Optional playlist length to auto-sync if changed
	 */
	onTrackSelected(index: number, totalTracks?: number): void {
		if (totalTracks && (this.totalCount !== totalTracks || this.totalCount <= 0)) {
			this.initialize(totalTracks, index);
			return;
		}

		if (this.totalCount <= 0 || index < 0 || index >= this.totalCount) {
			return;
		}

		// If this track is already the current track in history, nothing to change
		if (this.playedHistory[this.playedHistory.length - 1] === index) {
			return;
		}

		// Remove from unplayedDeck if present so it won't repeat
		const deckIdx = this.unplayedDeck.indexOf(index);
		if (deckIdx !== -1) {
			this.unplayedDeck.splice(deckIdx, 1);
		}

		this.playedHistory.push(index);

		// If all tracks have been played, start a new cycle
		if (this.unplayedDeck.length === 0) {
			this.startNewCycle();
		}
	}


	/**
	 * Gets the next track index from the non-repeating shuffle deck.
	 *
	 * @returns Next track index, or null if deck is exhausted (all songs played)
	 */
	getNextTrack(): number | null {
		if (this.totalCount <= 0) return null;

		if (this.unplayedDeck.length === 0) {
			// All tracks in current cycle have been played once
			return null;
		}

		const nextIndex = this.unplayedDeck.shift()!;
		this.playedHistory.push(nextIndex);
		return nextIndex;
	}

	/**
	 * Reshuffles for a new cycle after all tracks have been played.
	 * Guarantees the first track of the new cycle is not the last track played.
	 *
	 * @returns The first track index of the new cycle
	 */
	startNewCycle(): number | null {
		if (this.totalCount <= 0) return null;
		if (this.totalCount === 1) return 0;

		const lastPlayed = this.playedHistory[this.playedHistory.length - 1];
		let all = Array.from({ length: this.totalCount }, (_, i) => i);
		let shuffled = this.shuffleArray(all);

		// If first element of new cycle equals last played, swap it with another index
		if (lastPlayed !== undefined && shuffled[0] === lastPlayed && shuffled.length > 1) {
			const swapIdx = Math.floor(Math.random() * (shuffled.length - 1)) + 1;
			const temp = shuffled[0];
			const targetVal = shuffled[swapIdx];
			if (targetVal !== undefined) {
				shuffled[0] = targetVal;
				shuffled[swapIdx] = temp;
			}
		}

		const firstOfNewCycle = shuffled.shift()!;
		this.playedHistory = [firstOfNewCycle];
		this.unplayedDeck = shuffled;
		return firstOfNewCycle;
	}

	/**
	 * Navigates to the previously played track in the current shuffle history.
	 *
	 * @returns Previous track index, or null if at beginning of history
	 */
	getPreviousTrack(): number | null {
		if (this.playedHistory.length <= 1) {
			return null;
		}

		// Pop current track and restore to front of unplayed deck
		const current = this.playedHistory.pop()!;
		this.unplayedDeck.unshift(current);

		return this.playedHistory[this.playedHistory.length - 1] ?? null;
	}

	/**
	 * Returns total count of tracks in deck.
	 */
	getTotalCount(): number {
		return this.totalCount;
	}

	/**
	 * Returns current remaining unplayed count in deck.
	 */
	getRemainingCount(): number {
		return this.unplayedDeck.length;
	}

	/**
	 * Returns played count in current cycle.
	 */
	getPlayedCount(): number {
		return this.playedHistory.length;
	}

	/**
	 * Modern Fisher-Yates (Knuth) in-place shuffle.
	 */
	private shuffleArray(array: number[]): number[] {
		const result = [...array];
		for (let i = result.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			const temp = result[i]!;
			result[i] = result[j]!;
			result[j] = temp;
		}
		return result;
	}
}
