// Cross-platform prebuild script for Tauri beforeBuildCommand
// Bundles the agent-sidecar into a single self-contained CJS file
// with all dependencies inlined, so no node_modules/ needed at runtime.

import { execSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sidecarDir = join(root, "agent-sidecar");

console.log("[prebuild] Building agent-sidecar bundle...");
execSync("npm ci && npm run bundle", {
	cwd: sidecarDir,
	shell: true,
	stdio: "inherit",
});

// Patch import_meta.url for CJS compatibility
// esbuild outputs var import_meta = {}; but needs import_meta.url for CJS
console.log("[prebuild] Patching import_meta.url...");
const bundlePath = join(sidecarDir, "dist", "bundle.cjs");
let code = readFileSync(bundlePath, "utf-8");
code = code.replace(
	/var (import_meta\d*) = \{\};/g,
	'var $1 = { url: require("url").pathToFileURL(__filename).href };',
);
writeFileSync(bundlePath, code, "utf-8");

// Copy single bundled file into src-tauri/ for Tauri resource bundling
const targetPath = join(root, "src-tauri", "agent-sidecar", "index.cjs");
console.log("[prebuild] Copying bundle to %s...", targetPath);
mkdirSync(join(root, "src-tauri", "agent-sidecar"), { recursive: true });
cpSync(bundlePath, targetPath);

console.log("[prebuild] Done (%.1f MB)", code.length / 1024 / 1024);
