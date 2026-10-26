import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, ".");

const packagePath = resolve(projectRoot, "package.json");
const manifestPath = resolve(projectRoot, "manifest.json");
const versionsPath = resolve(projectRoot, "versions.json");

// Read files
const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const versions = JSON.parse(readFileSync(versionsPath, "utf8"));

// Determine target version (prefer env var, fallback to package.json)
const targetVersion = process.env.npm_package_version || packageJson.version;
const { minAppVersion } = manifest;

if (!targetVersion) {
	console.error("❌ Unable to determine version");
	process.exit(1);
}

// Update manifest.json
manifest.version = targetVersion;
writeFileSync(manifestPath, JSON.stringify(manifest, null, "\t") + "\n");
console.log(`✅ Updated manifest.json version: ${targetVersion}`);

// Update versions.json if entry does not exist
if (!versions[targetVersion]) {
	versions[targetVersion] = minAppVersion;
	writeFileSync(versionsPath, JSON.stringify(versions, null, "\t") + "\n");
	console.log(`✅ Added version mapping: ${targetVersion} -> ${minAppVersion}`);
} else {
	console.log(`ℹ️  Version ${targetVersion} already exists in versions.json`);
}

console.log(`✅ Version sync completed: ${targetVersion} (minAppVersion: ${minAppVersion})`);
