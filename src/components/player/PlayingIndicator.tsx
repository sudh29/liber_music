import React from "react";
import "./PlayingIndicator.css";
import { t } from "@/utils/i18n/i18n";

/**
 * Playing indicator component (equalizer bar animation)
 * Used to indicate active playback state
 */
export function PlayingIndicator() {
	return (
		<div className="playing-indicator" aria-label={t("playback.playing")}>
			<div className="equalizer-bar" style={{ animationDelay: '0s' }} />
			<div className="equalizer-bar" style={{ animationDelay: '0.1s' }} />
			<div className="equalizer-bar" style={{ animationDelay: '0.2s' }} />
			<div className="equalizer-bar" style={{ animationDelay: '0.3s' }} />
		</div>
	);
}

/**
 * Create HTML string for playing indicator (for non-React DOM rendering)
 */
export function createPlayingIndicatorHTML(): string {
	const label = t("playback.playing");
	return `
		<div class="playing-indicator" aria-label="${label}">
			<div class="equalizer-bar" style="animation-delay: 0s"></div>
			<div class="equalizer-bar" style="animation-delay: 0.1s"></div>
			<div class="equalizer-bar" style="animation-delay: 0.2s"></div>
			<div class="equalizer-bar" style="animation-delay: 0.3s"></div>
		</div>
	`;
}

