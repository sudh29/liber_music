/**
 * ReplayGain 音量增益解析与补偿计算模块
 * 
 * 符合 EBU R128 / ReplayGain 标准：
 * - 解析 ID3 (TXXX:REPLAYGAIN_TRACK_GAIN) 与 Vorbis (REPLAYGAIN_TRACK_GAIN) 标签
 * - 计算线性音量缩放倍率：10 ^ (gainDb / 20)
 * - 结合基础音量计算补偿后的播放器实际音量（限制在 [0.0, 1.0] 范围内）
 */

/**
 * 解析各种格式的 ReplayGain 增益值（dB）
 * 
 * 支持格式：
 * - 数值：-6.2
 * - 字符串："-6.2 dB", "+1.50 dB", "-4.5dB"
 * - 对象：包含 ratio 或 gain 属性
 * 
 * @param gain 原始增益标签值
 * @returns 解析后的 dB 数值，无法解析时返回 undefined
 */
export function parseReplayGain(gain: unknown): number | undefined {
	if (typeof gain === "number" && Number.isFinite(gain)) {
		return gain;
	}

	if (typeof gain === "string") {
		const trimmed = gain.trim();
		const match = /^([+-]?\d+(?:\.\d+)?)\s*(?:db)?$/i.exec(trimmed);
		if (match && match[1]) {
			const parsed = Number.parseFloat(match[1]);
			if (Number.isFinite(parsed)) {
				return parsed;
			}
		}
	}

	if (gain && typeof gain === "object") {
		const maybeRatio = (gain as { ratio?: unknown }).ratio;
		if (typeof maybeRatio === "number" && Number.isFinite(maybeRatio) && maybeRatio > 0) {
			// ratio 转为 dB: 20 * log10(ratio)
			return 20 * Math.log10(maybeRatio);
		}
	}

	return undefined;
}

/**
 * 根据 dB 增益值计算线性音量倍率
 * 
 * 公式：multiplier = 10 ^ (gainDb / 20)
 * 例如：
 * - 0 dB -> 1.0
 * - -6.02 dB -> ~0.5
 * - +6.02 dB -> ~2.0
 * 
 * @param gainDb 音轨增益（dB）
 * @returns 线性倍率乘数
 */
export function calculateReplayGainMultiplier(gainDb: number | undefined): number {
	if (gainDb === undefined || !Number.isFinite(gainDb)) {
		return 1.0;
	}
	return Math.pow(10, gainDb / 20);
}

/**
 * 结合用户设定音量与 ReplayGain 增益，计算最终应用到 HTMLAudioElement 的 volume 值
 * 
 * @param baseVolume 用户音量（0.0 - 1.0）
 * @param gainDb 音轨增益（dB）
 * @returns 限制在 [0.0, 1.0] 范围内的最终音量
 */
export function applyReplayGainToVolume(
	baseVolume: number,
	gainDb: number | undefined
): number {
	const validBase = Number.isFinite(baseVolume) ? Math.min(Math.max(baseVolume, 0), 1) : 1.0;
	const multiplier = calculateReplayGainMultiplier(gainDb);
	const adjusted = validBase * multiplier;
	return Math.min(Math.max(adjusted, 0.0), 1.0);
}
