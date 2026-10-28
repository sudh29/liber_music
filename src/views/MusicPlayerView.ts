/**
 * Liber Music Player view module
 * 
 * Architectural notes:
 * - Manages Obsidian View lifecycle and service initialization
 * - Business logic methods (playback control, library management) are encapsulated and accessed via hooks
 * - React components should consume hooks (usePlaybackControl, useLibraryManagement) rather than calling view methods directly
 * - Components receive data and callbacks via props and avoid accessing view directly
 * - Non-React code (e.g. keyboard shortcuts) may directly access methods marked @internal
 */

import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { Root } from "react-dom/client";
import MusicPlayerPlugin from "@/main";
import { KeyboardShortcutHandler, setupKeyboardShortcuts } from "@/utils/keyboard/shortcuts";
import { QueueModal, TrackSearchModal } from "@/components";
import type { ReactLibrarySnapshot, ReactPlaybackSnapshot } from "@/types";
import { AssetService, AudioService, CrossfadeService, EqualizerService, FavoriteService, LibraryService, ListenerService, ListService, LyricsService, MediaSessionService, PlaybackService, PlaylistService, ReactApiService, ScrobblerService, SnapshotService, StateService, ViewSetupService, WakeLockService } from "@/services";
import { togglePlayMode } from "@/utils/playback/control";
import type { ReactApi } from "@/types";
import { t, tWithParams } from "@/utils/i18n/i18n";
import { formatListLabel } from "@/utils/list/formatter";

/**
 * Liber Music Player view type identifier.
 * 
 * Used to register and identify the music player view in Obsidian.
 */
export const VIEW_TYPE_MUSIC_PLAYER = "view";

/**
 * Liber Music Player view class.
 * 
 * Extends Obsidian's ItemView, responsible for:
 * - Obsidian View lifecycle management (onOpen, onClose)
 * - Service initialization and dependency injection
 * - Providing business logic methods for hooks and keyboard shortcuts
 * - Managing React root component mounting and unmounting
 * 
 * Note: Business logic is encapsulated in hooks; React components should use hooks instead of calling view methods directly.
 */
export class MusicPlayerView extends ItemView {
	/** Plugin instance */
	plugin: MusicPlayerPlugin;
	
	/**
	 * Gets current audio element
	 * 
	 * @returns Current audio element, or null if non-existent
	 */
	get audioElement(): HTMLAudioElement | null {
		return this.audioService.getAudioElement();
	}
	
	/** State management services */
	private stateService: StateService;
	private libraryService: LibraryService;
	private playlistService: PlaylistService;
	private favoriteService: FavoriteService;
	private lyricsService: LyricsService;
	private audioService: AudioService;
	private listService: ListService;
	private snapshotService: SnapshotService;
	public playbackService: PlaybackService;
	private assetService: AssetService;
	private viewSetupService: ViewSetupService;
	private reactApiService: ReactApiService;
	private listenerService: ListenerService;
	private mediaSessionService?: MediaSessionService;
	private wakeLockService?: WakeLockService;
	private scrobblerService?: ScrobblerService;
	public equalizerService: EqualizerService;
	public crossfadeService: CrossfadeService;
	private keyboardShortcuts?: KeyboardShortcutHandler;
	private libraryUpdateListeners: Set<() => void> = new Set();
	private reactRoot: Root | null = null;
	/** Callback when playing previous track (sets lastAction) */
	private onPlayPreviousCallback?: () => void;
	/** Callback when playing next track (sets lastAction) */
	private onPlayNextCallback?: () => void;
	/** Callback when directly selecting a track (clears lastAction) */
	private onDirectPlayCallback?: () => void;
	/** Vault file system listeners (monitors audio file changes) */
	private vaultEventListeners: Array<() => void> = [];
	/** Flag indicating whether library re-indexing is required */
	private needsRebuild: boolean = false;

	// ========== State Accessors ==========
	// Direct access to stateService to avoid redundant getState() calls
	
