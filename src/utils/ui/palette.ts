/**
 * Dynamic Accent Palette Extraction (Album Art Theming)
 * 
 * Quantizes album cover pixels to extract dominant, vibrant accent colors,
 * providing real-time dynamic styling variables for the player UI.
 */

export interface PaletteTheme {
	/** Primary vibrant accent color (hex or rgb) */
	primaryAccent: string;
	/** Secondary complementary or harmonic accent color (hex or rgb) */
	secondaryAccent: string;
	/** Surface ambient glow color with alpha transparency (rgba) */
	surfaceGlow: string;
	/** Contrasting text color on top of primary accent */
	textOnAccent: string;

	// Material 3 Dynamic Tonal Tokens
	/** M3 Primary dynamic color */
	mdPrimary?: string;
	/** M3 On-Primary contrasting text/icon color */
	mdOnPrimary?: string;
	/** M3 Primary Container color (subtle tinted container) */
	mdPrimaryContainer?: string;
	/** M3 On-Primary Container text color */
	mdOnPrimaryContainer?: string;
	/** M3 Surface color with ambient tint */
	mdSurface?: string;
	/** M3 Surface Container (slightly elevated card/panel) */
	mdSurfaceContainer?: string;
	/** M3 High-emphasis text color */
	mdOnSurface?: string;
	/** M3 Medium-emphasis text/timestamp color */
	mdOnSurfaceVariant?: string;
	/** M3 Outline/divider color */
	mdOutline?: string;
	/** M3 Subtle outline variant for sliders */
	mdOutlineVariant?: string;
}

export const DEFAULT_PALETTE_THEME: PaletteTheme = {
	primaryAccent: 'var(--interactive-accent, #7f6df2)',
	secondaryAccent: '#5b86e5',
	surfaceGlow: 'rgba(127, 109, 242, 0.35)',
	textOnAccent: '#ffffff',
	mdPrimary: 'var(--interactive-accent, #7f6df2)',
	mdOnPrimary: '#ffffff',
	mdPrimaryContainer: 'rgba(127, 109, 242, 0.16)',
	mdOnPrimaryContainer: 'var(--interactive-accent, #7f6df2)',
	mdSurface: 'transparent',
	mdSurfaceContainer: 'rgba(255, 255, 255, 0.05)',
	mdOnSurface: 'var(--text-normal, #e0e0e0)',
	mdOnSurfaceVariant: 'var(--text-muted, #a0a0a0)',
	mdOutline: 'rgba(127, 109, 242, 0.35)',
	mdOutlineVariant: 'rgba(255, 255, 255, 0.12)',
};

import { LRUMap } from "../data/lruMap";

/**
 * In-memory bounded LRU cache of extracted palettes keyed by cover URL (max 50 entries).
 */
const paletteCache = new LRUMap<string, PaletteTheme>(50);

/**
 * Clears the palette cache (useful in tests).
 */
export function clearPaletteCache(): void {
	paletteCache.clear();
}

/**
 * Gets the current number of cached palette themes (useful in tests).
 */
export function getPaletteCacheSize(): number {
	return paletteCache.size;
}

/**
 * Converts RGB components to HSL.
 */
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;

	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	let h = 0;
	let s = 0;
	const l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}

	return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

/**
 * Computes relative luminance of an RGB color (0.0 to 1.0).
 */
