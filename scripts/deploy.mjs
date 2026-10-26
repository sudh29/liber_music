// scripts/deploy.mjs
// Unified Obsidian plugin deployment script
//
// Usage:
//   node scripts/deploy.mjs dev   // Dev mode: creates symlink from vault plugin dir to dist
//   node scripts/deploy.mjs build // Build mode: copies dist files to vault plugin dir
//
// Conventions:
// - Mode argument ("dev" or "build") must be explicitly passed.
// - Requires .env in the project root with:
//     VAULT_PATH=/path/to/your/obsidian/vault
// - Plugin ID is read from manifest.json and deployed to:
//     <VAULT_PATH>/.obsidian/plugins/<pluginId>/
//
// Typical workflow:
// 1. Parse mode argument (dev/build).
// 2. Parse Vault path and plugin ID, validating configuration.
// 3. Prepare dist directory (ensuring .hotreload marker exists).
// 4. In dev mode create/reuse symlink; in build mode copy build artifacts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Merges key-value pairs from a .env file into process.env without overwriting existing variables.
 * Supports standard format: KEY=value, optional quotes, # comments, and empty lines.
 * @param {string} filePath Absolute path to .env file
 */
function applyDotenvFile(filePath) {
	const content = fs.readFileSync(filePath, 'utf8');
	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const eq = trimmed.indexOf('=');
		if (eq === -1) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		if (!key) {
			continue;
		}
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (process.env[key] === undefined) {
			process.env[key] = value;
		}
	}
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../');
const envPath = path.join(projectRoot, '.env');
const distDir = path.join(projectRoot, 'dist');
const manifestPath = path.join(projectRoot, 'manifest.json');

// ==================== Utility Functions ====================

/**
 * Standard console logging utility with clear icon prefixes.
 */
const log = {
	success: (msg) => console.log(`✅ ${msg}`),
	error: (msg) => console.error(`❌ ${msg}`),
	info: (msg) => console.log(`ℹ️  ${msg}`),
	warn: (msg) => console.warn(`⚠️  ${msg}`),
};

/**
 * Recursively copies a directory to the destination.
 * @param src Source directory path
 * @param dest Destination directory path
 */