	/** Gets full state object */
	get state() { return this.stateService.getState(); }
	/** Currently playing track */
	get currentTrack() { return this.state.currentTrack; }
	/** All music tracks */
	get trackList() { return this.state.trackList; }
	/** Current track index within list */
	get currentIndex() { return this.state.currentIndex; }
	/** Whether audio is currently playing */
	get isPlaying() { return this.state.isPlaying; }
	/** Standard lyrics for current track */
	get currentLyrics() { return this.state.currentLyrics; }
	/** Word-by-word extended lyrics for current track */
	get currentExtendedLyrics() { return this.state.currentExtendedLyrics; }
	/** Favorite track list */
	get favorites() { return this.state.favorites; }
	/** Playlist map (playlist name -> track paths array) */
	get playlistMap() { return this.state.playlistMap; }
	/** Current playlist section ID */
	get currentSectionIdForPlaylist() { return this.state.currentSectionIdForPlaylist; }
	/** Current list context */
	get currentList() { return this.state.currentList; }
	/** Current list identifier */
	get currentListId() { return this.state.currentListId; }
	/** Playback mode */
	get playMode() { return this.state.playMode; }
	/** Volume (0-1) */
	get volume() { return this.state.volume; }
	/** Playback rate (0.25-4.0) */
	get playbackRate() { return this.state.playbackRate; }

	/**
	 * React API - unified interface for React components
	 * 
	 * Returns API interface provided by ReactApiService for consumption via hooks.
	 * 
	 * @returns React API interface object
	 */
	get reactApi(): ReactApi {
		return this.reactApiService.getApi();
	}

