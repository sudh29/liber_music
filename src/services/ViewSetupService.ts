/**
 * View setup service
 * 
 * Manages view DOM setup and React mounting.
 */

import { App } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import * as React from "react";
import type { MusicPlayerView } from "@/views/MusicPlayerView";
import { MusicPlayerRoot } from "@/components";

export interface ViewSetupResult {
	container: HTMLElement;
	navHost?: HTMLElement;
	reactRoot: Root;
}

export class ViewSetupService {
	constructor(private app: App) {}

	/**
	 * Sets up view DOM structure and mounts React root.
	 */
	setupView(containerEl: HTMLElement, view: MusicPlayerView): ViewSetupResult {
		const leafContent = containerEl.closest(".workspace-leaf-content");
		leafContent?.addClass('music-player');
		const viewHeaderEl = leafContent?.querySelector(".view-header") ?? containerEl.querySelector(".view-header");
		const viewHeader = viewHeaderEl instanceof HTMLElement ? viewHeaderEl : null;
		const viewContentEl = leafContent?.querySelector(".view-content") ?? containerEl.querySelector(".view-content");
		const viewContent = viewContentEl instanceof HTMLElement ? viewContentEl : null;
		viewContent?.addClass('music-player');

		let container: HTMLElement | null = null;
		if (viewHeader instanceof HTMLElement) {
			container = viewContent;
		} else if (leafContent instanceof HTMLElement) {
			container = leafContent;
		} else {
			const children = Array.from(containerEl.children);
			container = children[children.length - 1] as HTMLElement;
		}

		if (!container) {
			throw new Error("Unable to locate content container");
		}

		// Handle legacy navHost if present in DOM without creating unnecessary ghost nodes
		const navContainer = leafContent ?? container;
		const navHostEl = navContainer.querySelector(".nav-header, nav-header");
		const navHost = navHostEl instanceof HTMLElement ? navHostEl : undefined;
		if (navHost) {
			navHost.classList.add("music-player");
			navHost.empty?.();
			navHost.addClass("is-hidden");
			navHost.setCssProps({ display: "none" });
		}

		// Clean up residual React mount points if present
		const oldReactMounts = container.querySelectorAll(".music-player-react-root");
		oldReactMounts.forEach(el => el.remove());
		
		// Create fresh DOM element for React root
		const reactMount = container.createDiv();
		reactMount.className = "music-player music-player-container music-player-react-root";
		if (container.firstChild) {
			container.insertBefore(reactMount, container.firstChild);
		} else {
			container.appendChild(reactMount);
		}

		const reactRoot = createRoot(reactMount);
		reactRoot.render(React.createElement(MusicPlayerRoot, { view, navHost }));

		return { container, navHost, reactRoot };
	}
}
