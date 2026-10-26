// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { PlaybackControls } from "@/components/player/PlaybackControls";
import { formatTime, ProgressBar } from "@/components/player/ProgressBar";
import { TrackHeader } from "@/components/player/TrackHeader";
import { PlayingIndicator } from "@/components/player/PlayingIndicator";

describe("Player Components", () => {
	describe("PlaybackControls", () => {
		it("should render playback buttons and handle clicks", () => {
			const onTogglePlay = vi.fn();
			const onPrev = vi.fn();
			const onNext = vi.fn();
			const onToggleMode = vi.fn();
			const onOpenPlaylist = vi.fn();

			const { container } = render(
				<PlaybackControls
					isPlaying={false}
					playMode="normal"
					onTogglePlay={onTogglePlay}
					onPrev={onPrev}
					onNext={onNext}
					onToggleMode={onToggleMode}
					onOpenPlaylist={onOpenPlaylist}
				/>
			);

			const buttons = container.querySelectorAll("button");
			expect(buttons).toHaveLength(5);

			const modeBtn = buttons[0];
			const prevBtn = buttons[1];
			const playBtn = buttons[2];
			const nextBtn = buttons[3];
			const playlistBtn = buttons[4];

			fireEvent.click(playBtn);
			expect(onTogglePlay).toHaveBeenCalledTimes(1);

			fireEvent.click(prevBtn);
			expect(onPrev).toHaveBeenCalledTimes(1);

			fireEvent.click(nextBtn);
			expect(onNext).toHaveBeenCalledTimes(1);

			fireEvent.click(modeBtn);
			expect(onToggleMode).toHaveBeenCalledTimes(1);

			fireEvent.click(playlistBtn);
			expect(onOpenPlaylist).toHaveBeenCalledTimes(1);
		});
	});

	describe("ProgressBar & formatTime", () => {
		it("should format seconds to MM:SS string correctly", () => {
			expect(formatTime(0)).toBe("0:00");
			expect(formatTime(65)).toBe("1:05");
			expect(formatTime(3599)).toBe("59:59");
			expect(formatTime(-10)).toBe("0:00");
			expect(formatTime(NaN)).toBe("0:00");
			expect(formatTime(Infinity)).toBe("0:00");
		});

		it("should render current time and duration labels", () => {
			render(
				<ProgressBar
					current={75}
					duration={180}
					onSeek={vi.fn()}
					onSeekBackward={vi.fn()}
					onSeekForward={vi.fn()}
				/>
			);

			expect(screen.getByText("1:15")).toBeDefined();
			expect(screen.getByText("3:00")).toBeDefined();
		});

		it("should trigger seek backward/forward on clicking time labels", () => {
			vi.useFakeTimers();
			const onSeekBackward = vi.fn();
			const onSeekForward = vi.fn();

			render(
				<ProgressBar
					current={30}
					duration={180}
					onSeek={vi.fn()}
					onSeekBackward={onSeekBackward}
					onSeekForward={onSeekForward}
				/>
			);

			const currentTimeLabel = screen.getByText("0:30");
			const durationLabel = screen.getByText("3:00");

			// Single click
			fireEvent.click(currentTimeLabel);
			vi.advanceTimersByTime(300);
			expect(onSeekBackward).toHaveBeenCalledWith(5);

			fireEvent.click(durationLabel);
			vi.advanceTimersByTime(300);
			expect(onSeekForward).toHaveBeenCalledWith(5);

			vi.useRealTimers();
		});
	});

	describe("TrackHeader", () => {
		it("should display track title and artist name", () => {
			render(<TrackHeader title="Hotel California" artist="Eagles" />);

			expect(screen.getByText("Hotel California")).toBeDefined();
			expect(screen.getByText("Eagles")).toBeDefined();
		});
	});

	describe("PlayingIndicator", () => {
		it("should render playing indicator bars", () => {
			const { container } = render(<PlayingIndicator isPlaying={true} />);
			expect(container.querySelector(".playing-indicator")).toBeDefined();
		});
	});
});