	/**
	 * Creates a music player view instance.
	 * 
	 * Initializes all services with strict dependency ordering:
	 * 1. Base services (StateService, LibraryService, PlaylistService, etc.)
	 * 2. Dependent services (ListService, ViewService, etc.)
	 * 3. Orchestration services (PlaybackService, LibraryOrchestrationService)
	 * 4. API service (ReactApiService)
	 * 
	 * @param leaf - Obsidian workspace leaf
	 * @param plugin - Plugin instance
	 */
	constructor(leaf: WorkspaceLeaf, plugin: MusicPlayerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.stateService = new StateService(
			this.plugin.settings.volume ?? 1.0,
			this.plugin.settings.playbackRate ?? 1.0
		);
		this.playlistService = new PlaylistService(this.app, this.plugin);
		this.favoriteService = new FavoriteService(this.plugin);
		this.lyricsService = new LyricsService(this.plugin);
		this.equalizerService = new EqualizerService(
			{
				enabled: this.plugin.settings.eqEnabled,
				preset: this.plugin.settings.eqPreset,
				bands: this.plugin.settings.eqBands,
				preampGainDb: this.plugin.settings.preampGainDb,
			},
			(eqState) => {
				this.plugin.settings.eqEnabled = eqState.enabled;
				this.plugin.settings.eqPreset = eqState.preset;
				this.plugin.settings.eqBands = eqState.bands;
				this.plugin.settings.preampGainDb = eqState.preampDb;
				void this.plugin.saveSettings();
			}
		);
		this.audioService = new AudioService(this.app, this.equalizerService);
		this.libraryService = new LibraryService(
			this.app,
			this.plugin,
			this.stateService,
			this.playlistService,
			this.lyricsService,
			{
				onLibraryUpdated: () => this.handleLibraryUpdated(),
			}
		);
		this.listService = new ListService(this.libraryService, this.playlistService, this.plugin);
		this.mediaSessionService = new MediaSessionService({
			onPlay: () => this.playbackService.togglePlay(),
			onPause: () => this.playbackService.togglePlay(),
			onPrevious: () => this.playbackService.playPrevious(),
			onNext: () => this.playbackService.playNext(),
			onSeekTo: (time) => this.playbackService.seekToTime(time),
			onSeekBackward: (sec) => this.audioService.seekBackward(sec),
			onSeekForward: (sec) => this.audioService.seekForward(sec),
		});
		this.wakeLockService = new WakeLockService();
		this.wakeLockService.setEnabled(this.plugin.settings.keepScreenAwake ?? false);
		this.scrobblerService = new ScrobblerService(this.app, this.plugin);

		this.crossfadeService = new CrossfadeService(
			this.plugin.settings.crossfadeDuration ?? 0,
			{
				onTriggerTransition: async () => {
					await this.playbackService.playNext();
					return this.audioService.getAudioElement();
				},
				onPrebufferNextTrack: async () => {
					const state = this.stateService.getState();
					const nextTrack = state.trackList[(state.currentIndex + 1) % Math.max(1, state.trackList.length)];
					if (nextTrack) {
						try {
							await this.app.vault.readBinary(nextTrack);
						} catch {}
					}
				},
			}
		);

		this.playbackService = new PlaybackService(
			this.plugin,
			this.stateService,
			this.audioService,
			this.lyricsService,
			this.listService,
			this.snapshotService,
			{
				onLibraryUpdated: () => this.handleLibraryUpdated(),
				onTrackEnd: () => this.onTrackEnd(),
				onRefreshMusicList: () => {
					void this.refreshMusicList();
				},
			},
			this.mediaSessionService,
			this.wakeLockService,
			this.scrobblerService,
			this.equalizerService,
			this.crossfadeService
		);
		this.assetService = new AssetService(this.app, this.plugin);
		this.viewSetupService = new ViewSetupService(this.app);
		this.reactApiService = new ReactApiService(
			this.plugin,
			this.stateService,
			this.listService,
			this.playbackService,
			this.audioService,
			this.favoriteService,
			this.playlistService,
			{
				onLibraryUpdated: () => this.handleLibraryUpdated(),
				onDirectPlay: () => {
					// Clear lastAction to update cover immediately without sliding animation
					if (this.onDirectPlayCallback) {
						this.onDirectPlayCallback();
					}
				},
				onShowNotice: (message: string, timeout?: number) => {
					new Notice(message, timeout);
				},
			}
		);
		// Audio event handlers for recreating audio element on file rename
		// Matches callback structure in PlaybackService
		const audioEventHandlers = {
			onTimeUpdate: () => {
				// Playback progress update (handled by React components via usePlaybackState)
			},
			onLoadedMetadata: () => {
				// Metadata loaded callback (handled by React components)
			},
			onEnded: () => {
				// Track ended callback, consistent with PlaybackService onTrackEnd
				this.onTrackEnd();
			},
		};
		
		this.listenerService = new ListenerService(
			this.app,
			this.plugin,
			this.libraryService,
			this.stateService,
			this.audioService,
			this.lyricsService,
			audioEventHandlers
		);
	}

	/**
	 * Gets view type identifier
	 * 
	 * @returns View type identifier
	 */
	getViewType() {
		return VIEW_TYPE_MUSIC_PLAYER;
	}

	/**
	 * Subscribes to library update events.
	 * 
	 * Notifies registered listeners when music library changes
	 * (refresh, toggle favorite, edit playlist, etc.).
	 * 
	 * @param listener - Callback function on library update
	 */
	public subscribeLibraryUpdates(listener: () => void) {
		this.libraryUpdateListeners.add(listener);
	}

	/**
	 * Unsubscribes from library update events.
	 * 
	 * @param listener - Listener function to remove
	 */
	public unsubscribeLibraryUpdates(listener: () => void) {
		this.libraryUpdateListeners.delete(listener);
	}

	/**
	 * Gets view display title
	 * 
	 * @returns View display name
	 */
	getDisplayText() {
		return t("view.title");
	}

	/**
	 * Gets view icon
	 * 
	 * @returns Lucide icon name
	 */
	getIcon() {
		return "lucide-music";
	}

