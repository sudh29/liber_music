/**
 * Lazy track cover loading hook
 * 
 * Manages lazy loading of track album covers:
 * - IntersectionObserver visible viewport detection
 * - Concurrency throttling (limits concurrent cover extraction)
 * - Cover caching (by file path and album name)
 * - Cancellation mechanism (aborts queued loading when navigating away)
 */

import React from "react";
import { App, TFile } from "obsidian";
import type { ReactTrackInfo } from "@/types";

/**
 * Hook input parameters
 */
export interface UseLazyTrackCoversParams {
	/** Tracks list to load covers for */
	tracks: ReactTrackInfo[];
	/** Obsidian App instance */
	app?: App;
	/** Asynchronous cover loader function */
	getTrackCover?: (file: TFile) => Promise<string | undefined>;
}

/**
 * Hook return values
 */
export interface UseLazyTrackCoversReturn {
	/** Loaded covers Map: path -> coverUrl */
	embeddedCovers: Map<string, string>;
	/** Track element ref Map: path -> React.RefObject<HTMLDivElement> */
	trackRefs: Map<string, React.RefObject<HTMLDivElement>>;
	/** Aborts ongoing and queued cover loading */
	stopLoading: () => void;
}

/**
 * Lazy track covers hook
 * 
 * Uses IntersectionObserver to load covers only for visible track items.
 * 
 * @param params Hook parameters
 * @returns Hook return values
 */