export function getLuminance(r: number, g: number, b: number): number {
	const a = [r, g, b].map((v) => {
		v /= 255;
		return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * (a[0] ?? 0) + 0.7152 * (a[1] ?? 0) + 0.0722 * (a[2] ?? 0);
}

/**
 * Quantizes image pixel buffer and extracts dominant color theme.
 */
export function extractPaletteFromImageData(
	pixels: Uint8ClampedArray | number[],
	width: number,
	height: number
): PaletteTheme {
	const totalPixels = width * height;
	if (!pixels || totalPixels === 0) {
		return { ...DEFAULT_PALETTE_THEME };
	}

	interface ColorBucket {
		r: number;
		g: number;
		b: number;
		h: number;
		s: number;
		l: number;
		count: number;
		vibranceScore: number;
	}

	const buckets: ColorBucket[] = [];

	// Step through pixels in chunks of 4 (RGBA)
	const step = Math.max(1, Math.floor(totalPixels / 256));
	for (let i = 0; i < totalPixels; i += step) {
		const offset = i * 4;
		const r = pixels[offset] ?? 0;
		const g = pixels[offset + 1] ?? 0;
		const b = pixels[offset + 2] ?? 0;
		const a = pixels[offset + 3] ?? 255;

		// Discard transparent pixels
		if (a < 128) continue;

		const [h, s, l] = rgbToHsl(r, g, b);

		// Discard extreme blacks, whites, and low-saturation greys
		if (l < 10 || l > 92 || s < 12) continue;

		// Calculate vibrance score: favored middle lightness and high saturation
		const vibranceScore = (s / 100) * (1 - Math.abs(l - 52) / 60);

		// Group into hue buckets (~24 degree clusters)
		const bucket = buckets.find((b) => Math.abs(b.h - h) < 24 && Math.abs(b.l - l) < 25);
		if (bucket) {
			bucket.count += 1;
			bucket.vibranceScore = Math.max(bucket.vibranceScore, vibranceScore);
		} else {
			buckets.push({ r, g, b, h, s, l, count: 1, vibranceScore });
		}
	}

	if (buckets.length === 0) {
		return { ...DEFAULT_PALETTE_THEME };
	}

	// Sort buckets by combined count and vibrance
	buckets.sort((a, b) => {
		const scoreA = a.count * 0.4 + a.vibranceScore * 100 * 0.6;
		const scoreB = b.count * 0.4 + b.vibranceScore * 100 * 0.6;
		return scoreB - scoreA;
	});

	const primary = buckets[0]!;
	// Find secondary with distinct hue or lightness
	const secondary = buckets.find(
		(b) => Math.abs(b.h - primary.h) > 35 || Math.abs(b.l - primary.l) > 30
	) ?? {
		r: Math.min(255, Math.round(primary.r * 0.8 + 30)),
		g: Math.min(255, Math.round(primary.g * 0.8 + 40)),
		b: Math.min(255, Math.round(primary.b * 1.1 + 40)),
	};

	const lum = getLuminance(primary.r, primary.g, primary.b);
	const textOnAccent = lum > 0.48 ? '#111116' : '#ffffff';
	const primaryColor = `rgb(${primary.r}, ${primary.g}, ${primary.b})`;
	const secondaryColor = `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`;
	const surfaceGlow = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.38)`;
	const primaryContainer = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.18)`;

	// Luminance-boosted primary for dark UI surface contrast (Material 3 Tone 80 radiant parity)
	const lumScale = lum < 0.22 ? Math.min(2.6, 0.44 / Math.max(0.08, lum)) : 1.0;
	const boostedPrimaryR = Math.min(255, Math.round(primary.r * lumScale));
	const boostedPrimaryG = Math.min(255, Math.round(primary.g * lumScale));
	const boostedPrimaryB = Math.min(255, Math.round(primary.b * lumScale));
	const mdPrimaryColor = lum < 0.22 ? `rgb(${boostedPrimaryR}, ${boostedPrimaryG}, ${boostedPrimaryB})` : primaryColor;

	const onPrimaryContainer = lum > 0.48
		? `rgb(${Math.round(primary.r * 0.4)}, ${Math.round(primary.g * 0.4)}, ${Math.round(primary.b * 0.4)})`
		: mdPrimaryColor;
	const surface = `rgba(${Math.round(primary.r * 0.08)}, ${Math.round(primary.g * 0.08)}, ${Math.round(primary.b * 0.08 + 10)}, 0.95)`;
	const surfaceContainer = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.08)`;
	const onSurface = `var(--text-normal, #e0e0e0)`;
	const onSurfaceVariant = `rgba(${Math.min(255, Math.round(primary.r * 0.3 + 160))}, ${Math.min(255, Math.round(primary.g * 0.3 + 160))}, ${Math.min(255, Math.round(primary.b * 0.3 + 170))}, 0.85)`;
	const outline = `rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.35)`;
	const outlineVariant = `rgba(255, 255, 255, 0.12)`;

	return {
		primaryAccent: primaryColor,
		secondaryAccent: secondaryColor,
		surfaceGlow,
		textOnAccent,
		mdPrimary: mdPrimaryColor,
		mdOnPrimary: textOnAccent,
		mdPrimaryContainer: primaryContainer,
		mdOnPrimaryContainer: onPrimaryContainer,
		mdSurface: surface,
		mdSurfaceContainer: surfaceContainer,
		mdOnSurface: onSurface,
		mdOnSurfaceVariant: onSurfaceVariant,
		mdOutline: outline,
		mdOutlineVariant: outlineVariant,
	};
}

/**
 * Asynchronously extracts palette theme from an image URL.
 * Falls back to default theme on error, timeout, or tainted canvas.
 */
export async function extractPaletteFromImageUrl(
	url?: string,
	timeoutMs = 1500
): Promise<PaletteTheme> {
	if (!url || typeof url !== 'string' || !url.trim()) {
		return { ...DEFAULT_PALETTE_THEME };
	}

	const cached = paletteCache.get(url);
	if (cached) {
		return cached;
	}

	if (typeof document === 'undefined') {
		return { ...DEFAULT_PALETTE_THEME };
	}

	return new Promise<PaletteTheme>((resolve) => {
		let isResolved = false;
		const timer = window.setTimeout(() => {
			if (!isResolved) {
				isResolved = true;
				resolve({ ...DEFAULT_PALETTE_THEME });
			}
		}, timeoutMs);

		const img = new Image();
		img.crossOrigin = 'anonymous';

		img.onload = () => {
			if (isResolved) return;
			isResolved = true;
			window.clearTimeout(timer);

			try {
				const canvas = createEl("canvas");
				canvas.width = 24;
				canvas.height = 24;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					resolve({ ...DEFAULT_PALETTE_THEME });
					return;
				}

				ctx.drawImage(img, 0, 0, 24, 24);
				const imageData = ctx.getImageData(0, 0, 24, 24);
				const theme = extractPaletteFromImageData(imageData.data, 24, 24);
				paletteCache.set(url, theme);
				resolve(theme);
			} catch {
				// CORS/tainted canvas fallback
				resolve({ ...DEFAULT_PALETTE_THEME });
			}
		};

		img.onerror = () => {
			if (!isResolved) {
				isResolved = true;
				window.clearTimeout(timer);
				resolve({ ...DEFAULT_PALETTE_THEME });
			}
		};

		img.src = url;
	});
}