function copyDir(src, dest) {
	fs.mkdirSync(dest, { recursive: true });
	
	const entries = fs.readdirSync(src, { withFileTypes: true });
	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		
		if (entry.isDirectory()) {
			copyDir(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

/**
 * Creates clickable OSC 8 hyperlink for terminal paths.
 * @param filePath Local file or directory path
 * @param displayText Text displayed to the user
 * @returns Clickable terminal string
 */
function createClickablePath(filePath, displayText) {
	const resolvedPath = path.resolve(filePath);
	let targetPathForUrl = resolvedPath;

	try {
		if (fs.existsSync(resolvedPath) && fs.lstatSync(resolvedPath).isDirectory()) {
			targetPathForUrl = resolvedPath.endsWith(path.sep) ? resolvedPath : resolvedPath + path.sep;
		}
	} catch {
		// Ignore: URL generation fallback
	}

	const fileUrl = pathToFileURL(targetPathForUrl).href;
	const text = displayText ?? path.basename(resolvedPath);
	return `\x1b]8;;${fileUrl}\x1b\\${text}\x1b]8;;\x1b\\`;
}

// ==================== Configuration & Argument Parsing ====================

/**
 * Parses command line arguments and returns the active mode.
 * @param argv process.argv array
 * @returns Mode string: "dev" | "build"
 */
function parseMode(argv) {
	const arg = argv[2];

	if (arg === 'dev') {
		return 'dev';
	}

	if (arg === 'build') {
		return 'build';
	}

	if (!arg) {
		log.error('Missing mode argument. Please specify "dev" or "build".');
	} else {
		log.error(`Unsupported mode argument: "${arg}". Please specify "dev" or "build".`);
	}
	process.exit(1);
}

/**
 * Resolves the absolute path to the Obsidian Vault.
 * Silent exit if .env does not exist (to support CI/CD environments).
 * @returns Absolute vault path
 */
function getVaultPath() {
	if (!fs.existsSync(envPath)) {
		log.warn('.env file not found, skipping deployment');
		process.exit(0);
	}

	applyDotenvFile(envPath);
	const vaultPath = process.env.VAULT_PATH;

	if (!vaultPath) {
		log.error('VAULT_PATH is not set. Please set VAULT_PATH=/path/to/vault in your .env file');
		process.exit(1);
	}

	return path.resolve(vaultPath);
}

/**
 * Reads plugin ID from manifest.json.
 * @returns Plugin ID
 */
function getPluginId() {
	if (!fs.existsSync(manifestPath)) {
		log.error(`manifest.json not found: ${manifestPath}`);
		process.exit(1);
	}

	try {
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
		const pluginId = manifest.id;
		if (!pluginId) throw new Error();
		return pluginId;
	} catch {
		log.error('Failed to read plugin ID from manifest.json.');
		process.exit(1);
	}
}

// ==================== Directory Preparation ====================

/**
 * Ensures dist directory and .hotreload marker are ready.
 */
function ensureDistReady() {
	if (!fs.existsSync(distDir)) {
		fs.mkdirSync(distDir, { recursive: true });
	}
	const hotreloadPath = path.join(distDir, '.hotreload');
	if (!fs.existsSync(hotreloadPath)) {
		fs.writeFileSync(hotreloadPath, '');
	}
}

/**
 * Computes destination plugin directory inside vault.
 * Exits if plugin directory resolves to dist directory itself.
 * @param vaultPath Vault root path
 * @param pluginId Plugin ID
 * @returns Absolute plugin directory path
 */
function getPluginDir(vaultPath, pluginId) {
	const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', pluginId);

	if (path.resolve(pluginDir) === path.resolve(distDir)) {
		process.exit(0);
	}

	return pluginDir;
}

// ==================== Plugin Directory Handling ====================

/**
 * Synchronizes data.json between vault plugin directory and dist.
 * Preserves user config when redeploying.
 * @param pluginDir Absolute plugin directory path
 */
function backupDataJson(pluginDir) {
	if (!fs.existsSync(pluginDir)) return;
	const stats = fs.lstatSync(pluginDir);
	if (!stats.isDirectory()) return;

	const dataJsonPath = path.join(pluginDir, 'data.json');
	const distDataJsonPath = path.join(distDir, 'data.json');

	if (!fs.existsSync(dataJsonPath)) {
		try {
			fs.rmSync(distDataJsonPath, { force: true });
		} catch (err) {
			log.warn(`Unable to remove data.json in dist: ${err?.message ?? err}`);
		}
		return;
	}

	fs.copyFileSync(dataJsonPath, distDataJsonPath);
}

/**
 * Determines whether path is an existing symbolic link to dist.
 * @param pluginDir Plugin directory path
 * @returns Boolean indicating if path is symlink to dist
 */
function isExistingSymlinkToDist(pluginDir) {
	const linkTarget = fs.readlinkSync(pluginDir);
	const resolvedLinkTarget = path.resolve(path.dirname(pluginDir), linkTarget);
	return resolvedLinkTarget === path.resolve(distDir);
}

/**
 * Removes specified file or directory path.
 * @param targetPath Path to remove
 */
function removePath(targetPath) {
	try {
		fs.rmSync(targetPath, { recursive: true, force: true });
	} catch (err) {
		log.error(`Error removing path: ${err.message}`);
		process.exit(1);
	}
}

// ==================== Deployment Implementations ====================

/**
 * Dev mode: creates symlink from dist to vault plugin directory (junction on Windows).
 * Reuses existing symlink if already pointing to dist.
 * @param context Deployment context
 */
function deployDev(context) {
	const { pluginDir, pluginId } = context;
	const linkType = process.platform === 'win32' ? 'junction' : 'dir';

	if (fs.existsSync(pluginDir)) {
		const stats = fs.lstatSync(pluginDir);

		if (stats.isSymbolicLink() && isExistingSymlinkToDist(pluginDir)) {
			log.info(`Symlink active: ${createClickablePath(distDir, 'dist')} → ${createClickablePath(pluginDir, pluginId)}`);
			return;
		}

		removePath(pluginDir);
	}

	fs.mkdirSync(path.dirname(pluginDir), { recursive: true });
	fs.symlinkSync(distDir, pluginDir, linkType);
	log.info(`Linked successfully: ${createClickablePath(distDir, 'dist')} → ${createClickablePath(pluginDir, pluginId)}`);
}

/**
 * Build mode: copies compiled files from dist into vault plugin directory.
 * @param context Deployment context
 */
function deployBuild(context) {
	const { pluginDir, pluginId } = context;

	if (fs.existsSync(pluginDir)) {
		removePath(pluginDir);
	}

	fs.mkdirSync(pluginDir, { recursive: true });
	copyDir(distDir, pluginDir);
	log.info(`Copied successfully: ${createClickablePath(distDir, 'dist')} → ${createClickablePath(pluginDir, pluginId)}`);
}

// ==================== Main Process ====================

/**
 * Main deployment entry point:
 * 1. Parse mode (dev/build).
 * 2. Resolve Vault path and plugin ID.
 * 3. Prepare dist directory and handle existing configurations.
 * 4. Perform symlink or copy deployment.
 */
function main() {
	const mode = parseMode(process.argv);

	const vaultPath = getVaultPath();
	const pluginId = getPluginId();
	const pluginDir = getPluginDir(vaultPath, pluginId);
	backupDataJson(pluginDir);
	ensureDistReady();

	log.info(`Starting deployment: ${mode} mode`);
	
	const context = { mode, vaultPath, pluginId, pluginDir };

	try {
		switch (mode) {
			case 'dev':
				deployDev(context);
				break;
			case 'build':
				deployBuild(context);
				break;
			default:
				log.error(`Unsupported mode: ${mode}`);
				process.exit(1);
		}

		log.success(`Deployment complete!`);
	} catch (err) {
		log.error(`${mode === 'dev' ? 'Symlink creation' : 'Copy'} failed: ${err.message}`);
		process.exit(1);
	}
}

main();
