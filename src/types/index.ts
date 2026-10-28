/**
 * Unified type definitions export
 * 
 * Centralized exports for all type definitions:
 * - Settings types
 * - Playback types
 * - Library types
 * - API contract types
 */

// Settings types
export type {
	MusicPlayerSettings,
	TrackInfo,
	SmartRuleField,
	SmartRuleOperator,
	SmartPlaylistRule,
	SmartPlaylistDefinition,
} from './settings';
export { DEFAULT_SETTINGS } from './settings';
export type { PlayMode } from '../main';

// React component types
export type { ReactPlaybackSnapshot } from './playback';
export type { ReactTrackInfo, ReactPlaylistGroup, ReactLibrarySnapshot } from './library';
export type { ReactApi } from './api';
