/**
 * 歌词管理服务
 * 
 * 负责管理歌词相关的业务逻辑，包括：
 * - 加载歌词（从插件设置中读取，或从同目录伴生 .lrc 文件回退读取）
 * - 解析歌词（LRC 格式和逐字歌词）
 * - 处理歌词格式转换与时间轴偏移
 * 
 * 歌词优先从音频内嵌元数据标签（LYRICS/USLT/TXXX）读取，若缺失则自动在同目录下
 * 查找同名伴生 `.lrc` 文本文件并同步到设置中。
 */

import { LyricLine, LyricsParser } from "@/utils/lyrics/parser";
import { ExtendedLyricLine, LyricsExtendedParser } from "@/utils/lyrics/extendedParser";
import { isTimestampedKaraokeLyrics } from "@/utils/lyrics/formatDetection";
import { stripLeadingLyricsMetadata } from "@/utils/lyrics/normalizeLyrics";
import { applyLyricsOffset, parseLyricsOffset, stripLyricsOffsetTags } from "@/utils/lyrics/offset";
import MusicPlayerPlugin from "@/main";
import { getOrCreateTrackId } from "@/utils/track/id";
import { getCompanionLrcFile, readCompanionLrc } from "@/utils/audio/companionLrc";
import { TFile } from "obsidian";

/**
 * 歌词管理服务类
 * 
 * 提供歌词的加载和解析功能，支持 LRC 格式和逐字歌词格式。
 */
export class LyricsService {
	/**
	 * 创建歌词管理服务实例
	 * 
	 * @param plugin - 插件实例，用于访问设置中的歌词数据与 Vault 文件接口
	 */
	constructor(private plugin: MusicPlayerPlugin) {}

	/**
	 * 解析任意原始歌词文本，自动识别逐字（卡拉OK）或普通 LRC 格式，并应用 offset 时间平移
	 * 
	 * @param rawLyrics 原始歌词字符串
	 * @returns 普通歌词与逐字歌词解析结果
	 */
	parseLyrics(rawLyrics: string): {
		lyrics: LyricLine[];
		extendedLyrics: ExtendedLyricLine[];
	} {
		const lyrics: LyricLine[] = [];
		const extendedLyrics: ExtendedLyricLine[] = [];

		if (!rawLyrics || !rawLyrics.trim()) {
			return { lyrics, extendedLyrics };
		}

		// [offset:±ms] 是歌词参数：解析后用于整体平移时间轴，但不显示在歌词中
		const offsetSeconds = parseLyricsOffset(rawLyrics);
		const lyricsText = stripLeadingLyricsMetadata(stripLyricsOffsetTags(rawLyrics));
		if (!lyricsText.trim()) {
			return { lyrics, extendedLyrics };
		}

		if (isTimestampedKaraokeLyrics(lyricsText)) {
			const parsed = LyricsExtendedParser.parse(lyricsText);
			if (parsed.length > 0) {
				extendedLyrics.push(...parsed);
			}
		}

		if (extendedLyrics.length === 0) {
			const parsedLyrics = LyricsParser.parseLRC(lyricsText);

			if (parsedLyrics.length > 0) {
				lyrics.push(
					...parsedLyrics.map((line) => ({
						time: line.time,
						text: LyricsParser.cleanText(line.text),
					}))
				);
			} else {
				const lines = lyricsText.split(/\r?\n/).filter((l) => l.trim().length > 0);
				lyrics.push(
					...lines.map((line, index) => ({
						time: index * 3,
						text: LyricsParser.cleanText(line),
					}))
				);
			}
		}

		// 应用偏移（正偏移 = 歌词整体提前）
		applyLyricsOffset(lyrics, extendedLyrics, offsetSeconds);

		return { lyrics, extendedLyrics };
	}

	/**
	 * 同步加载歌词（供已有缓存或快速渲染使用）
	 * 
	 * 若设置中未缓存歌词，则检查 Vault 中是否存在伴生 `.lrc` 文件并触发后台加载
	 * 
	 * @param trackPath - 音乐文件路径
	 * @returns 包含普通歌词和逐字歌词的对象
	 */
	loadLyrics(trackPath: string): {
		lyrics: LyricLine[];
		extendedLyrics: ExtendedLyricLine[];
	} {
		const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
		const track = this.plugin.settings.tracks[trackId];
		const rawLyrics = track?.lyrics && track.lyrics.trim() !== "" ? track.lyrics : "";

		if (!rawLyrics.trim()) {
			// 检查同目录下是否有伴生 .lrc 文件，异步加载并缓存
			const companionFile = getCompanionLrcFile(this.plugin.app, trackPath);
			if (companionFile) {
				void this.loadCompanionLrcAsync(trackPath, companionFile);
			}
			return { lyrics: [], extendedLyrics: [] };
		}

		return this.parseLyrics(rawLyrics);
	}

	/**
	 * 异步加载歌词：优先使用设置缓存，若无则自动读取 Vault 同目录下的伴生 `.lrc` 文件
	 * 
	 * @param trackPath - 音乐文件路径
	 * @returns 包含普通歌词和逐字歌词的 Promise
	 */
	async loadLyricsAsync(trackPath: string): Promise<{
		lyrics: LyricLine[];
		extendedLyrics: ExtendedLyricLine[];
	}> {
		const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
		const track = this.plugin.settings.tracks[trackId];
		const rawLyrics = track?.lyrics && track.lyrics.trim() !== "" ? track.lyrics : "";

		if (rawLyrics.trim()) {
			return this.parseLyrics(rawLyrics);
		}

		// 尝试从伴生 .lrc 文件读取
		const companionText = await readCompanionLrc(this.plugin.app, trackPath);
		if (companionText && companionText.trim()) {
			if (track) {
				track.lyrics = companionText;
				try {
					await this.plugin.saveSettings();
				} catch (err) {
					console.warn("保存伴生歌词到设置失败:", err);
				}
			}
			return this.parseLyrics(companionText);
		}

		return { lyrics: [], extendedLyrics: [] };
	}

	/**
	 * 后台加载伴生 .lrc 文件并同步到设置与当前播放状态
	 */
	private async loadCompanionLrcAsync(trackPath: string, lrcFile: TFile): Promise<void> {
		try {
			const content = await this.plugin.app.vault.read(lrcFile);
			if (content && content.trim()) {
				const trackId = getOrCreateTrackId(trackPath, this.plugin.settings);
				const track = this.plugin.settings.tracks[trackId];
				if (track) {
					track.lyrics = content;
					await this.plugin.saveSettings();
				}
			}
		} catch (error) {
			console.warn(`加载伴生歌词失败 (${trackPath}):`, error);
		}
	}
}
