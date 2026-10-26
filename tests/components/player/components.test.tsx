// @vitest-environment happy-dom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { PlaybackControls } from "@/components/player/PlaybackControls";
import { formatTime, ProgressBar } from "@/components/player/ProgressBar";
import { TrackHeader } from "@/components/player/TrackHeader";
import { PlayingIndicator } from "@/components/player/PlayingIndicator";
import { StarRating } from "@/components/player/StarRating";
import { AlbumCard } from "@/components/player/AlbumCard";

describe("Player Components", () => {
	describe("PlaybackControls", () => {
		it("should render 6 playback buttons and handle clicks including dedicated shuffle", () => {
			const onTogglePlay = vi.fn();
			const onPrev = vi.fn();
			const onNext = vi.fn();
			const onToggleMode = vi.fn();
			const onToggleShuffle = vi.fn();
			const onOpenPlaylist = vi.fn();

			const { container } = render(
				<PlaybackControls
					isPlaying={false}
					playMode="normal"
					isShuffle={true}
					onTogglePlay={onTogglePlay}
					onPrev={onPrev}
					onNext={onNext}
					onToggleMode={onToggleMode}
					onToggleShuffle={onToggleShuffle}
					onOpenPlaylist={onOpenPlaylist}
				/>
			);

			const buttons = container.querySelectorAll("button");
			expect(buttons).toHaveLength(6);

			const shuffleBtn = buttons[0];
			const prevBtn = buttons[1];
			const playBtn = buttons[2];
			const nextBtn = buttons[3];
			const modeBtn = buttons[4];
			const playlistBtn = buttons[5];

			expect(shuffleBtn.classList.contains("is-active")).toBe(true);

			fireEvent.click(shuffleBtn);
			expect(onToggleShuffle).toHaveBeenCalledTimes(1);

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

	describe("StarRating", () => {
		it("should render 5 stars and highlight filled stars according to rating", () => {
			const onRate = vi.fn();
			const { container } = render(<StarRating rating={3} onRate={onRate} />);

			const stars = container.querySelectorAll(".star-button");
			expect(stars).toHaveLength(5);
			expect(container.querySelectorAll(".is-filled")).toHaveLength(3);
			expect(container.querySelectorAll(".is-empty")).toHaveLength(2);
		});

		it("should trigger onRate on clicking a star, or clear on clicking the same rating", () => {
			const onRate = vi.fn();
			const { container } = render(<StarRating rating={4} onRate={onRate} />);

			const stars = container.querySelectorAll(".star-button");

			// Click star 5 -> calls onRate(5)
			fireEvent.click(stars[4]);
			expect(onRate).toHaveBeenCalledWith(5);

			// Click star 4 (current rating) -> clears to 0
			fireEvent.click(stars[3]);
			expect(onRate).toHaveBeenCalledWith(0);
		});

		it("should not trigger onRate in readOnly mode", () => {
			const onRate = vi.fn();
			const { container } = render(<StarRating rating={2} onRate={onRate} readOnly={true} />);

			const stars = container.querySelectorAll(".star-button");
			fireEvent.click(stars[2]);
			expect(onRate).not.toHaveBeenCalled();
		});
	});

	describe("AlbumCard", () => {
		it("should render cover image and handle click", () => {
			const onTogglePlay = vi.fn();
			const { container } = render(
				<AlbumCard
					coverUrl="https://example.com/cover.jpg"
					title="Test Song"
					isPlaying={true}
					onTogglePlay={onTogglePlay}
				/>
			);

			const img = container.querySelector("img");
			expect(img).not.toBeNull();
			expect(img?.getAttribute("src")).toBe("https://example.com/cover.jpg");

			const wrapper = container.querySelector(".album-card-wrapper");
			expect(wrapper).not.toBeNull();
			fireEvent.click(wrapper!);
			expect(onTogglePlay).toHaveBeenCalledTimes(1);
		});

		it("should render fallback placeholder when coverUrl is missing", () => {
			const { container } = render(
				<AlbumCard
					title="No Cover Song"
					isPlaying={false}
				/>
			);

			expect(container.querySelector(".album-card-placeholder")).not.toBeNull();
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
