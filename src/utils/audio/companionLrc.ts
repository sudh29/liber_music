/**
 * 同目录伴生 .lrc 歌词文件解析模块
 * 
 * 当音频文件的内嵌元数据标签中没有歌词时，自动在库中同路径下查找同名 `.lrc` 文件：
 * 例如：`Music/Artist/Song.flac` -> `Music/Artist/Song.lrc`
 */

import { App, TFile } from "obsidian";

/**
 * 根据音频文件路径计算伴生 .lrc 文件的路径
 * 
 * @param audioPath 音频文件在 Vault 中的完整相对路径
 * @returns 伴生 .lrc 文件路径
 * 
 * @example
 * getCompanionLrcPath("Music/Song.mp3") === "Music/Song.lrc"
 */
export function getCompanionLrcPath(audioPath: string): string {
	if (!audioPath) return "";
	return audioPath.replace(/\.[^/.]+$/, ".lrc");
}

/**
 * 检查并获取与音频文件同名的伴生 .lrc 文件
 * 
 * @param app Obsidian App 实例
 * @param audioFile 音频文件对象或路径
 * @returns 若存在对应的伴生 .lrc 则返回 TFile，否则返回 null
 */
export function getCompanionLrcFile(
	app: App,
	audioFile: TFile | string
): TFile | null {
	const audioPath = typeof audioFile === "string" ? audioFile : audioFile.path;
	const lrcPath = getCompanionLrcPath(audioPath);
	if (!lrcPath || lrcPath === audioPath) return null;

	const target = app.vault.getAbstractFileByPath(lrcPath);
	if (target instanceof TFile && target.extension?.toLowerCase() === "lrc") {
		return target;
	}
	return null;
}

/**
 * 尝试从同目录伴生 .lrc 文件中读取歌词文本
 * 
 * @param app Obsidian App 实例
 * @param audioFile 音频文件对象或路径
 * @returns 歌词文本内容，若不存在或读取失败则返回 null
 */
export async function readCompanionLrc(
	app: App,
	audioFile: TFile | string
): Promise<string | null> {
	try {
		const lrcFile = getCompanionLrcFile(app, audioFile);
		if (!lrcFile) return null;

		const content = await app.vault.read(lrcFile);
		return content && content.trim().length > 0 ? content : null;
	} catch (error) {
		console.warn("读取伴生 .lrc 歌词文件失败:", error);
		return null;
	}
}