	/**
	 * View initialization method called when opening view.
	 * 
	 * Responsible for:
	 * - Setting up React root component
	 * - Checking track list consistency and flagging need for index rebuild
	 * - Refreshing library state
	 * - Restoring last played track
	 * - Registering keyboard shortcuts
	 * - Registering vault file system listeners
	 */
	async onOpen() {
		try {
			// Reload settings on each view open to ensure remote sync changes apply
			await this.plugin.loadSettings();
			this.wakeLockService?.setEnabled(this.plugin.settings.keepScreenAwake ?? false);

			// Clean up previous React root if present
			if (this.reactRoot) {
				try {
					this.reactRoot.unmount();
				} catch (e) {
					console.warn("Error unmounting previous React root:", e);
				}
				this.reactRoot = null;
			}
			
			// Setup React root component (must happen first to ensure UI can render)
			const { reactRoot } = this.viewSetupService.setupView(this.containerEl, this);
			this.reactRoot = reactRoot;
			
			// Register file system listeners to monitor audio file changes
			this.listenerService.cleanup();
			this.listenerService.setup();
			
			// Check library consistency on startup; set flag if rebuild is required without auto-rebuilding
			try {
				const needsUpdate = await this.libraryService.checkLibraryConsistency();
				if (needsUpdate) {
					console.debug("Library inconsistency detected; index rebuild required");
					this.needsRebuild = true;
					// Notify React components to update UI
					this.notifyNeedsRebuildChange();
				}
			} catch (error) {
				// Silently handle error to avoid breaking startup flow
				console.error("Error checking library data on startup:", error);
			}
			
			// Refresh library state on initialization
			await this.handleLibraryUpdated();
			await this.restoreLastPlayedTrack();
			this.keyboardShortcuts = setupKeyboardShortcuts(this);
		} catch (error) {
			console.error("Error initializing view:", error);
			// Display fallback error container if initialization fails
			if (this.containerEl) {
				const errorDiv = this.containerEl.createDiv();
				errorDiv.setCssProps({ padding: "20px", color: "var(--text-error)" });
				errorDiv.textContent = tWithParams("view.initFailed", {
					detail: error instanceof Error ? error.message : String(error),
				});
				this.containerEl.appendChild(errorDiv);
			}
		}
	}

	/**
	 * View cleanup method called on close.
	 * 
	 * Responsible for:
	 * - Cleaning up audio element
	 * - Removing keyboard shortcut listeners
	 * - Removing vault event listeners
	 * - Unmounting React root
	 */
	async onClose() {
		await this.audioService.cleanup();
		if (this.keyboardShortcuts) this.keyboardShortcuts.cleanup();
		if (this.mediaSessionService) this.mediaSessionService.destroy();
		if (this.wakeLockService) this.wakeLockService.destroy();
		if (this.crossfadeService) this.crossfadeService.dispose();
		if (this.equalizerService) await this.equalizerService.dispose();
		// Clean up file system listeners
		this.listenerService.cleanup();
		if (this.reactRoot) {
			this.reactRoot.unmount();
			this.reactRoot = null;
		}
	}

	/**
	 * Opens queue / playlist modal
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	public async openPlaylistSheet() {
		// Refresh library state before opening playlist modal
		await this.handleLibraryUpdated();
		const { list } = this.listService.getCurrentPlaylistForTrack(
			this.state.currentTrack,
			this.state.currentList,
			this.state.trackList,
			this.state.favorites
		);
		if (list.length === 0) return;
		const listId = this.listService.calculateCurrentListId(
			this.state.currentTrack,
			this.state.currentList,
			this.state.trackList,
			this.state.favorites
		);
		const modal = new QueueModal(this.app, this.plugin, list, this.state.currentTrack);
		modal.setPlaceholder(
			tWithParams("queue.placeholderWithContext", {
				context: formatListLabel(listId),
			})
		);
		const selectedFile = await modal.prompt();
		if (selectedFile) {
			// Clear lastAction to update cover immediately without sliding animation
			if (this.onDirectPlayCallback) {
				this.onDirectPlayCallback();
			}
			const success = await this.playbackService.playByPath(selectedFile.path);
			if (!success) {
				new Notice(t("notice.trackMissing"), 5000);
			}
		}
	}

	/**
	 * Opens search modal (private method).
	 * 
	 * Refreshes track list and opens modal allowing user to search and play tracks.
	 */
	private async openSearchModal() {
		await this.refreshMusicList();
		if (this.state.trackList.length === 0) return;
		const modal = new TrackSearchModal(this.app, this.plugin, this.state.trackList, this.state.currentTrack);
		modal.setPlaceholder(t("search.placeholder"));
		const selectedFile = await modal.prompt();
		if (selectedFile) {
			// Clear lastAction to update cover immediately without sliding animation
			if (this.onDirectPlayCallback) {
				this.onDirectPlayCallback();
			}
			this.stateService.setCurrentList({
				type: "all",
				name: t("list.all"),
				tracks: this.state.trackList,
			});
			this.stateService.setCurrentListId("all");
			await this.playbackService.playByPath(selectedFile.path);
		}
	}