export function useLazyTrackCovers({
	tracks,
	app,
	getTrackCover,
}: UseLazyTrackCoversParams): UseLazyTrackCoversReturn {
	const coverCacheRef = React.useRef<Map<string, string>>(new Map());
	const albumCoverCacheRef = React.useRef<Map<string, string>>(new Map());
	const [embeddedCovers, setEmbeddedCovers] = React.useState<Map<string, string>>(new Map());
	const embeddedCoversRef = React.useRef<Map<string, string>>(new Map());
	const loadingPromisesRef = React.useRef<Set<Promise<void>>>(new Set());
	const shouldStopLoadingRef = React.useRef<boolean>(false);
	const MAX_CONCURRENT_COVER_LOADS = 2;
	const activeCoverLoadsRef = React.useRef<number>(0);
	const coverLoadQueueRef = React.useRef<Array<() => void>>([]);
	const trackRefsRef = React.useRef<Map<string, React.RefObject<HTMLDivElement>>>(new Map());
	const pendingBatchRef = React.useRef<Map<string, string>>(new Map());
	const batchTimeoutRef = React.useRef<number | null>(null);

	const flushBatch = React.useCallback(() => {
		if (batchTimeoutRef.current !== null) {
			window.clearTimeout(batchTimeoutRef.current);
			batchTimeoutRef.current = null;
		}
		if (pendingBatchRef.current.size === 0) return;
		const batch = new Map(pendingBatchRef.current);
		pendingBatchRef.current.clear();
		setEmbeddedCovers((prev) => {
			let changed = false;
			const next = new Map(prev);
			for (const [path, url] of batch) {
				if (next.get(path) !== url) {
					next.set(path, url);
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, []);

	const scheduleBatchUpdate = React.useCallback(
		(path: string, url: string) => {
			pendingBatchRef.current.set(path, url);
			if (batchTimeoutRef.current === null) {
				batchTimeoutRef.current = window.setTimeout(flushBatch, 50);
			}
		},
		[flushBatch]
	);

	// Initialize track refs
	React.useEffect(() => {
		const refs = trackRefsRef.current;
		for (const track of tracks) {
			if (!refs.has(track.path)) {
				refs.set(track.path, React.createRef<HTMLDivElement>());
			}
		}
		const trackPaths = new Set(tracks.map(t => t.path));
		for (const [path] of refs) {
			if (!trackPaths.has(path)) {
				refs.delete(path);
			}
		}
	}, [tracks]);

	// Cover load scheduler: throttles concurrent loading tasks
	const enqueueCoverLoad = React.useCallback((task: () => Promise<void>) => {
		if (shouldStopLoadingRef.current) {
			return;
		}

		const run = () => {
			if (shouldStopLoadingRef.current) {
				return;
			}

			activeCoverLoadsRef.current += 1;
			const p = task();
			loadingPromisesRef.current.add(p);

			void p.finally(() => {
				loadingPromisesRef.current.delete(p);
				activeCoverLoadsRef.current -= 1;

				const next = coverLoadQueueRef.current.shift();
				if (next && !shouldStopLoadingRef.current) {
					next();
				}
			});
		};

		if (activeCoverLoadsRef.current < MAX_CONCURRENT_COVER_LOADS) {
			run();
		} else {
			coverLoadQueueRef.current.push(run);
		}
	}, []);

	// Setup IntersectionObserver for visible elements
	React.useEffect(() => {
		if (!getTrackCover || !app) return;

		const observer = new IntersectionObserver(
			(entries) => {
				window.requestAnimationFrame(() => {
					entries.forEach((entry) => {
						if (!entry.isIntersecting || shouldStopLoadingRef.current) return;
						
						const trackElement = entry.target as HTMLElement;
						const trackPath = trackElement.getAttribute('data-track-path');
						if (!trackPath) return;

						const track = tracks.find(t => t.path === trackPath);
						if (!track) return;

						if (track.coverUrl) {
							if (!embeddedCoversRef.current.has(trackPath)) {
								embeddedCoversRef.current.set(trackPath, track.coverUrl);
								scheduleBatchUpdate(trackPath, track.coverUrl);
							}
							observer.unobserve(trackElement);
							return;
						}

						if (coverCacheRef.current.has(trackPath)) {
							const cachedUrl = coverCacheRef.current.get(trackPath);
							if (cachedUrl && !embeddedCoversRef.current.has(trackPath)) {
								embeddedCoversRef.current.set(trackPath, cachedUrl);
								scheduleBatchUpdate(trackPath, cachedUrl);
							}
							observer.unobserve(trackElement);
							return;
						}

						if (embeddedCoversRef.current.has(trackPath)) {
							observer.unobserve(trackElement);
							return;
						}

						// Reuse cached cover for matching album
						if (track.album) {
							const albumCover = albumCoverCacheRef.current.get(track.album);
							if (albumCover) {
								coverCacheRef.current.set(trackPath, albumCover);
								embeddedCoversRef.current.set(trackPath, albumCover);
								scheduleBatchUpdate(trackPath, albumCover);
								observer.unobserve(trackElement);
								return;
							}
						}

						coverCacheRef.current.set(trackPath, "");

						const loadTask = async () => {
							try {
								if (shouldStopLoadingRef.current) {
									coverCacheRef.current.delete(trackPath);
									return;
								}

								const file = app.vault.getAbstractFileByPath(trackPath);
								if (!file || !(file instanceof TFile)) {
									coverCacheRef.current.delete(trackPath);
									return;
								}

								if (shouldStopLoadingRef.current) {
									coverCacheRef.current.delete(trackPath);
									return;
								}

								const coverUrl = await getTrackCover(file);

								if (shouldStopLoadingRef.current) {
									coverCacheRef.current.delete(trackPath);
									return;
								}

								if (coverUrl) {
									coverCacheRef.current.set(trackPath, coverUrl);
									embeddedCoversRef.current.set(trackPath, coverUrl);
									
									if (track.album) {
										albumCoverCacheRef.current.set(track.album, coverUrl);
									}

									scheduleBatchUpdate(trackPath, coverUrl);
								} else {
									coverCacheRef.current.delete(trackPath);
									embeddedCoversRef.current.delete(trackPath);
								}
							} catch (err) {
								if (!shouldStopLoadingRef.current) {
									console.error(`Failed to load track cover (${trackPath}):`, err);
								}
								coverCacheRef.current.delete(trackPath);
							}
						};

						enqueueCoverLoad(loadTask);
						
						observer.unobserve(trackElement);
					});
				});
			},
			{
				rootMargin: '100px',
				threshold: 0.01,
			}
		);

		const rafId = window.requestAnimationFrame(() => {
			const refs = trackRefsRef.current;
			for (const [, ref] of refs) {
				if (ref.current) {
					observer.observe(ref.current);
				}
			}
		});

		return () => {
			cancelAnimationFrame(rafId);
			observer.disconnect();
			if (batchTimeoutRef.current !== null) {
				window.clearTimeout(batchTimeoutRef.current);
				batchTimeoutRef.current = null;
			}
		};
	}, [tracks, getTrackCover, app, enqueueCoverLoad, scheduleBatchUpdate]);

	const stopLoading = React.useCallback(() => {
		shouldStopLoadingRef.current = true;
		if (batchTimeoutRef.current !== null) {
			window.clearTimeout(batchTimeoutRef.current);
			batchTimeoutRef.current = null;
		}
		pendingBatchRef.current.clear();
		loadingPromisesRef.current.clear();
	}, []);

	return {
		embeddedCovers,
		trackRefs: trackRefsRef.current,
		stopLoading,
	};
}
