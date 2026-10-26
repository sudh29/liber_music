/**
 * Playback control utility functions
 * 
 * Pure functions managing track index navigation, play mode toggling, and track-end transitions.
 */

import type { PlayMode } from "@/main";
import { TFile } from "obsidian";

import type { ShuffleManager } from "./shuffle";

/**
 * Calculates previous track index based on play mode.
 * 
 * @param currentIndex Current track index
 * @param list Track files array
 * @param playMode Active playback mode
 * @param isShuffle Whether non-repeating shuffle is active
 * @param shuffleManager Optional ShuffleManager instance
 * @returns Index of previous track
 */
export function getPreviousIndex(
	currentIndex: number,
	list: TFile[],
	playMode: PlayMode,
	isShuffle: boolean = false,
	shuffleManager?: ShuffleManager
): number {
	if (isShuffle && shuffleManager) {
		const prev = shuffleManager.getPreviousTrack();
		if (prev !== null) return prev;
	}
	if (playMode === "shuffle") {
		return Math.floor(Math.random() * list.length);
	}
	return currentIndex > 0 ? currentIndex - 1 : list.length - 1;
}

/**
 * Calculates next track index based on play mode.
 * 
 * @param currentIndex Current track index
 * @param list Track files array
 * @param playMode Active playback mode
 * @param isShuffle Whether non-repeating shuffle is active
 * @param shuffleManager Optional ShuffleManager instance
 * @returns Index of next track
 */
export function getNextIndex(
	currentIndex: number,
	list: TFile[],
	playMode: PlayMode,
	isShuffle: boolean = false,
	shuffleManager?: ShuffleManager
): number {
	if (isShuffle && shuffleManager) {
		const next = shuffleManager.getNextTrack();
		if (next !== null) return next;
		if (playMode === "repeat-all" || playMode === "shuffle") {
			const cycleFirst = shuffleManager.startNewCycle();
			if (cycleFirst !== null) return cycleFirst;
		}
	}
	if (playMode === "shuffle") {
		return Math.floor(Math.random() * list.length);
	}
	return currentIndex < list.length - 1 ? currentIndex + 1 : 0;
}

/**
 * Determines playback transition when a track reaches end of stream.
 * 
 * @param playMode Active playback mode
 * @param currentIndex Current track index
 * @param list Track files array
 * @param isShuffle Whether non-repeating shuffle is active
 * @param shuffleManager Optional ShuffleManager instance
 * @returns Action flags: shouldPlayNext, shouldRepeat, shouldStop
 */
export function handleTrackEnd(
	playMode: PlayMode,
	currentIndex: number,
	list: TFile[],
	isShuffle: boolean = false,
	shuffleManager?: ShuffleManager
): {
	shouldPlayNext: boolean;
	shouldRepeat: boolean;
	shouldStop: boolean;
} {
	if (playMode === "repeat-one") {
		return { shouldPlayNext: false, shouldRepeat: true, shouldStop: false };
	}
	if (isShuffle && shuffleManager) {
		if (shuffleManager.getRemainingCount() > 0) {
			return { shouldPlayNext: true, shouldRepeat: false, shouldStop: false };
		}
		if (playMode === "repeat-all" || playMode === "shuffle") {
			return { shouldPlayNext: true, shouldRepeat: false, shouldStop: false };
		}
		// When repeat is off and deck is exhausted: stop!
		return { shouldPlayNext: false, shouldRepeat: false, shouldStop: true };
	}
	if (playMode === "repeat-all" || playMode === "shuffle") {
		return { shouldPlayNext: true, shouldRepeat: false, shouldStop: false };
	} else if (playMode === "normal") {
		const isLast = currentIndex >= list.length - 1;
		return { shouldPlayNext: !isLast, shouldRepeat: false, shouldStop: isLast };
	}
	return { shouldPlayNext: false, shouldRepeat: false, shouldStop: true };
}

/**
 * Cycles through play modes: normal -> repeat-all -> repeat-one -> shuffle -> normal
 * 
 * @param currentMode Active playback mode
 * @returns Next playback mode
 */
export function togglePlayMode(currentMode: PlayMode): PlayMode {
	const modes: Array<"normal" | "repeat-all" | "repeat-one"> = [
		"normal",
		"repeat-all",
		"repeat-one",
	];
	const currentIndex = modes.indexOf(currentMode as "normal" | "repeat-all" | "repeat-one");
	const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % modes.length;
	const nextMode = modes[nextIndex];
	if (!nextMode) {
		return "normal";
	}
	return nextMode;
}

/**
 * Resolves index of track in global playlist by file path matching.
 * 
 * @param track Target track file
 * @param globalList Global track list
 * @returns Index in playlist, or -1 if not found
 */
export function findTrackIndexInGlobalList(track: TFile, globalList: TFile[]): number {
	return globalList.findIndex((f) => f.path === track.path);
}
