import React from "react";
import { type IconName, setIcon } from "obsidian";
import { t } from "@/utils/i18n/i18n";

/**
 * Props interface for navigation icon button component
 */
interface NavIconButtonProps {
	/** Obsidian icon name */
	icon: IconName;
	/** Button label text (for accessibility) */
	label: string;
	/** Whether the button is active (used to highlight current page) */
	active?: boolean;
	/** Whether the button is disabled */
	disabled?: boolean;
	/** Callback function on button click */
	onClick: () => void;
	/** Whether to show notification badge dot */
	showBadge?: boolean;
	/** Accessibility label for rebuild notification badge */
	rebuildBadgeAria?: string;
}

/**
 * Navigation icon button component
 * 
 * Used for icon buttons in navigation bar, supporting active state highlighting.
 * Uses Obsidian's built-in icon system to set icons automatically.
 * 
 * @param props Button properties
 */
function NavIconButton({ icon, label, active, disabled, onClick, showBadge, rebuildBadgeAria }: NavIconButtonProps) {
	const buttonRef = React.useRef<HTMLButtonElement>(null);

	React.useEffect(() => {
		if (buttonRef.current) {
			setIcon(buttonRef.current, icon);
		}
	}, [icon]);

	return (
		<div className="music-player-nav-icon-wrapper nav-icon-wrapper">
			<button
				ref={buttonRef}
				type="button"
				className={`clickable-icon music-player-nav-button nav-action-button ${active ? "active" : ""} ${disabled ? "is-disabled" : ""}`}
				aria-label={label}
				onClick={onClick}
				disabled={disabled}
			/>
			{showBadge && (
				<span className="music-player-nav-badge nav-icon-badge" aria-label={rebuildBadgeAria ?? ""} />
			)}
		</div>
	);
}

/**
 * Props interface for NavigationBar component
 */
export interface NavigationBarProps {
	/** Currently active tab ("currentDisc" for current disc page, "library" for music library page) */
	activeTab: "currentDisc" | "library";
	/** Current page (only valid when activeTab is "currentDisc", "disc" for disc page, "lyrics" for lyrics page) */
	currentPage?: "disc" | "lyrics";
	/** Callback function to open music library page */
	onOpenLibrary: () => void;
	/** Callback function to open disc page */
	onOpenDisc: () => void;
	/** Callback function to open lyrics page (optional) */
	onOpenLyrics?: () => void;
	/** Callback function to rebuild all data (async) */
	onRebuild: () => Promise<void>;
	/** Whether rebuild is currently in progress (disables rebuild button) */
	isRebuilding?: boolean;
	/** Whether library index needs rebuilding (shows badge dot) */
	needsRebuild?: boolean;
	/** Callback function to open search modal */
	onSearch: () => void;
	/** Callback function to open settings tab */
	onSettings: () => void;
}

/**
 * Navigation bar component
 * 
 * Provides primary navigation features for the music player, including:
 * - Search tracks
 * - Switch to music library page
 * - Switch to disc / lyrics page
 * - Rebuild all data
 * - Open settings
 * 
 * Automatically highlights the corresponding button based on active tab and page.
 * 
 * @param props Navigation bar properties
 */
export function NavigationBar(props: NavigationBarProps) {
	const {
		activeTab,
		currentPage,
		onOpenLibrary,
		onOpenDisc,
		onOpenLyrics,
		onRebuild,
		onSearch,
		onSettings,
		isRebuilding = false,
		needsRebuild = false,
	} = props;

	return (
		<div className="music-player-nav-buttons">
			<NavIconButton icon="search" label={t("nav.search")} onClick={onSearch} />
			<NavIconButton
				icon="music-2"
				label={t("nav.library")}
				active={activeTab === "library"}
				onClick={onOpenLibrary}
			/>
			<NavIconButton
				icon="disc-album"
				label={t("nav.disc")}
				active={activeTab === "currentDisc" && currentPage === "disc"}
				onClick={onOpenDisc}
			/>
			{onOpenLyrics && (
				<NavIconButton
					icon="type"
					label={t("nav.lyrics")}
					active={activeTab === "currentDisc" && currentPage === "lyrics"}
					onClick={onOpenLyrics}
				/>
			)}
			<NavIconButton
				icon="database-zap"
				label={t("nav.rebuild")}
				onClick={() => {
					void onRebuild();
				}}
				disabled={isRebuilding}
				showBadge={needsRebuild}
				rebuildBadgeAria={t("nav.rebuildBadge")}
			/>
			<NavIconButton icon="settings" label={t("nav.settings")} onClick={onSettings} />
		</div>
	);
}

