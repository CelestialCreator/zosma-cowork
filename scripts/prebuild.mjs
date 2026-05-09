// Cross-platform prebuild script for Tauri beforeBuildCommand
// Builds the agent-sidecar and copies dist files into src-tauri/agent-sidecar/
// so Tauri's bundle.resources glob can find them at compile time.

import { execSync } from "node:child_process";
import { cpSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sidecarDir = join(root, "agent-sidecar");
const targetDir = join(root, "src-tauri", "agent-sidecar");

console.log("[prebuild] Building agent-sidecar...");
execSync("npm ci && npm run build", {
	cwd: sidecarDir,
	shell: true,
	stdio: "inherit",
});

console.log("[prebuild] Copying dist to src-tauri/agent-sidecar/...");
mkdirSync(targetDir, { recursive: true });
cpSync(join(sidecarDir, "dist"), targetDir, { recursive: true });

console.log("[prebuild] Done.");
