import React from "react";
import type { EqualizerService } from "@/services/EqualizerService";
import "./AudioVisualizer.css";

export interface AudioVisualizerProps {
	/** Equalizer service instance providing real-time frequency data */
	equalizerService?: EqualizerService;
	/** Whether audio is currently playing */
	isPlaying: boolean;
	/** Number of frequency bars to display (default: 24) */
	barsCount?: number;
	/** Optional container class name */
	className?: string;
	/** Optional title / click callback */
	onToggleVisualizer?: () => void;
}

/**
 * Real-time audio spectrum frequency visualizer component.
 *
 * Samples frequency data from Web Audio AnalyserNode via requestAnimationFrame
 * and modulates bar heights with zero React re-renders for buttery 60fps performance.
 */
export function AudioVisualizer({
	equalizerService,
	isPlaying,
	barsCount = 24,
	className = "",
	onToggleVisualizer,
}: AudioVisualizerProps) {
	const containerRef = React.useRef<HTMLDivElement>(null);
	const barsRef = React.useRef<HTMLDivElement[]>([]);

	React.useEffect(() => {
		if (!isPlaying || !equalizerService) {
			// Reset bars to idle height when paused
			for (const bar of barsRef.current) {
				if (bar) {
					bar.style.height = "3px";
					bar.style.opacity = "0.45";
				}
			}
			return;
		}

		let rafId: number | null = null;
		let lastSampleTime = 0;
		const targetInterval = 25; // ~40fps throttling for power efficiency
		let isDestroyed = false;

		const renderFrame = (timestamp: number) => {
			if (isDestroyed) return;
			if (typeof document !== "undefined" && document.hidden) {
				rafId = null;
				return;
			}

			if (timestamp - lastSampleTime >= targetInterval) {
				const freqData = equalizerService.getFrequencyData();
				if (freqData && freqData.length > 0) {
					const dataLen = freqData.length;
					const step = dataLen / barsCount;

					for (let i = 0; i < barsCount; i++) {
						const bar = barsRef.current[i];
						if (!bar) continue;

						const dataIndex = Math.min(dataLen - 1, Math.floor(i * step));
						const rawVal = freqData[dataIndex] ?? 0;
						// Logarithmic scaling for visually pleasing audio dynamics
						const ratio = Math.min(1.0, rawVal / 240);
						const heightPx = Math.max(3, Math.round(ratio * 32));
						const opacity = Math.min(1.0, 0.4 + ratio * 0.6);

						bar.style.height = `${heightPx}px`;
						bar.style.opacity = String(opacity);
					}
				}
				lastSampleTime = timestamp;
			}
			rafId = window.requestAnimationFrame(renderFrame);
		};

		const handleVisibilityChange = () => {
			if (typeof document !== "undefined" && !document.hidden && rafId === null && !isDestroyed) {
				rafId = window.requestAnimationFrame(renderFrame);
			}
		};

		if (typeof document !== "undefined") {
			document.addEventListener("visibilitychange", handleVisibilityChange);
		}

		if (typeof document === "undefined" || !document.hidden) {
			rafId = window.requestAnimationFrame(renderFrame);
		}

		return () => {
			isDestroyed = true;
			if (rafId !== null) {
				window.cancelAnimationFrame(rafId);
			}
			if (typeof document !== "undefined") {
				document.removeEventListener("visibilitychange", handleVisibilityChange);
			}
		};
	}, [isPlaying, equalizerService, barsCount]);

	const barElements = React.useMemo(() => {
		return Array.from({ length: barsCount }, (_, index) => (
			<div
				key={index}
				ref={(el) => {
					if (el) barsRef.current[index] = el;
				}}
				className="music-player-visualizer-bar"
				style={{ height: "3px", opacity: 0.45 }}
			/>
		));
	}, [barsCount]);

	return (
		<div
			ref={containerRef}
			className={`music-player-visualizer ${className} ${isPlaying ? "is-active" : ""}`}
			onClick={onToggleVisualizer}
			title="Audio Spectrum Visualizer"
			role="region"
			aria-label="Audio spectrum frequency visualizer"
		>
			{barElements}
		</div>
	);
}
