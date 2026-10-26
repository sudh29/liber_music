/**
 * Album disc rotation animation hook
 * 
 * Manages disc rotation animation during playback via requestAnimationFrame.
 */

import React from "react";

/**
 * Hook input parameters
 */
export interface UseDiscRotationParams {
	/** Whether audio is currently playing */
	isPlaying: boolean;
}

/**
 * Hook return values
 */
export interface UseDiscRotationReturn {
	/** Current rotation angle in degrees */
	rotationAngle: number;
	/** Ref to apply rotation angle to DOM element */
	currentDiscRef: React.RefObject<HTMLDivElement>;
	/** Resets rotation angle back to 0 (called on track change) */
	resetRotation: () => void;
}

/**
 * Disc rotation hook
 * 
 * Drives vinyl rotation using requestAnimationFrame.
 * Speed: 1 revolution (360 degrees) per 20 seconds.
 * 
 * @param params Hook parameters
 * @returns Hook return values
 */
export function useDiscRotation({ isPlaying }: UseDiscRotationParams): UseDiscRotationReturn {
	const [rotationAngle, setRotationAngle] = React.useState(0);
	const rotationRef = React.useRef<number>(0);
	const animationStartTimeRef = React.useRef<number>(0);
	const animationStartAngleRef = React.useRef<number>(0);
	const animationFrameRef = React.useRef<number | null>(null);
	const currentDiscRef = React.useRef<HTMLDivElement>(null);

	// Animation loop updating rotation angle
	const updateRotation = React.useCallback(() => {
		if (isPlaying && currentDiscRef.current) {
			const now = Date.now();
			const elapsed = now - animationStartTimeRef.current;
			// 1 full turn (360 deg) every 20,000ms
			const rotationSpeed = 360 / 20000;
			const currentAngle = animationStartAngleRef.current + (elapsed * rotationSpeed);
			rotationRef.current = currentAngle;
			setRotationAngle(currentAngle);
			animationFrameRef.current = window.requestAnimationFrame(updateRotation);
		}
	}, [isPlaying]);

	// Listen for play status changes and maintain angle
	React.useEffect(() => {
		if (isPlaying) {
			animationStartTimeRef.current = Date.now();
			animationStartAngleRef.current = rotationRef.current;
			animationFrameRef.current = window.requestAnimationFrame(updateRotation);
		} else {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
			setRotationAngle(rotationRef.current);
		}
		
		return () => {
			if (animationFrameRef.current !== null) {
				cancelAnimationFrame(animationFrameRef.current);
				animationFrameRef.current = null;
			}
		};
	}, [isPlaying, updateRotation]);

	// Reset rotation angle (called on track change)
	const resetRotation = React.useCallback(() => {
		setRotationAngle(0);
		rotationRef.current = 0;
		animationStartAngleRef.current = 0;
		animationStartTimeRef.current = Date.now();
		if (animationFrameRef.current !== null) {
			cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		}
		if (isPlaying) {
			animationFrameRef.current = window.requestAnimationFrame(updateRotation);
		}
	}, [isPlaying, updateRotation]);

	return {
		rotationAngle,
		currentDiscRef,
		resetRotation,
	};
}
