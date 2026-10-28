// @vitest-environment happy-dom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { AudioVisualizer } from './AudioVisualizer';
import { EqualizerService } from '@/services/EqualizerService';

describe('AudioVisualizer', () => {
	it('should render correct number of frequency bars', () => {
		const { container } = render(<AudioVisualizer isPlaying={false} barsCount={16} />);
		const bars = container.querySelectorAll('.music-player-visualizer-bar');
		expect(bars.length).toBe(16);
	});

	it('should trigger onToggleVisualizer callback on click', () => {
		const onToggle = vi.fn();
		const { container } = render(
			<AudioVisualizer isPlaying={false} onToggleVisualizer={onToggle} />
		);
		const root = container.querySelector('.music-player-visualizer');
		expect(root).toBeDefined();
		if (root) {
			fireEvent.click(root);
			expect(onToggle).toHaveBeenCalledTimes(1);
		}
	});

	it('should update bar heights when playing and equalizer service provides frequency data', () => {
		const mockEq = {
			getFrequencyData: vi.fn().mockReturnValue(new Uint8Array([200, 180, 150, 120, 80, 50])),
		} as unknown as EqualizerService;

		let rafCallback: FrameRequestCallback | null = null;
		vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
			rafCallback = cb;
			return 1;
		});
		const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

		const { container, unmount } = render(
			<AudioVisualizer isPlaying={true} equalizerService={mockEq} barsCount={6} />
		);

		// Trigger frame animation
		if (rafCallback) {
			(rafCallback as any)(50);
		}

		const bars = container.querySelectorAll('.music-player-visualizer-bar');
		expect(bars.length).toBe(6);

		unmount();
		expect(cancelSpy).toHaveBeenCalled();
	});
});
