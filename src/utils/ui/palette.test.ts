// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	DEFAULT_PALETTE_THEME,
	applyPaletteTheme,
	clearPaletteCache,
	extractPaletteFromImageData,
	extractPaletteFromImageUrl,
	getLuminance,
	rgbToHsl,
} from './palette';

describe('palette extraction and theming', () => {
	beforeEach(() => {
		clearPaletteCache();
	});

	describe('rgbToHsl', () => {
		it('should convert pure red correctly', () => {
			const [h, s, l] = rgbToHsl(255, 0, 0);
			expect(h).toBe(0);
			expect(s).toBe(100);
			expect(l).toBe(50);
		});

		it('should convert pure green correctly', () => {
			const [h, s, l] = rgbToHsl(0, 255, 0);
			expect(h).toBe(120);
			expect(s).toBe(100);
			expect(l).toBe(50);
		});

		it('should convert pure blue correctly', () => {
			const [h, s, l] = rgbToHsl(0, 0, 255);
			expect(h).toBe(240);
			expect(s).toBe(100);
			expect(l).toBe(50);
		});

		it('should convert neutral grey with zero saturation', () => {
			const [h, s, l] = rgbToHsl(128, 128, 128);
			expect(h).toBe(0);
			expect(s).toBe(0);
			expect(l).toBe(50);
		});
	});

	describe('getLuminance', () => {
		it('should return near 1.0 for white and near 0.0 for black', () => {
			expect(getLuminance(255, 255, 255)).toBeCloseTo(1.0, 1);
			expect(getLuminance(0, 0, 0)).toBeCloseTo(0.0, 1);
		});
	});

	describe('extractPaletteFromImageData', () => {
		it('should return default palette for empty or zero-size pixels', () => {
			const theme = extractPaletteFromImageData(new Uint8ClampedArray(0), 0, 0);
			expect(theme).toEqual(DEFAULT_PALETTE_THEME);
		});

		it('should return default palette if all pixels are black or grey', () => {
			// 4x4 black image
			const pixels = new Uint8ClampedArray(4 * 4 * 4);
			for (let i = 0; i < pixels.length; i += 4) {
				pixels[i] = 10;
				pixels[i + 1] = 10;
				pixels[i + 2] = 10;
				pixels[i + 3] = 255;
			}
			const theme = extractPaletteFromImageData(pixels, 4, 4);
			expect(theme).toEqual(DEFAULT_PALETTE_THEME);
		});

		it('should extract vibrant primary and secondary colors from image data', () => {
			// 8x8 image with purple and gold pixels
			const pixels = new Uint8ClampedArray(8 * 8 * 4);
			for (let i = 0; i < pixels.length; i += 4) {
				if (i < 32 * 4) {
					// Purple (r: 160, g: 50, b: 220)
					pixels[i] = 160;
					pixels[i + 1] = 50;
					pixels[i + 2] = 220;
					pixels[i + 3] = 255;
				} else {
					// Gold (r: 230, g: 180, b: 40)
					pixels[i] = 230;
					pixels[i + 1] = 180;
					pixels[i + 2] = 40;
					pixels[i + 3] = 255;
				}
			}

			const theme = extractPaletteFromImageData(pixels, 8, 8);
			expect(theme.primaryAccent).toMatch(/rgb\(\d+,\s*\d+,\s*\d+\)/);
			expect(theme.secondaryAccent).toMatch(/rgb\(\d+,\s*\d+,\s*\d+\)/);
			expect(theme.surfaceGlow).toMatch(/rgba\(\d+,\s*\d+,\s*\d+,\s*0\.38\)/);
			expect(['#ffffff', '#111116']).toContain(theme.textOnAccent);
		});
	});

	describe('extractPaletteFromImageUrl', () => {
		it('should resolve default palette for empty or missing URL', async () => {
			const t1 = await extractPaletteFromImageUrl('');
			const t2 = await extractPaletteFromImageUrl(undefined);
			expect(t1).toEqual(DEFAULT_PALETTE_THEME);
			expect(t2).toEqual(DEFAULT_PALETTE_THEME);
		});

		it('should cache and reuse palette theme across identical URLs', async () => {
			const origImage = globalThis.Image;
			const origCreateElement = document.createElement.bind(document);

			try {
				class MockImage {
					crossOrigin = '';
					src = '';
					onload: (() => void) | null = null;
					onerror: (() => void) | null = null;
					constructor() {
						setTimeout(() => {
							this.onload?.();
						}, 0);
					}
				}
				(globalThis as any).Image = MockImage as any;

				// Mock 2D canvas context
				vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
					const el = origCreateElement(tagName);
					if (tagName === 'canvas') {
						const mockCanvas = el as HTMLCanvasElement;
						mockCanvas.getContext = vi.fn().mockReturnValue({
							drawImage: vi.fn(),
							getImageData: vi.fn().mockReturnValue({
								data: new Uint8ClampedArray(24 * 24 * 4).fill(120),
							}),
						});
						return mockCanvas;
					}
					return el;
				});

				const res = await extractPaletteFromImageUrl('https://example.com/cover.jpg', 500);
				expect(res).toBeDefined();
				expect(res.primaryAccent).toBeDefined();

				// Second call should return cached theme
				const cached = await extractPaletteFromImageUrl('https://example.com/cover.jpg', 500);
				expect(cached).toBe(res);
			} finally {
				(globalThis as any).Image = origImage;
				vi.restoreAllMocks();
			}
		});

		it('should fallback to default palette on image error', async () => {
			const origImage = globalThis.Image;
			try {
				class FailingImage {
					crossOrigin = '';
					src = '';
					onload: (() => void) | null = null;
					onerror: (() => void) | null = null;
					constructor() {
						setTimeout(() => {
							this.onerror?.();
						}, 0);
					}
				}
				(globalThis as any).Image = FailingImage as any;

				const res = await extractPaletteFromImageUrl('https://example.com/broken.jpg', 500);
				expect(res).toEqual(DEFAULT_PALETTE_THEME);
			} finally {
				(globalThis as any).Image = origImage;
			}
		});
	});

	describe('applyPaletteTheme', () => {
		it('should set CSS custom properties on element when enabled', () => {
			const el = document.createElement('div');
			const theme = {
				primaryAccent: 'rgb(200, 50, 100)',
				secondaryAccent: 'rgb(50, 150, 200)',
				surfaceGlow: 'rgba(200, 50, 100, 0.35)',
				textOnAccent: '#ffffff',
			};

			applyPaletteTheme(el, theme, true);
			expect(el.style.getPropertyValue('--player-dynamic-accent')).toBe('rgb(200, 50, 100)');
			expect(el.style.getPropertyValue('--player-dynamic-secondary')).toBe('rgb(50, 150, 200)');
			expect(el.style.getPropertyValue('--player-dynamic-glow')).toBe('rgba(200, 50, 100, 0.35)');
			expect(el.style.getPropertyValue('--player-karaoke-highlight')).toBe('rgb(200, 50, 100)');
			expect(el.style.getPropertyValue('--player-text-on-accent')).toBe('#ffffff');
		});

		it('should remove CSS custom properties when disabled or theme is null', () => {
			const el = document.createElement('div');
			el.style.setProperty('--player-dynamic-accent', 'red');

			applyPaletteTheme(el, null, true);
			expect(el.style.getPropertyValue('--player-dynamic-accent')).toBe('');

			el.style.setProperty('--player-dynamic-accent', 'blue');
			applyPaletteTheme(el, { ...DEFAULT_PALETTE_THEME }, false);
			expect(el.style.getPropertyValue('--player-dynamic-accent')).toBe('');
		});
	});
});