	/**
	 * Restores last played track on view open.
	 * Checks settings to decide whether to auto-play.
	 */
	private async restoreLastPlayedTrack() {
		const autoPlay = this.plugin.settings.autoPlayOnOpen ?? false;
		await this.playbackService.restoreLastPlayedTrack(autoPlay);
	}

	/**
	 * Opens search modal (public method).
	 * 
	 * Public entry point for search modal invocation.
	 */
	public openSearchModalPublic() {
		void this.openSearchModal();
	}

	/**
	 * Refreshes music track list.
	 * 
	 * Reads data from settings and rebuilds categorized collections (artists, albums, etc.).
	 */
	async refreshMusicList() {
		this.libraryService.refreshMusicList();
	}

	/**
	 * Resolves asset file path.
	 * 
	 * @param filename - Asset filename
	 * @returns Full path to asset file
	 */
	public async getAssetPath(filename: string): Promise<string> {
		return this.assetService.getAssetPath(filename);
	}

	/**
	 * Gets playback state snapshot.
	 * 
	 * Used by React components to retrieve all current playback state information.
	 * 
	 * @returns Playback state snapshot object
	 */
	public getReactPlaybackSnapshot(): ReactPlaybackSnapshot {
		const state = this.stateService.getState();
		return this.snapshotService.getPlaybackSnapshot({
			...state,
			audioElement: this.audioElement,
		});
	}

	/**
	 * Gets library snapshot.
	 * 
	 * Used by React components to retrieve categorized music library information.
	 * 
	 * @returns Library snapshot object
	 */
	public getReactLibrarySnapshot(): ReactLibrarySnapshot {
		const state = this.stateService.getState();
		return this.snapshotService.getLibrarySnapshot(
			state.trackList,
			state.currentTrack,
			state.currentListId
		);
	}

	/**
	 * Asynchronously resolves track album cover (folder cover image prioritized over embedded cover).
	 * 
	 * @param trackFile - Music track file
	 * @param options - Optional parameters (e.g. disable embedded cover extraction in mobile lists)
	 * @returns Cover image URL (file path or base64 Data URL), or undefined if not found
	 */
	public async getTrackCoverAsync(
		trackFile: TFile | null | undefined,
		options?: Parameters<typeof this.snapshotService.getTrackCoverAsync>[1]
	): Promise<string | undefined> {
		if (!trackFile) return undefined;
		return await this.snapshotService.getTrackCoverAsync(trackFile, options);
	}

