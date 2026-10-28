<div align="center">
    <h1>Liber Music Player Plugin for Obsidian</h1>
    <p>
        <a href="manifest.json"><img src="https://img.shields.io/badge/version-1.4.0-7f6df2?logo=obsidian" alt="Version 1.4.0"></a>
        <a href="https://obsidian.md"><img src="https://img.shields.io/badge/Obsidian-v1.13.4%2B-purple?logo=obsidian" alt="Obsidian minAppVersion: v1.13.4+"></a>
        <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
        <img src="https://img.shields.io/badge/tests-398%20passed-brightgreen" alt="Tests: 398 passed">
        <img src="https://img.shields.io/badge/coverage-92.31%25-brightgreen" alt="Coverage: 92.31%">
        <img src="https://img.shields.io/badge/toolchain-Vite%2B%20%7C%20Oxc-orange" alt="Toolchain: Vite+ | Oxc">
    </p>
    <p>An audiophile-grade skeuomorphic vinyl music player plugin embedded directly in the Obsidian sidebar. Features local vault audio playback, synchronized karaoke lyrics, playlist and queue management, and offline-first library indexing.</p>
</div>

---

## 🌟 Key Features

### 🎵 High-Fidelity Audio Playback
- **Broad Format Support**: Plays `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`, and `.aac` audio files directly from your Obsidian vault.
- **Granular Controls**: Play/pause, track navigation (previous/next), scrubbable progress bar, elapsed and remaining time displays.
- **Interactive Progress Bar**: Click to seek instantly; drag to scrub with visual-only updates until release; single-click/double-click elapsed time to rewind 5s/15s, and duration to skip forward 5s/15s.
- **Playback Speeds**: Adjustable speeds from `0.5x` to `2.0x`.
- **Volume & Mute**: Stepped volume presets and smooth slider popup controls.
- **Queue Management**: Real-time interactive playback queue modal with instant track selection and search filtering.

### 🎛️ Playback Modes
- **Sequential**: Plays tracks in listed order and stops when finished.
- **Repeat Queue**: Cycles through the active playlist continuously.
- **Repeat One**: Repeats the current track indefinitely.
- **Shuffle**: Shuffles tracks randomly with zero-repeat queue tracking.

### 📚 Music Library & PKM Organization
- **All Tracks**: Scans and displays all audio assets within your vault or dedicated folder.
- **Favorites**: One-click track favoriting with persistent fast-access lists.
- **Custom Playlists**: Full CRUD management—create, rename, reorder, and delete playlists.
- **Artist & Album Categorization**: Automatic tag extraction and aggregation by artist and album.
- **Instant Search**: Modal fuzzy-matching by title, artist, or album name with instant playback.

### 🎤 Synchronized Lyrics (LRC & Word-by-Word Karaoke)
- **Tag & Companion Parsing**: Automatically extracts lyrics embedded within metadata tags (ID3/Vorbis) or adjacent companion `.lrc` files in the vault.
- **Standard LRC**: Accurate line-level timestamp synchronization.
- **Karaoke Word-by-Word**: Syllable-level highlight synchronization (`<mm:ss.xx>`) for karaoke sing-along experiences.
- **Dual Display Modes**:
  - **Three-Line Compact View**: Shows previous, current, and upcoming lines below the turntable.
  - **Full-Screen Scrolling View**: Complete scrollable lyric script with active auto-centering and interactive timestamp jumping.

### 🎨 Skeuomorphic Vinyl Record Aesthetics
- **Animated Turntable**: Realistic rotating vinyl record with tonearm needle placement animations on play/pause.
- **Disc Sliding Transitions**: Smooth disc slide transitions when switching between tracks.
- **Hierarchical Cover Art Resolution**:
  1. Image named `cover.jpg` / `cover.png` in the track's folder (case-insensitive).
  2. Companion image sharing the track's filename (e.g., `song.mp3` → `song.jpg`).
  3. Embedded album artwork extracted from ID3/Vorbis metadata.
  4. Elegant vinyl grooved default placeholder.

### 🔄 Automatic Vault Sync & Cache Reindexing
- **File System Watchers**: Listens to vault file creation, deletion, rename, and move events in real time.
- **Consistency Verification**: Automatically compares the cached index against vault contents on startup.
- **Visual Reindex Indicator**: An unobtrusive dot notification on the Rebuild button indicates index drift, enabling clean one-click cache reconstruction.

### 📝 PKM & Note Deep Integration (v1.4.0)
- **Interactive Markdown Codeblock Player**: Embed lightweight, self-contained music players directly inside notes using ````music```` codeblocks. Supports start/end timestamps, custom lyrics display, and compact or card layouts:
  ````markdown
  ```music
  track: "Music/Classical/Chopin - Nocturne Op. 9.mp3"
  start: "01:23"
  end: "03:45"
  showLyrics: true
  compact: false
  autoplay: false
  ```
  ````
- **Timestamped Lyric Citations & URI Deep-Linking**:
  - Hover or tap any line in the full lyric view to reveal the **Copy Timestamp Link** button (`🔗`).
  - Generates markdown citation links: `[01:23 — "Lyric text"](obsidian://music-player?track=...&t=83)`.
  - Clicking this link anywhere in Obsidian activates the sidebar player, loads the track, and jumps directly to that timestamp.
