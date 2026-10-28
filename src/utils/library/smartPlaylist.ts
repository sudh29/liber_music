/**
 * Smart Playlist Evaluation Engine
 * 
 * Provides rule evaluation, query filtering, and sorting for dynamic smart playlists.
 */

import type {
	SmartPlaylistDefinition,
	SmartPlaylistRule,
	SmartRuleField,
	TrackInfo,
} from "@/types/settings";

/**
 * Extracts normalized target value from track metadata and path.
 */
export function extractFieldValue(
	field: SmartRuleField,
	info: TrackInfo,
	path: string
): string | number {
	switch (field) {
		case "title":
			return (info.title || "").trim();
		case "artist":
			return (info.artist || "").trim();
		case "album":
			return (info.album || "").trim();
		case "genre": {
			if (Array.isArray(info.genre)) {
				return info.genre.join(", ").trim();
			}
			return (info.genre || "").trim();
		}
		case "year":
			return typeof info.year === "number" ? info.year : 0;
		case "rating":
			return typeof info.rating === "number" ? info.rating : 0;
		case "duration":
			return typeof info.duration === "number" ? info.duration : 0;
		case "path":
			return path || "";
		default:
			return "";
	}
}

/**
 * Evaluates a single SmartPlaylistRule against track metadata.
 */
export function evaluateRule(
	rule: SmartPlaylistRule,
	info: TrackInfo,
	path: string
): boolean {
	const rawValue = extractFieldValue(rule.field, info, path);

	// Numeric fields
	if (rule.field === "year" || rule.field === "rating" || rule.field === "duration") {
		const numVal = typeof rawValue === "number" ? rawValue : Number(rawValue) || 0;
		const targetNum = typeof rule.value === "number" ? rule.value : Number(rule.value) || 0;

		switch (rule.operator) {
			case "equals":
				return numVal === targetNum;
			case "notEquals":
				return numVal !== targetNum;
			case "greaterThan":
				return numVal > targetNum;
			case "lessThan":
				return numVal < targetNum;
			case "between": {
				const high = typeof rule.secondValue === "number" ? rule.secondValue : Number(rule.secondValue) || targetNum;
				const min = Math.min(targetNum, high);
				const max = Math.max(targetNum, high);
				return numVal >= min && numVal <= max;
			}
			case "contains":
				return String(numVal).includes(String(rule.value));
			case "notContains":
				return !String(numVal).includes(String(rule.value));
			default:
				return false;
		}
	}

	// String fields
	const strVal = String(rawValue).toLowerCase();
	const targetStr = String(rule.value).toLowerCase();

	switch (rule.operator) {
		case "equals":
			return strVal === targetStr;
		case "notEquals":
			return strVal !== targetStr;
		case "contains":
			return strVal.includes(targetStr);
		case "notContains":
			return !strVal.includes(targetStr);
		case "greaterThan":
			return strVal > targetStr;
		case "lessThan":
			return strVal < targetStr;
		case "between":
			return strVal >= targetStr;
		default:
			return false;
	}
}

/**
 * Evaluates a SmartPlaylistDefinition against a list of tracks and returns matching track IDs.
 */
export function evaluateSmartPlaylist(
	def: SmartPlaylistDefinition,
	items: Array<{ id: string; path: string; info: TrackInfo }>
): string[] {
	let matched = items;

	if (def.rules && def.rules.length > 0) {
		matched = items.filter((item) => {
			if (def.matchType === "any") {
				return def.rules.some((rule) => evaluateRule(rule, item.info, item.path));
			}
			// default: 'all'
			return def.rules.every((rule) => evaluateRule(rule, item.info, item.path));
		});
	}

	// Sorting
	if (def.sortBy) {
		const orderMult = def.sortOrder === "desc" ? -1 : 1;
		const sortField = def.sortBy;

		matched.sort((a, b) => {
			const valA = extractFieldValue(sortField, a.info, a.path);
			const valB = extractFieldValue(sortField, b.info, b.path);

			if (typeof valA === "number" && typeof valB === "number") {
				return (valA - valB) * orderMult;
			}
			return String(valA).localeCompare(String(valB), "en", { sensitivity: "base" }) * orderMult;
		});
	}

	// Limit
	const results = def.limit && def.limit > 0 ? matched.slice(0, def.limit) : matched;
	return results.map((i) => i.id);
}

/**
 * Factory helper for standard smart playlist templates
 */
export function createDefaultSmartPlaylistTemplate(
	template: "highRated" | "recent" | "classics" | "longTracks"
): SmartPlaylistDefinition {
	const id = `smart_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

	switch (template) {
		case "highRated":
			return {
				id,
				name: "⭐ High Rated (4+ Stars)",
				matchType: "all",
				rules: [{ id: "r1", field: "rating", operator: "greaterThan", value: 3 }],
				sortBy: "rating",
				sortOrder: "desc",
			};
		case "classics":
			return {
				id,
				name: "📻 Classics (Pre-1990)",
				matchType: "all",
				rules: [
					{ id: "r1", field: "year", operator: "greaterThan", value: 1900 },
					{ id: "r2", field: "year", operator: "lessThan", value: 1990 },
				],
				sortBy: "year",
				sortOrder: "asc",
			};
		case "longTracks":
			return {
				id,
				name: "⏳ Epics & Jams (> 5 min)",
				matchType: "all",
				rules: [{ id: "r1", field: "duration", operator: "greaterThan", value: 300 }],
				sortBy: "duration",
				sortOrder: "desc",
			};
		case "recent":
		default:
			return {
				id,
				name: "✨ New Additions",
				matchType: "all",
				rules: [{ id: "r1", field: "title", operator: "notEquals", value: "" }],
				sortBy: "title",
				sortOrder: "asc",
				limit: 50,
			};
	}
}
