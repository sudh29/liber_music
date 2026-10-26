/**
 * Track item renderer utility
 * 
 * Provides unified DOM rendering logic for track items in QueueModal and TrackSearchModal.
 */

import { TFile } from "obsidian";
import type { TrackInfo } from "@/types";
import { t } from "@/utils/i18n/i18n";

/**
 * Creates SVG play icon placeholder
 * 
 * @param el Window-scoped HTMLElement
 */
export function createPlayPlaceholderSVG(el: HTMLElement): SVGSVGElement {
	const svg = el.createSvg("svg", {
		attr: {
			width: "24",
			height: "24",
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2",
		},
	});

	const circle = el.createSvg("circle", {
		attr: {
			cx: "12",
			cy: "12",
			r: "10",
		},
	});
	svg.appendChild(circle);

	const polygon = el.createSvg("polygon", {
		attr: {
			points: "10 8 16 12 10 16 10 8",
		},
	});
	svg.appendChild(polygon);

	svg.remove();
	return svg;
}

/**
 * Creates animated equalizer playing indicator
 * 
 * @param container Container element
 */
export function createPlayingIndicator(container: HTMLElement): void {
	container.setAttribute("aria-label", t("playback.playing"));
	for (let i = 0; i < 4; i++) {
		const bar = container.createDiv("equalizer-bar");
		bar.style.animationDelay = `${i * 0.1}s`;
	}
}

/**
 * Options for rendering a track item
 */
export interface RenderTrackItemOptions {
	/** Track file object */
	file: TFile;
	/** Track metadata (optional) */
	track?: TrackInfo;
	/** Whether this is the active playing track */
	isActive: boolean;
	/** Cover URL cache map */
	coverCache: Map<string, string>;
	/** IntersectionObserver instance for lazy loading (optional) */
	observer?: IntersectionObserver | null;
}

/**
 * Renders track item DOM content into container
 * 
 * @param contentEl Container element
 * @param options Render options
 * @returns Cover container element for IntersectionObserver
 */
export function renderTrackItemContent(
	contentEl: HTMLElement, 
	options: RenderTrackItemOptions
): HTMLElement {
	const { file, track, isActive, coverCache, observer } = options;
	
	const container = contentEl.createDiv("playlist-item-container");
	
	const coverContainerEl = container.createDiv("playlist-item-cover");
	coverContainerEl.setAttribute("data-track-path", file.path);
	
	const placeholder = coverContainerEl.createDiv("playlist-item-placeholder");
	placeholder.appendChild(createPlayPlaceholderSVG(contentEl));
	
	if (coverCache.has(file.path)) {
		const coverUrl = coverCache.get(file.path);
		if (coverUrl) {
			coverContainerEl.empty();
			const coverImg = coverContainerEl.createEl("img");
			coverImg.src = coverUrl;
			coverImg.alt = track?.title || file.basename;
		}
	} else if (observer) {
		observer.observe(coverContainerEl);
	}

	const textContainer = container.createDiv("playlist-item-text");
	
	const titleEl = textContainer.createDiv("playlist-item-title");
	const title = track?.title || file.basename;
	if (isActive) {
		titleEl.empty();
		const indicatorContainer = titleEl.createDiv("playing-indicator");
		createPlayingIndicator(indicatorContainer);
		titleEl.createSpan({ text: title });
	} else {
		titleEl.setText(title);
	}
	
	const metaEl = textContainer.createDiv("playlist-item-meta");
	const artistStr = (track?.artist ?? "").trim();
	const artist = artistStr === "" ? t("meta.unknownArtist") : artistStr;
	let album: string | undefined;
	if (track?.album !== undefined && track?.album !== null) {
		const bv = String(track.album).trim();
		album = bv === "" ? t("meta.unknownAlbum") : bv;
	}
	if (album !== undefined) {
		metaEl.setText(`${artist} • ${album}`);
	} else {
		metaEl.setText(artist);
	}
	
	return coverContainerEl;
}
