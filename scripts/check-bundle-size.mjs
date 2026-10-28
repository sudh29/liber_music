// scripts/check-bundle-size.mjs
// Verifies production bundle size ceilings and Obsidian distribution asset integrity.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');

// Distribution constraints
const LIMITS = {
	'main.js': 2 * 1024 * 1024,      // 2.0 MB maximum
	'styles.css': 1024 * 1024,       // 1.0 MB maximum (includes inlined vinyl assets)
	'manifest.json': 50 * 1024,      // 50 KB maximum
};

function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function verifyBundle() {
	console.log('📦 Auditing production distribution bundle size & asset integrity...');

	let hasError = false;
	const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

	for (const [file, maxLimit] of Object.entries(LIMITS)) {
		const filePath = path.join(distDir, file);
		if (!fs.existsSync(filePath)) {
			console.error(`❌ Missing required release asset: ${file}`);
			hasError = true;
			continue;
		}

		const stats = fs.statSync(filePath);
		const size = stats.size;
		const pct = ((size / maxLimit) * 100).toFixed(1);

		if (size > maxLimit) {
			console.error(`❌ ${file} exceeds ceiling limit! Current: ${formatBytes(size)}, Max allowed: ${formatBytes(maxLimit)} (${pct}%)`);
			hasError = true;
		} else {
			console.log(`✅ ${file.padEnd(14)}: ${formatBytes(size).padStart(10)} / max ${formatBytes(maxLimit).padEnd(8)} (${pct}% of ceiling)`);
		}
	}

	// Validate manifest.json version matches package.json
	const manifestPath = path.join(distDir, 'manifest.json');
	if (fs.existsSync(manifestPath)) {
		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
		if (manifest.version !== packageJson.version) {
			console.error(`❌ Version mismatch: manifest.json (${manifest.version}) does not match package.json (${packageJson.version})`);
			hasError = true;
		} else {
			console.log(`✅ Version sync   : v${manifest.version} across manifest.json and package.json`);
		}

		if (!manifest.id || manifest.id !== 'liber-music-player-plugin') {
			console.error(`❌ Invalid plugin ID in manifest.json: ${manifest.id}`);
			hasError = true;
		}
	}

	if (hasError) {
		console.error('\n🚨 Distribution bundle audit failed!');
		process.exit(1);
	}

	console.log('\n🎉 Distribution bundle audit passed! Production assets ready for release & BRAT distribution.\n');
}

verifyBundle();
