<div align="center">
    <h1>Music Player for Obsidian</h1>
    <p>
        <img src="https://img.shields.io/badge/dynamic/json?logo=obsidian&color=%23483699&label=downloads&query=%24%5B%22music-player%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json" alt="Obsidian Downloads">
        <img src="https://img.shields.io/github/downloads/TracingOrigins/obsidian-music-player-plugin/total?logo=github" alt="GitHub Downloads">
        <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
    </p>
    <p>An audiophile-grade skeuomorphic vinyl music player embedded directly in the Obsidian sidebar. Features local music library management, synchronized karaoke lyrics, playlist controls, and offline-first vault playback.</p>
</div>

---

## 🌟 Key Features

### 🎵 High-Fidelity Audio Playback
- **Broad Format Support**: Plays `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`, and `.aac` audio files.
- **Granular Controls**: Play/pause, track navigation (previous/next), scrubbable progress bar, elapsed and remaining time displays.
- **Playback Speeds**: Adjustable speeds from `0.5x` to `2.0x`.
- **Volume & Mute**: Stepped volume presets (Mute, 25%, 50%, 75%, 100%) and smooth slider controls.
- **Queue Management**: Real-time interactive playback queue with instant track selection and search filtering.

### 🎛️ Playback Modes
- **Sequential**: Plays tracks in listed order and stops when finished.
- **List Loop**: Cycles through the active playlist continuously.
- **Single Loop**: Repeats the current track indefinitely.
- **Shuffle**: Shuffles tracks randomly with zero-repeat queue tracking.

### 📚 Music Library & PKM Organization
- **All Tracks**: Scans and displays all audio assets within your vault or dedicated folder.
- **Favorites**: One-click track favoriting with persistent fast-access lists.
- **Custom Playlists**: Full CRUD management—create, rename, reorder, and delete playlists.
- **Artist & Album Categorization**: Automatic tag extraction and aggregation by artist and album.
- **Instant Search**: Instant fuzzy-matching by title, artist, or album name.

### 🎤 Synchronized Lyrics (LRC & Word-by-Word Karaoke)
- **Tag & Companion Parsing**: Automatically extracts lyrics embedded within metadata tags (ID3/Vorbis) or adjacent `.lrc` companion files in the vault.
- **Standard LRC**: Accurate line-level timestamp synchronization.
- **Karaoke Word-by-Word**: Sub-second highlight synchronization for enhanced sing-along experiences.
- **Dual Display Modes**:
  - **Three-Line Compact View**: Shows previous, current, and upcoming lines on the player record face.
  - **Full-Screen Scrolling View**: Complete scrollable lyric script with active auto-centering and interactive timestamp jumping.

### 🎨 Skeuomorphic Vinyl Record Aesthetics
- **Animated Turntable**: Realistic 60–120 FPS rotating vinyl record with tonearm needle placement animations on play/pause.
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

Music Player supports standard timestamped LRC as well as word-by-word syllable karaoke timestamps.

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
3. Click **Browse** and search for **Music Player**.
4. Click **Install**, then **Enable**.

### Option 2: Obsidian42 - BRAT (Beta Releases)
1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from Community plugins.
2. Open BRAT settings and click **Add Beta plugin**.
3. Enter repository path: `TracingOrigins/obsidian-music-player-plugin`.
4. Click **Add Plugin** and enable **Music Player** under Community Plugins.

### Option 3: Manual Installation
1. Download the latest release (`main.js`, `manifest.json`, and `styles.css`) from [GitHub Releases](https://github.com/TracingOrigins/obsidian-music-player-plugin/releases).
2. Create a folder named `music-player` in `<YourVault>/.obsidian/plugins/`.
3. Copy the downloaded files into `<YourVault>/.obsidian/plugins/music-player/`.
4. Reload Obsidian and toggle **Music Player** on in settings.

---

## ⚙️ Settings Configuration

- **Music Folder Path**: Specify a dedicated vault subfolder (e.g. `Music/` or `Media/Audio`) to scan. Leaving this empty scans the entire vault.
- **Auto-Play on Launch**: Automatically resume or start the first track when the player view opens.
- **Default Playback Mode**: Set your preferred startup mode (`Sequential`, `List Loop`, `Single Loop`, or `Shuffle`).

---

## 🛠️ Development & Architecture

### Prerequisites
- Node.js (v18.0 or newer recommended, tested on Node 20 & Node 24)
- npm package manager

### Getting Started

```bash
# Clone the repository
git clone https://github.com/TracingOrigins/obsidian-music-player-plugin.git
cd obsidian-music-player-plugin

# Install dependencies
npm install

# Start development build with live watch
npm run dev

# Run unit tests
npm test

# Run linter
npm run lint

# Production bundle & typecheck
npm run build
```

### Tech Stack
- **Language**: TypeScript 5.8+ (Strict mode)
- **UI Framework**: React 18 & CSS Modules
- **Bundler**: esbuild with optimized banner and polyfill injection
- **Metadata Parser**: `music-metadata` (v12.x browser build)
- **Test Runner**: Vitest

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).