/**
 * Applies or removes dynamic palette CSS properties on a DOM element.
 */
export function applyPaletteTheme(
	element: HTMLElement | null,
	theme: PaletteTheme | null,
	enabled: boolean
): void {
	if (!element || !element.style) return;

	if (!enabled || !theme) {
		element.style.removeProperty('--player-dynamic-accent');
		element.style.removeProperty('--player-dynamic-secondary');
		element.style.removeProperty('--player-dynamic-glow');
		element.style.removeProperty('--player-karaoke-highlight');
		element.style.removeProperty('--player-text-on-accent');
		element.style.removeProperty('--md-sys-color-primary');
		element.style.removeProperty('--md-sys-color-on-primary');
		element.style.removeProperty('--md-sys-color-primary-container');
		element.style.removeProperty('--md-sys-color-on-primary-container');
		element.style.removeProperty('--md-sys-color-surface');
		element.style.removeProperty('--md-sys-color-surface-container');
		element.style.removeProperty('--md-sys-color-on-surface');
		element.style.removeProperty('--md-sys-color-on-surface-variant');
		element.style.removeProperty('--md-sys-color-outline');
		element.style.removeProperty('--md-sys-color-outline-variant');
		return;
	}

	element.style.setProperty('--player-dynamic-accent', theme.primaryAccent);
	element.style.setProperty('--player-dynamic-secondary', theme.secondaryAccent);
	element.style.setProperty('--player-dynamic-glow', theme.surfaceGlow);
	element.style.setProperty('--player-karaoke-highlight', theme.primaryAccent);
	element.style.setProperty('--player-text-on-accent', theme.textOnAccent);
	element.style.setProperty('--md-sys-color-primary', theme.mdPrimary ?? theme.primaryAccent);
	element.style.setProperty('--md-sys-color-on-primary', theme.mdOnPrimary ?? theme.textOnAccent);
	element.style.setProperty('--md-sys-color-primary-container', theme.mdPrimaryContainer ?? theme.surfaceGlow);
	element.style.setProperty('--md-sys-color-on-primary-container', theme.mdOnPrimaryContainer ?? theme.primaryAccent);
	element.style.setProperty('--md-sys-color-surface', theme.mdSurface ?? 'transparent');
	element.style.setProperty('--md-sys-color-surface-container', theme.mdSurfaceContainer ?? 'rgba(255, 255, 255, 0.05)');
	element.style.setProperty('--md-sys-color-on-surface', theme.mdOnSurface ?? 'var(--text-normal)');
	element.style.setProperty('--md-sys-color-on-surface-variant', theme.mdOnSurfaceVariant ?? 'var(--text-muted)');
	element.style.setProperty('--md-sys-color-outline', theme.mdOutline ?? theme.secondaryAccent);
	element.style.setProperty('--md-sys-color-outline-variant', theme.mdOutlineVariant ?? 'rgba(255, 255, 255, 0.12)');
}