- **Daily Notes Listening History Scrobbler**:
  - Automatically records completed tracks (>70% listened) to your active Daily Note journal under a configurable heading (e.g. `## 🎧 Music Log`).
  - Maintains an offline, persistent audit ledger in `.obsidian/plugins/liber-music-player-plugin/history.json`.
- **Single-Source Audio Coordination**: Playing an in-note snippet automatically pauses sidebar playback and vice versa to eliminate conflicting audio streams.

---

## ⌨️ Keyboard Shortcuts

When the player view is active, the following hotkeys are supported:

| Key Binding | Action |
|---|---|
| <kbd>Space</kbd> | Toggle Play / Pause |
| <kbd>↑</kbd> | Previous Track |
| <kbd>↓</kbd> | Next Track |
| <kbd>←</kbd> | Rewind 5 seconds |
| <kbd>→</kbd> | Fast-forward 5 seconds |
| <kbd>Ctrl</kbd> + <kbd>←</kbd> | Rewind 15 seconds |
| <kbd>Ctrl</kbd> + <kbd>→</kbd> | Fast-forward 15 seconds |

---

## 📖 Lyrics Format Specification

Liber Music Player Plugin supports standard timestamped LRC as well as word-by-word syllable karaoke timestamps.

### 1. Standard LRC
```text
[00:12.50]Line 1 lyrics text
[00:15.80]Line 2 lyrics text
[00:20.10]Line 3 lyrics text
```

### 2. Syllable-Level Karaoke
Word timestamps are enclosed within `<mm:ss.xx>` tags following the line timestamp:
```text
[02:23.43]<02:23.43>Here <02:23.65>comes <02:23.83>the <02:24.18>sun <02:24.71>and <02:24.90>it's <02:25.63>alright
[02:26.00]<02:26.00>Little <02:26.28>darling <02:26.68>it's <02:27.02>been <02:27.40>a <02:27.83>long <02:28.68>winter
```

---

## 📦 Installation

### Option 1: Community Plugin Market (Recommended)
1. Open Obsidian **Settings → Community plugins**.
2. Turn off **Restricted mode**.
3. Click **Browse** and search for **Liber Music Player Plugin**.
4. Click **Install**, then **Enable**.

### Option 2: Obsidian42 - BRAT (Beta Releases)
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Community plugins.
2. Open BRAT settings and click **Add Beta plugin**.
3. Enter repository path: `sudh29/liber_music`.
4. Click **Add Plugin** and enable **Liber Music Player Plugin** under Community Plugins.

### Option 3: Manual Installation
1. Download the latest release (`main.js`, `manifest.json`, and `styles.css`) from [GitHub Releases](https://github.com/sudh29/liber_music/releases).
2. Create a folder named `liber-music-player-plugin` in `<YourVault>/.obsidian/plugins/`.
3. Copy the downloaded files into `<YourVault>/.obsidian/plugins/liber-music-player-plugin/`.
4. Reload Obsidian and toggle **Liber Music Player Plugin** on in settings.

---

## ⚙️ Settings Configuration

- **Music Folder Path**: Specify a dedicated vault subfolder (e.g. `Music/` or `Media/Audio`) to scan. Leaving this empty scans the entire vault.
- **Autoplay on Launch**: Automatically resume or start the first track when the player view opens.
- **Autoplay Track**: Pick a specific track to start on launch.
- **Record listening history to Daily Notes**: Automatically logs completed listening sessions to your daily note journal.
- **Daily Notes Section Heading**: Heading title under which song logs are appended (default: `## 🎧 Music Log`).
- **Keep Screen Awake**: Toggle Screen Wake Lock API to prevent device sleep during synchronized karaoke lyric tracking.

---

## 🛠️ Development & Architecture

### Prerequisites
- Node.js (v18.0 or newer recommended, tested on Node 20 & Node 24)
- npm package manager

### Getting Started

```bash
# Clone the repository
git clone https://github.com/sudh29/liber_music.git
cd liber_music

# Install dependencies
npm install

# Start development build with live watch and vault deployment
npm run dev

# Run automated tests (via Vite+)
npm test

# Run Rust-powered linter (via Vite+ & Oxlint)
npm run lint

# Production bundle & typecheck
npm run build
```

### Modernized Tech Stack
- **Language**: TypeScript 5.8+ (Strict mode)
- **UI Framework**: React 18 & Vanilla CSS Design System
- **Toolchain**: **Vite+** (`vp`) for next-generation developer tooling
- **Compiler & Linter**: **Oxc** (`oxc-transform-react` & `vp lint`) for ultra-fast Rust-based parsing, transforms, and linting
- **Test Runner**: **Vitest** via Vite+ (`vp test run`) with 398 passing unit and E2E tests across 51 test suites (92.31% line coverage)
- **Bundler**: **esbuild** with embedded image inlining and mobile Buffer polyfills
- **Metadata Parser**: `music-metadata` (v12.x browser build)
- **Internationalization**: English-only codebase and locale architecture

---

## 🗺️ Strategic Roadmap

For upcoming engineering milestones (Markdown codeblock embeds, Web Audio 10-band EQ, dynamic cover art palette tinting, and smart playlists), see the [Strategic Roadmap](ROADMAP.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).