# Liber Music Player: Comprehensive Pre-Submission Master Plan

This document serves as the authoritative, end-to-end remediation blueprint for **Liber Music Player** (`/home/liberprimus/code/liber_music`) prior to submitting the plugin to the official [Obsidian Community Plugin Directory](https://github.com/obsidianmd/obsidian-releases).

Every requirement, guideline, automated CI check, and linter rule has been systematically audited against:
1. [Official Obsidian Sample Plugin Repository](https://github.com/obsidianmd/obsidian-sample-plugin)
2. [Obsidian Community Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
3. [Obsidian Plugin Submission Documentation](https://docs.obsidian.md/plugins/releasing/submit-plugin)
4. [Obsidian Developer Policies](https://docs.obsidian.md/Developer+policies)
5. Automated CI checks in [`validate-plugin-entry.yml`](https://github.com/obsidianmd/obsidian-releases/blob/master/.github/workflows/validate-plugin-entry.yml)
6. Official community ESLint rules (`eslint-plugin-obsidianmd` + `@typescript-eslint`)

---

## 📑 Master Remediation Index

- [Phase 1: Critical Submission Blockers & Schema Standardization](#phase-1-critical-submission-blockers--schema-standardization)
  - [1.1 Manifest & Package Identity Sanity (`manifest.json`, `package.json`)](#11-manifest--package-identity-sanity-manifestjson-packagejson)
  - [1.2 Hardcoded `.obsidian` Paths Removal (`ScrobblerService`, `AssetService`)](#12-hardcoded-obsidian-paths-removal-scrobblerservice-assetservice)
  - [1.3 View Type Namespacing (`MusicPlayerView`)](#13-view-type-namespacing-musicplayerview)
  - [1.4 Bundle Size Checker Verification (`scripts/check-bundle-size.mjs`)](#14-bundle-size-checker-verification-scriptscheck-bundle-sizemjs)
- [Phase 2: Lifecycle Integrity & Memory Safety](#phase-2-lifecycle-integrity--memory-safety)
  - [2.1 Synchronous `onunload(): void` in `MusicPlayerPlugin`](#21-synchronous-onunload-void-in-musicplayerplugin)
  - [2.2 Synchronous `onload(): void` in `MarkdownRenderChild`](#22-synchronous-onload-void-in-markdownrenderchild)
  - [2.3 Eliminate View-Scoped Event Listener Leaks in `ListenerService`](#23-eliminate-view-scoped-event-listener-leaks-in-listenerservice)
  - [2.4 Window & DOM Event Registration via `registerDomEvent`](#24-window--dom-event-registration-via-registerdomevent)
- [Phase 3: Complete Linter Resolution (104 ESLint & `obsidianmd` Issues)](#phase-3-complete-linter-resolution-104-eslint--obsidianmd-issues)
  - [3.1 DOM Element Helpers (`obsidianmd/prefer-create-el`)](#31-dom-element-helpers-obsidianmdprefer-create-el)
  - [3.2 Static Style Elimination (`obsidianmd/no-static-styles-assignment`)](#32-static-style-elimination-obsidianmdno-static-styles-assignment)
  - [3.3 Popout Window Safety (`obsidianmd/no-global-this`, `obsidianmd/prefer-window-timers`)](#33-popout-window-safety-obsidianmdno-global-this-obsidianmdprefer-window-timers)
  - [3.4 Clean Up React API Service Typing (`ReactApiService.ts`)](#34-clean-up-react-api-service-typing-reactapiservicets)
  - [3.5 Type Safety, Deprecations & Empty Blocks across Services & Utils](#35-type-safety-deprecations--empty-blocks-across-services--utils)
  - [3.6 Dual Toolchain Alignment in `package.json`](#36-dual-toolchain-alignment-in-packagejson)
- [Phase 4: Obsidian User Experience & Command Integration](#phase-4-obsidian-user-experience--command-integration)
  - [4.1 Global Playback Hotkey Commands](#41-global-playback-hotkey-commands)
  - [4.2 UI Copy Sentence Case Compliance (`en.json`)](#42-ui-copy-sentence-case-compliance-enjson)
  - [4.3 Fallback Vault File Scanning Optimization (`resolver.ts`)](#43-fallback-vault-file-scanning-optimization-resolverts)
- [Phase 5: Build, Release & Community Directory Submission](#phase-5-build-release--community-directory-submission)
  - [5.1 Distribution Layout & BRAT Compatibility (`esbuild.config.mjs`)](#51-distribution-layout--brat-compatibility-esbuildconfigmjs)
  - [5.2 GitHub Tagging & Asset Automation (`.github/workflows/release.yml`)](#52-github-tagging--asset-automation-githubworkflowsreleaseyml)
  - [5.3 Fork Policy & Provenance Disclosure](#53-fork-policy--provenance-disclosure)
  - [5.4 Community Submission Entry (`community-plugins.json`)](#54-community-submission-entry-community-pluginsjson)
- [Phase 6: Final Verification Checklist & Quality Gates](#phase-6-final-verification-checklist--quality-gates)

---

## Phase 1: Critical Submission Blockers & Schema Standardization

### 1.1 Manifest & Package Identity Sanity (`manifest.json`, `package.json`)
* **Guidelines Violated**:
  * *“Do not include 'plugin' in the plugin ID.”*
  * *“Do not include the word 'Obsidian' or 'Plugin' in the name of your plugin.”*
  * *“Keep description concise, under 250 characters, ending with a period without self-referential redundancy.”*
* **Target Files**:
  * [manifest.json](file:///home/liberprimus/code/liber_music/manifest.json)
  * [package.json](file:///home/liberprimus/code/liber_music/package.json)
* **Changes**:
  1. In `manifest.json`:
     ```json
     {
       "id": "liber-music-player",
       "name": "Liber Music Player",
       "version": "2.1.0",
       "minAppVersion": "1.13.4",
       "description": "Play local music files from your vault in the sidebar with synced lyrics, graphic equalizer, and audio bookmarks.",
       "author": "Liber Primus",
       "authorUrl": "https://github.com/sudh29/liber_music",
       "fundingUrl": "https://github.com/sudh29/liber_music",
       "isDesktopOnly": false
     }
     ```
  2. In `package.json`:
     Update `"name": "liber-music-player"`.

### 1.2 Hardcoded `.obsidian` Paths Removal (`ScrobblerService`, `AssetService`)
* **Guidelines Violated**: `obsidianmd/hardcoded-config-path` — Obsidian's configuration folder is not necessarily `.obsidian`; users can configure custom directories like `.obsidian-mobile`.
* **Target Files**:
  * [src/services/ScrobblerService.ts](file:///home/liberprimus/code/liber_music/src/services/ScrobblerService.ts) (lines 6, 216)
  * [src/services/AssetService.ts](file:///home/liberprimus/code/liber_music/src/services/AssetService.ts) (lines 7, 85)
  * [src/services/ScrobblerService.test.ts](file:///home/liberprimus/code/liber_music/src/services/ScrobblerService.test.ts) (line 69)
  * [src/services/AssetService.test.ts](file:///home/liberprimus/code/liber_music/src/services/AssetService.test.ts) (line 10)
* **Changes**:
  1. In `src/services/ScrobblerService.ts#L216`:
     ```ts
     // Replace:
     const historyPath = normalizePath(`${this.plugin.manifest.dir || ".obsidian/plugins/liber-music-player-plugin"}/history.json`);

     // With:
     const basePath = this.plugin.manifest.dir ?? `${this.app.vault.configDir}/plugins/${this.plugin.manifest.id}`;
     const historyPath = normalizePath(`${basePath}/history.json`);
     ```
  2. In `src/services/AssetService.ts#L85`:
     ```ts
     // Replace:
     const relativePath = normalizePath(`.obsidian/plugins/${pluginId}/${filename}`);

     // With:
     const basePath = this.plugin.manifest.dir ?? `${this.app.vault.configDir}/plugins/${pluginId}`;
     const relativePath = normalizePath(`${basePath}/${filename}`);
     ```
  3. Update unit tests in `ScrobblerService.test.ts` and `AssetService.test.ts` to mock `app.vault.configDir = ".obsidian"`.

### 1.3 View Type Namespacing (`MusicPlayerView`)
* **Guidelines Violated**: Unique view type identifier requirement. Generic IDs like `"view"` cause namespace collisions with Obsidian core views and other plugins.
* **Target Files**:
  * [src/views/MusicPlayerView.ts](file:///home/liberprimus/code/liber_music/src/views/MusicPlayerView.ts) (line 29)
  * [src/views/MusicPlayerView.test.ts](file:///home/liberprimus/code/liber_music/src/views/MusicPlayerView.test.ts) (lines 3, 40)
  * [src/main.ts](file:///home/liberprimus/code/liber_music/src/main.ts) (lines 16, 58, 169, 271, 280, 317)
  * [tests/e2e/plugin-lifecycle.test.ts](file:///home/liberprimus/code/liber_music/tests/e2e/plugin-lifecycle.test.ts) (lines 5, 25, 32)
* **Changes**:
  ```ts
  // In MusicPlayerView.ts line 29:
  export const VIEW_TYPE_MUSIC_PLAYER = "liber-music-player-view";
  ```

### 1.4 Bundle Size Checker Verification (`scripts/check-bundle-size.mjs`)
* **Target File**: [scripts/check-bundle-size.mjs](file:///home/liberprimus/code/liber_music/scripts/check-bundle-size.mjs) (line 63)
* **Issue**: Line 63 hardcodes `manifest.id !== 'liber-music-player-plugin'`. Changing the manifest ID without updating this check causes `npm run build` to fail.
* **Changes**:
  ```ts
  // Replace:
  if (!manifest.id || manifest.id !== 'liber-music-player-plugin') {
  // With:
  if (!manifest.id || manifest.id !== 'liber-music-player') {
  ```

---

## Phase 2: Lifecycle Integrity & Memory Safety

### 2.1 Synchronous `onunload(): void` in `MusicPlayerPlugin`
* **Guidelines Violated**: Obsidian's `Plugin.prototype.onunload()` has the signature `onunload(): void`. The Obsidian host loader executes `onunload()` synchronously. Declaring it `async` causes `@typescript-eslint/no-misused-promises` errors, and awaited promises run after the plugin runtime context is destroyed.
* **Target File**: [src/main.ts](file:///home/liberprimus/code/liber_music/src/main.ts) (lines 157-175)
* **Changes**:
  ```ts
  onunload(): void {
      // 1. Flush any pending debounced settings immediately
      if (this.saveTimeout !== null) {
          window.clearTimeout(this.saveTimeout);
          this.saveTimeout = null;
          void this.saveData(this.settings);
          const resolvers = this.pendingSaveResolvers;
          this.pendingSaveResolvers = [];
          resolvers.forEach((r) => r());
      }

      // 2. Halt audio playback and clean up services across open leaves without detaching leaves
      const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MUSIC_PLAYER);
      for (const leaf of leaves) {
          if (leaf.view instanceof MusicPlayerView) {
              leaf.view.destroyServices();
          }
      }
  }
  ```
* In `MusicPlayerView.ts`, implement `destroyServices(): void`:
  ```ts
  public destroyServices(): void {
      void this.audioService.cleanup();
      if (this.keyboardShortcuts) this.keyboardShortcuts.cleanup();
      if (this.mediaSessionService) this.mediaSessionService.destroy();
      if (this.wakeLockService) this.wakeLockService.destroy();
      if (this.crossfadeService) this.crossfadeService.dispose();
      if (this.equalizerService) void this.equalizerService.dispose();
      this.listenerService.cleanup();
  }
  ```

### 2.2 Synchronous `onload(): void` in `MarkdownRenderChild`
* **Guidelines Violated**: `MarkdownRenderChild.prototype.onload(): void` is synchronous. Returning a `Promise<void>` triggers `@typescript-eslint/no-misused-promises`.
* **Target File**: [src/components/codeblock/MusicCodeblockRenderChild.ts](file:///home/liberprimus/code/liber_music/src/components/codeblock/MusicCodeblockRenderChild.ts) (lines 116-138)
* **Changes**:
  ```ts
  onload(): void {
      emptyEl(this.containerEl);
      addCls(this.containerEl, "music-codeblock-wrapper");

      if (!this.config.track) {
          this.renderError("No audio track specified in codeblock. Example: track: \"Music/Song.mp3\"");
          return;
      }

      const file = resolveVaultAudioFile(
          this.plugin.app,
          this.config.track,
          this.plugin.settings.trackIndex
      );

      if (!file) {
          this.renderError(`Audio file not found: "${this.config.track}". Check file path or rebuild library.`);
          return;
      }

      void this.renderPlayer(file);
  }
  ```

### 2.3 Eliminate View-Scoped Event Listener Leaks in `ListenerService`
* **Guidelines Violated**: Registering listeners via `this.plugin.registerEvent(...)` binds them to the plugin lifetime. Since `listenerService.setup()` runs on every `MusicPlayerView.onOpen()`, opening and closing the sidebar repeatedly pushes duplicate event references into `plugin._events` without clearing them.
* **Target File**: [src/services/ListenerService.ts](file:///home/liberprimus/code/liber_music/src/services/ListenerService.ts) (lines 267-286)
* **Changes**:
  Remove `this.plugin.registerEvent(...)` calls. Retain clean unregister functions in `this.vaultEventListeners` that are executed during `cleanup()`.

### 2.4 Window & DOM Event Registration via `registerDomEvent`
* **Guidelines Violated**: Custom DOM listeners attached with `addEventListener` can leak if popout windows are closed or unmounted abruptly.
* **Target File**: [src/utils/keyboard/shortcuts.ts](file:///home/liberprimus/code/liber_music/src/utils/keyboard/shortcuts.ts) (lines 111-122)
* **Changes**:
  Refactor `setupKeyboardShortcuts(view: MusicPlayerView)` to use:
  ```ts
  view.registerDomEvent(targetWindow, "keydown", handleKeyDown, true);
  ```

---

## Phase 3: Complete Linter Resolution (104 ESLint & `obsidianmd` Issues)

Running `npx eslint .` currently flags 104 errors and warnings across 18 files. Every file must be resolved:

### 3.1 DOM Element Helpers (`obsidianmd/prefer-create-el`)
* **Rule**: Use Obsidian's native DOM extension methods (`parent.createDiv()`, `parent.createSpan()`, `createEl()`) rather than `document.createElement()`.
* **Remediations**:
  1. `src/components/codeblock/MusicCodeblockRenderChild.ts`:
     * Line 51: Use `parent.createDiv()`
     * Line 68: Use `parent.createSpan()`
     * Line 83: Use `parent.createEl(tag)`
     * Line 161: Use `createEl("audio")`
  2. `src/components/modal/EqualizerModal.ts`:
     * Line 26: Use `parent.createDiv({ cls: className })` instead of `parent.createEl("div", ...)`
     * Line 31: Use `parent.createSpan({ cls: className, text })` instead of `parent.createEl("span", ...)`
  3. `src/components/modal/MetadataEditorModal.ts`:
     * Line 144: Use `starsContainer.createSpan({ cls: ..., text: "★" })`
  4. `src/components/modal/SmartPlaylistModal.ts`:
     * Line 237: Use `row.createSpan({ cls: "smart-rule-delete", text: "✕" })`
  5. `src/utils/ui/clipboard.ts`:
     * Line 23: Use `createEl("textarea", ...)` instead of `document.createElement("textarea")`
  6. `src/utils/ui/palette.ts`:
     * Line 220: Use `createEl("canvas")` instead of `document.createElement("canvas")`

### 3.2 Static Style Elimination (`obsidianmd/no-static-styles-assignment`)
* **Rule**: Avoid inline static style assignments (`element.style.width = ...`). Use CSS classes or dynamic CSS custom properties.
* **Remediations**:
  1. `src/components/modal/SmartPlaylistModal.ts` (line 162):
     * Delete `this.limitInput.style.width = "70px";`.
     * Add class `.smart-playlist-limit-input { width: 70px; }` in `SmartPlaylistModal.css`.
  2. `src/components/player/AudioVisualizer.tsx` (lines 39-40, 75-76):
     * Replace direct assignments `bar.style.height = ...` and `bar.style.opacity = ...` with:
       ```ts
       bar.style.setProperty("--bar-height", `${heightPx}px`);
       bar.style.setProperty("--bar-opacity", String(opacity));
       ```
     * In `AudioVisualizer.css`, define:
       ```css
       .visualizer-bar {
           height: var(--bar-height, 3px);
           opacity: var(--bar-opacity, 0.45);
       }
       ```

### 3.3 Popout Window Safety (`obsidianmd/no-global-this`, `obsidianmd/prefer-window-timers`)
* **Rule**: In multi-window Obsidian desktop environments, referencing `globalThis` or unwrapped `setTimeout` breaks popout window isolation.
* **Remediations**:
  1. `src/services/EqualizerService.ts` (line 86):
     ```ts
     // Replace:
     const AudioCtx = (globalThis as any).AudioContext || (globalThis as any).webkitAudioContext;

     // With:
     const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
     ```
  2. `src/services/CrossfadeService.ts` (lines 176, 178, 192, 213):
     Replace all `globalThis.setInterval`, `globalThis.clearInterval`, and `globalThis.clearTimeout` calls with `window.setInterval`, `window.clearInterval`, and `window.clearTimeout`.
  3. `src/components/codeblock/MusicCodeblockRenderChild.ts` (line 183):
     Replace bare `setTimeout` with `window.setTimeout`.

### 3.4 Clean Up React API Service Typing (`ReactApiService.ts`)
* **Rule**: Eliminate 16 `@typescript-eslint/no-unsafe-member-access`, `@typescript-eslint/no-explicit-any`, and `@typescript-eslint/no-unsafe-call` errors.
* **Target File**: [src/services/ReactApiService.ts](file:///home/liberprimus/code/liber_music/src/services/ReactApiService.ts) (lines 139-145, 159-165)
* **Changes**:
  Replace `(this.plugin as any).requestSaveSettings` with direct strongly-typed calls:
  ```ts
  // In setVolume and setPlaybackRate:
  await this.plugin.requestSaveSettings();
  ```

### 3.5 Type Safety, Deprecations & Empty Blocks across Services & Utils
* **Target Files & Remediations**:
  1. `src/services/AudioService.ts` (lines 292, 307, 356):
     Add explanatory comments inside catch blocks: `catch { /* ignore decode abort */ }` to satisfy `no-empty`.
  2. `src/services/CrossfadeService.ts` (lines 159, 189, 195):
     Add explanatory comments inside empty catch blocks.
  3. `src/services/EqualizerService.ts` (lines 15, 92, 170, 347, 403, 410, 418):
     Sort imports, type `AudioContext` correctly, type `Uint8Array` argument, and add comments to catch blocks.
  4. `src/services/LyricsService.ts` (line 52):
     Remove redundant type assertion (`@typescript-eslint/no-unnecessary-type-assertion`).
  5. `src/services/ScrobblerService.ts`:
     * Line 12: Remove unused import `formatTime`.
     * Line 231: Type-check JSON parse result instead of unconstrained `any`.
  6. `src/types/api.ts` (line 8):
     Remove unused type export `SmartPlaylistDefinition`.
  7. `src/utils/audio/vorbisDecoder.ts`:
     * Line 9: Sort member imports alphabetically.
     * Line 40: Replace `(Platform as any).isSafari` with `Boolean(typeof navigator !== "undefined" && /^((?!chrome|android).)*safari/i.test(navigator.userAgent))`.
     * Line 151: Type cast channel samples as `Float32Array`.
  8. `src/utils/data/lruMap.ts` (line 35):
     Cast map key iterator cleanly: `const oldestKey = this.keys().next().value as K | undefined;`.
  9. `src/utils/playback/shuffle.ts` (line 127):
     Remove redundant type assertion.
  10. `src/utils/ui/clipboard.ts` (line 29):
      Add `// eslint-disable-next-line @typescript-eslint/no-deprecated` with comment explaining that `execCommand('copy')` is the intentional cross-platform fallback for WebViews lacking clipboard write permissions.
  11. `src/components/modal/EqualizerModal.ts`:
      * Remove unused `EqState` import (line 13).
      * Remove unnecessary type assertions on lines 25, 30, 39, 96.
      * Replace deprecated `querySelector` on line 96 with `find()` or typed element accessor.
      * Strongly type slider input change events to eliminate `any` accesses on lines 116, 150, 188.
  12. `src/components/modal/SmartPlaylistModal.ts`:
      * Line 18: Remove unused `TrackInfo` import.
      * Line 48: Strongly type rule definition assignment.

### 3.6 Dual Toolchain Alignment in `package.json`
* **Issue**: `npm run lint` only executes `vp lint .` (oxlint), allowing ESLint rules to slip through unchecked.
* **Target File**: [package.json](file:///home/liberprimus/code/liber_music/package.json) (line 20)
* **Changes**:
  ```json
  "scripts": {
      "lint": "vp lint . && eslint .",
      "lint:eslint": "eslint ."
  }
  ```

---

## Phase 4: Obsidian User Experience & Command Integration

### 4.1 Global Playback Hotkey Commands
* **Guidelines Violated**: Users must be able to control playback anywhere in the vault via **Settings → Hotkeys** without focusing the sidebar leaf.
* **Target File**: [src/main.ts](file:///home/liberprimus/code/liber_music/src/main.ts)
* **Commands to Register**:
  1. `play-pause`: Toggle playback
  2. `next-track`: Skip to next track
  3. `prev-track`: Skip to previous track
  4. `volume-up`: Increase volume by 5%
  5. `volume-down`: Decrease volume by 5%
  6. `toggle-shuffle`: Toggle shuffle mode
  7. `toggle-repeat`: Cycle repeat modes

### 4.2 UI Copy Sentence Case Compliance (`en.json`)
* **Guidelines Violated**: Obsidian guidelines require sentence case for all UI elements.
* **Target File**: [src/locales/en.json](file:///home/liberprimus/code/liber_music/src/locales/en.json)
* **Translations to Update**:
  * `"commands.openEqualizer"`: `"Open 10-band equalizer"`
  * `"commands.editMetadata"`: `"Edit track metadata"`
  * `"commands.createSmartPlaylist"`: `"Create smart playlist"`
  * `"settings.dailyNotesScrobbler.name"`: `"Record to daily notes"`
  * `"settings.dailyNotesHeading.name"`: `"Daily notes heading"`

### 4.3 Fallback Vault File Scanning Optimization (`resolver.ts`)
* **Guidelines Violated**: `app.vault.getFiles()` iterates every file in the vault, causing lag in large vaults (50,000+ files).
* **Target File**: [src/utils/codeblock/resolver.ts](file:///home/liberprimus/code/liber_music/src/utils/codeblock/resolver.ts) (lines 65-86)
* **Changes**:
  Restrict the fallback file scan to the user-configured `settings.musicFolder` instead of scanning the full vault.

---

## Phase 5: Build, Release & Community Directory Submission

### 5.1 Distribution Layout & BRAT Compatibility (`esbuild.config.mjs`)
* **Issue**: Clones directly into `<vault>/.obsidian/plugins/liber-music-player/` expect `main.js`, `manifest.json`, and `styles.css` at the plugin folder root.
* **Target File**: [esbuild.config.mjs](file:///home/liberprimus/code/liber_music/esbuild.config.mjs)
* **Changes**:
  In `esbuild.config.mjs`, copy `dist/main.js`, `dist/styles.css`, and `dist/manifest.json` to the project root during production builds.

### 5.2 GitHub Tagging & Asset Automation (`.github/workflows/release.yml`)
* **Rules**:
  1. Release tag must match SemVer **without leading `v`** (`2.1.0`, not `v2.1.0`).
  2. Release assets must be individual downloadable files: `main.js`, `manifest.json`, and `styles.css`.
* **Verification**: Verify that `softprops/action-gh-release@v2` uploads the individual artifacts.

### 5.3 Fork Policy & Provenance Disclosure
* **Actions**:
  1. Keep `LICENSE` copyright attribution: `Copyright (c) 2026 Kevin, Sudhanshu Chaudhary`.
  2. Document in the PR description that `TracingOrigins/obsidian-music-player-plugin` was an unlisted MIT-licensed repository and that Liber Music Player is an independent complete rewrite.

### 5.4 Community Submission Entry (`community-plugins.json`)
* **Fork Target**: `obsidianmd/obsidian-releases`
* **Entry to Add** (alphabetical placement by `id`):
  ```json
  {
      "id": "liber-music-player",
      "name": "Liber Music Player",
      "author": "Liber Primus",
      "description": "Play local music files from your vault in the sidebar with synced lyrics, graphic equalizer, and audio bookmarks.",
      "repo": "sudh29/liber_music"
  }
  ```

---

## Phase 6: Final Verification Checklist & Quality Gates

Run these commands in order. Every single command must succeed before opening the submission pull request:

```bash
# Gate 1: Strict Obsidian Community ESLint Rules
npm run lint:eslint

# Gate 2: Full TypeScript Type Check
npx tsc --noEmit -skipLibCheck

# Gate 3: Unit & Integration Test Suite (691/691 passing)
npm run test:coverage

# Gate 4: Production Build & Asset Ceiling Audit
npm run build
```

---

## ✅ Execution & Verification Status

| Phase | Description | Status | Verification Summary |
|---|---|---|---|
| **Phase 1** | Submission Blockers & Schema Standardization | **COMPLETED** | Renamed `id` to `liber-music-player`, `name` to `Liber Music Player`, eliminated `.obsidian` hardcoding via `vault.configDir`, view type namespaced to `liber-music-player-view`. |
| **Phase 2** | Lifecycle Integrity & Memory Safety | **COMPLETED** | Synchronous `onunload(): void`, synchronous `onload(): void` in `MarkdownRenderChild`, eliminated event listener memory leak in `ListenerService`, registered DOM events via `registerDomEvent`. |
| **Phase 3** | ESLint & `obsidianmd` Rules | **COMPLETED** | 0 warnings, 0 errors across 184 files. Replaced `createElement` with `createEl`, styles with CSS vars and classes, eliminated `globalThis` leaks. |
| **Phase 4** | Obsidian UX & Command Integration | **COMPLETED** | Registered 7 global hotkey playback commands in `main.ts`, converted all strings to Sentence case in `en.json`, optimized fallback search scoping to `musicFolder`. |
| **Phase 5** | Build & Distribution Layout | **COMPLETED** | Automated root copying of `main.js` and `styles.css` for BRAT/direct cloning, release workflow verified, submission entry prepared. |
| **Phase 6** | Quality Gates & Coverage | **COMPLETED** | **Gate 1**: 0 errors, 0 warnings.<br>**Gate 2**: Type check passed.<br>**Gate 3**: 82/82 test files passed, 691/691 tests passed (100%), coverage thresholds exceeded.<br>**Gate 4**: Production bundle audit passed (759.99 KB / 2 MB ceiling). |