	/**
	 * Toggles playback between play and pause.
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	async togglePlay() {
		await this.playbackService.togglePlay();
	}

	/**
	 * Plays previous track.
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	async playPrevious() {
		// Call callback if registered (used to set lastAction)
		if (this.onPlayPreviousCallback) {
			this.onPlayPreviousCallback();
		}
		await this.playbackService.playPrevious();
	}

	/**
	 * Plays next track.
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	async playNext() {
		// Call callback if registered (used to set lastAction)
		if (this.onPlayNextCallback) {
			this.onPlayNextCallback();
		}
		await this.playbackService.playNext();
	}

	/**
	 * Sets callbacks for playback actions (used to set/clear lastAction).
	 * 
	 * When previous/next is triggered via keyboard shortcuts, these callbacks set lastAction
	 * to trigger disc sliding animations.
	 * When a song is selected directly (library, search, playlist), onDirectPlay clears lastAction
	 * to update the cover immediately without sliding animation.
	 * 
	 * @param onPrev - Callback when playing previous track
	 * @param onNext - Callback when playing next track
	 * @param onDirectPlay - Callback when directly selecting a track (clears lastAction)
	 */
	setPlaybackActionCallbacks(onPrev?: () => void, onNext?: () => void, onDirectPlay?: () => void) {
		this.onPlayPreviousCallback = onPrev;
		this.onPlayNextCallback = onNext;
		this.onDirectPlayCallback = onDirectPlay;
	}

	/**
	 * Callback when current track completes playback.
	 * 
	 * Triggered by audio element event listener to handle post-playback logic
	 * (e.g. auto-play next track, single-track repeat, etc.).
	 */
	private onTrackEnd = () => {
		this.playbackService.handleTrackEnd();
	};

	/**
	 * Toggles playback mode.
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	async togglePlayMode() {
		this.stateService.setPlayMode(togglePlayMode(this.state.playMode));
	}

	/**
	 * Toggles smart non-repeating shuffle.
	 */
	async toggleShuffle() {
		return this.playbackService.toggleShuffle();
	}

	/**
	 * Toggles artwork display mode ('vinyl' <-> 'card').
	 */
	async toggleArtworkDisplayMode() {
		return this.playbackService.toggleArtworkDisplayMode();
	}

	/**
	 * Sets track rating (0 to 5) and persists.
	 */
	async setRating(path: string, rating: number) {
		await this.playbackService.setTrackRating(path, rating);
	}

	/**
	 * Seeks to specific playback ratio (0 to 1).
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	public seekToRatio(ratio: number) {
		this.audioService.seekToRatio(ratio);
	}

	/**
	 * Fast-forwards audio by specified seconds.
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	seekForward(seconds: number) {
		this.audioService.seekForward(seconds);
	}

	/**
	 * Rewinds audio by specified seconds.
	 * @internal React components should access this method via usePlaybackControl hook
	 */
	seekBackward(seconds: number) {
		this.audioService.seekBackward(seconds);
	}

	/**
	 * Rebuilds all library data.
	 * 
	 * Performs a complete rebuild of the music library: rescans vault files,
	 * re-extracts metadata, regenerates classifications, etc.
	 * @internal React components should access this method via useLibraryManagement hook
	 */
	public async rebuildAllData() {
		// Execute rebuild
		await this.libraryService.rebuildAllData();
		// Clear rebuild flag
		this.needsRebuild = false;
		// Notify React components to update UI
		this.notifyNeedsRebuildChange();
		// Update state and notify listeners
		await this.handleLibraryUpdated();
	}

	/**
	 * Checks whether library index rebuild is required.
	 * 
	 * @returns True if rebuild is required, false otherwise
	 */
	public getNeedsRebuild(): boolean {
		return this.needsRebuild;
	}

	/**
	 * Notifies React components of rebuild flag change.
	 * 
	 * Triggers library update events to refresh React UI.
	 */
	private notifyNeedsRebuildChange(): void {
		// Trigger all registered listeners so React components update UI
		for (const listener of this.libraryUpdateListeners) {
			try {
				listener();
			} catch (e) {
				console.error("Error notifying rebuild flag change:", e);
			}
		}
	}

	/**
	 * Handles library update events.
	 * 
	 * Called whenever the library changes to notify all registered listeners.
	 * Updates library state (refreshes track list, updates categorizations, etc.).
	 */
	public async handleLibraryUpdated() {
		await this.libraryService.handleLibraryUpdated(this.libraryUpdateListeners);
	}
}
