/**
 * Zosma Cowork — Extension Manager
 *
 * Manages discovery, installation, and lifecycle of extensions.
 * Supports pi extensions (.ts files loaded via pi-mono) with
 * the ZEM (Zosma Extension Model) abstraction layer.
 *
 * Extension storage: ~/.zosmaai/agent/extensions/
 * Extension registry: ~/.zosmaai/agent/extensions.json
 *
 * When dhara replaces pi as the engine, only the adapter internals
 * change — the ZEM types and UI stay the same.
 */

import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { basename, isAbsolute, join, resolve } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────

export type ExtensionSourceType = "npm" | "git" | "local" | "url";

export interface ExtensionSource {
	type: ExtensionSourceType;
	value: string;
	ref?: string;
}

export interface ZemExtension {
	id: string;
	name: string;
	version: string;
	description: string;
	author?: string;
	icon?: string;
	category?: string;
	source: ExtensionSource;
	capabilities: {
		tools?: { name: string; description: string }[];
		skills?: string[];
		commands?: { name: string; description: string }[];
	};
	runtime: "pi" | "dhara" | "native";
	installed: boolean;
	enabled: boolean;
	installPath?: string;
	config?: Record<string, unknown>;
	configSchema?: Record<string, unknown>;
}

interface ExtensionRegistryEntry {
	enabled: boolean;
	config?: Record<string, unknown>;
	installedAt: string;
	source: ExtensionSource;
}

interface ExtensionRegistry {
	extensions: Record<string, ExtensionRegistryEntry>;
}

// ─── Paths ───────────────────────────────────────────────────────────

function defaultZosmaDir(): string {
	return join(homedir(), ".zosmaai");
}

/**
 * pi's canonical agent directory (~/.pi/agent).
 *
 * Zosma Cowork is a GUI wrapper over pi-coding-agent, so skills and
 * extensions are *shared* with the pi CLI: discovered from and installed
 * into pi's own dirs instead of a private cowork silo. This is why the
 * `zosmaDir` argument below is intentionally ignored for resource paths —
 * the storage location is pi's, not cowork's. See issue #147.
 */
function piAgentDir(): string {
	return join(homedir(), ".pi", "agent");
}

function extensionsDir(_zosmaDir: string): string {
	// Must match the agentDir passed to pi's DefaultResourceLoader in the
	// sidecar (~/.pi/agent), so installed extensions are discovered + loaded.
	return join(piAgentDir(), "extensions");
}

function registryFile(_zosmaDir: string): string {
	// Cowork-owned install registry, kept alongside pi's resources. Named
	// distinctly so it never collides with pi's own settings.json.
	return join(piAgentDir(), "cowork-extensions.json");
}

function settingsFile(_zosmaDir: string): string {
	// pi's real settings.json — its `packages` array is surfaced as
	// installed extensions in discoverExtensions().
	return join(piAgentDir(), "settings.json");
}

function ensureDir(dir: string): void {
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}
}

// ─── Registry persistence ───────────────────────────────────────────

function loadRegistry(zosmaDir: string): ExtensionRegistry {
	const fp = registryFile(zosmaDir);
	if (!existsSync(fp)) return { extensions: {} };
	try {
		return JSON.parse(readFileSync(fp, "utf-8"));
	} catch {
		return { extensions: {} };
	}
}

function saveRegistry(zosmaDir: string, registry: ExtensionRegistry): void {
	const fp = registryFile(zosmaDir);
	ensureDir(piAgentDir());
	writeFileSync(fp, JSON.stringify(registry, null, 2), "utf-8");
}

// ─── Pi settings.json packages ──────────────────────────────────────

function loadPiSettings(zosmaDir: string): { packages?: string[] } {
	// pi's real settings.json (~/.pi/agent/settings.json) — its `packages`
	// array is the source of truth for npm/git/local extensions pi manages.
	const fp = settingsFile(zosmaDir);
	if (!existsSync(fp)) return {};
	try {
		return JSON.parse(readFileSync(fp, "utf-8"));
	} catch {
		return {};
	}
}

/** Where pi physically installs npm: packages (handles scoped names). */
function npmModulePath(pkgName: string): string {
	return join(piAgentDir(), "npm", "node_modules", pkgName);
}

/**
 * True when pi already owns this npm package — either declared in its
 * settings.json `packages` array (as `npm:<name>` or a bare `<name>`) or
 * already physically installed under ~/.pi/agent/npm/node_modules.
 *
 * When pi manages it, Cowork must NOT extract a second drop-in copy into
 * extensions/: two copies register the same tools and pi refuses to load the
 * duplicate (the pi-web-access "Tool X conflicts" startup failure).
 */
function piManagesPackage(zosmaDir: string, pkgName: string): boolean {
	const settings = loadPiSettings(zosmaDir);
	const inPackages = (settings.packages ?? []).some(
		(p) => p === `npm:${pkgName}` || p === pkgName,
	);
	return inPackages || existsSync(npmModulePath(pkgName));
}

/**
 * Ensure `npm:<pkgName>` is present in pi's settings.json `packages` so pi
 * remains the single source of truth for the npm-managed extension. Preserves
 * every other settings key. No-op when already declared.
 */
function addPiPackage(zosmaDir: string, pkgName: string): void {
	const fp = settingsFile(zosmaDir);
	let settings: { packages?: string[] } & Record<string, unknown> = {};
	if (existsSync(fp)) {
		try {
			settings = JSON.parse(readFileSync(fp, "utf-8"));
		} catch {
			settings = {};
		}
	}
	const entry = `npm:${pkgName}`;
	const packages = Array.isArray(settings.packages) ? settings.packages : [];
	if (!packages.includes(entry) && !packages.includes(pkgName)) {
		packages.push(entry);
		settings.packages = packages;
		ensureDir(piAgentDir());
		writeFileSync(fp, JSON.stringify(settings, null, 2), "utf-8");
	}
}

/**
 * Flatten an extension id / package source to the on-disk "safe name" used for
 * drop-in directories — so registry id "pi-web-access" and pi package
 * "npm:pi-web-access" are recognised as the SAME extension and listed once.
 * Mirrors the safeName logic in installFromNpm().
 */
function normalizePkgId(id: string): string {
	return id
		.replace(/^npm:/, "")
		.replace(/^git:/, "")
		.replace(/^@/, "")
		.replace(/\//g, "-")
		.replace(/[^a-z0-9._-]/gi, "_");
}

// ─── Discover extensions from disk ──────────────────────────────────

/**
 * Discover all installed extensions:
 * 1. From extensions.json registry (managed installs)
 * 2. From any .ts files or directories in extensions/ dir
 * 3. From pi settings.json `packages` array
 */
export function discoverExtensions(zosmaDir: string): ZemExtension[] {
	const registry = loadRegistry(zosmaDir);
	const extDir = extensionsDir(zosmaDir);
	const result: ZemExtension[] = [];
	const seen = new Set<string>();
	// Dedupe across registry / loose dirs / pi packages by the on-disk safe
	// name, so the same extension is never listed twice (e.g. registry
	// "pi-web-access" vs pi package "npm:pi-web-access").
	const seenNorm = new Set<string>();

	// 1. Discover registry-managed extensions
	for (const [id, entry] of Object.entries(registry.extensions)) {
		seen.add(id);
		seenNorm.add(normalizePkgId(id));
		const installPath = join(extDir, id);
		const meta = readExtensionMeta(installPath);
		result.push({
			id,
			name: meta?.name || id,
			version: meta?.version || "0.0.0",
			description: meta?.description || "",
			author: meta?.author,
			icon: meta?.icon,
			category: meta?.category,
			source: entry.source,
			capabilities: meta?.capabilities || {},
			runtime: detectRuntime(installPath),
			installed: existsSync(installPath),
			enabled: entry.enabled,
			installPath,
			config: entry.config,
			configSchema: meta?.configSchema,
		});
	}

	// 2. Discover loose files in extensions/ dir
	if (existsSync(extDir)) {
		for (const entry of readdirSync(extDir)) {
			const fullPath = join(extDir, entry);
			if (entry.startsWith(".")) continue;
			// Skip if already in registry (by raw id or normalized safe name)
			if (seen.has(entry) || seenNorm.has(normalizePkgId(entry))) continue;

			const meta = readExtensionMeta(fullPath);
			const stat = statSync(fullPath);
			const isFile = stat.isFile() && entry.endsWith(".ts");
			const isDir =
				stat.isDirectory() &&
				(existsSync(join(fullPath, "index.ts")) || existsSync(join(fullPath, "manifest.json")));
			if (!isFile && !isDir) continue;

			seen.add(entry);
			seenNorm.add(normalizePkgId(entry));
			result.push({
				id: entry,
				name: meta?.name || entry.replace(/\.ts$/, ""),
				version: meta?.version || "0.0.0",
				description: meta?.description || "",
				author: meta?.author,
				icon: meta?.icon,
				category: meta?.category,
				source: { type: "local", value: fullPath },
				capabilities: meta?.capabilities || {},
				runtime: detectRuntime(fullPath),
				installed: true,
				enabled: true,
				installPath: fullPath,
				config: meta?.config,
				configSchema: meta?.configSchema,
			});
		}
	}

	// 3. Discover from pi settings packages
	const settings = loadPiSettings(zosmaDir);
	if (settings.packages) {
		for (const pkg of settings.packages) {
			if (seen.has(pkg) || seenNorm.has(normalizePkgId(pkg))) continue;
			seen.add(pkg);
			seenNorm.add(normalizePkgId(pkg));
			// These are managed by pi, we just report them
			result.push({
				id: pkg,
				name: pkg.split("/").pop() || pkg,
				version: "—",
				description: `Pi package: ${pkg}`,
				source: { type: "npm", value: pkg },
				capabilities: {},
				runtime: "pi",
				installed: true,
				enabled: true,
			});
		}
	}

	return result;
}

// ─── Read metadata from extension directory ─────────────────────────

function readExtensionMeta(installPath: string): {
	name?: string;
	version?: string;
	description?: string;
	author?: string;
	icon?: string;
	category?: string;
	capabilities?: ZemExtension["capabilities"];
	config?: Record<string, unknown>;
	configSchema?: Record<string, unknown>;
} | null {
	try {
		// Try package.json first
		const pkgPath = join(installPath, "package.json");
		if (existsSync(pkgPath)) {
			const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
			const piExt = pkg.pi?.extensions?.[0];
			return {
				name: pkg.name || basename(installPath),
				version: pkg.version || "0.0.0",
				description: pkg.description || "",
				author: pkg.author,
				icon: pkg.pi?.icon,
				category: pkg.pi?.category,
				capabilities: {
					tools: piExt?.tools?.map((t: { name: string; description: string }) => ({
						name: t.name,
						description: t.description,
					})),
					skills: pkg.pi?.skills,
					commands: piExt?.commands?.map((c: { name: string; description: string }) => ({
						name: c.name,
						description: c.description,
					})),
				},
				configSchema: piExt?.configSchema,
			};
		}

		// Try manifest.json (dhara format)
		const manifestPath = join(installPath, "manifest.json");
		if (existsSync(manifestPath)) {
			const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
			return {
				name: manifest.name || basename(installPath),
				version: manifest.version || "0.0.0",
				description: manifest.description || "",
				author: manifest.author,
				capabilities: {
					tools: manifest.tools?.map((t: { name: string; description: string }) => ({
						name: t.name,
						description: t.description,
					})),
				},
			};
		}

		// Single .ts file - minimal metadata from file name
		if (installPath.endsWith(".ts") && existsSync(installPath)) {
			const content = readFileSync(installPath, "utf-8");
			// Try to extract description from comments
			const descMatch = content.match(/\/\/\s*description:\s*(.+)/i);
			return {
				name: basename(installPath).replace(/\.ts$/, ""),
				version: "0.0.0",
				description: descMatch?.[1] || `Pi extension: ${basename(installPath)}`,
			};
		}
	} catch {
		// Ignore read errors
	}

	return null;
}

// ─── Runtime detection ───────────────────────────────────────────────

function detectRuntime(installPath: string): "pi" | "dhara" | "native" {
	try {
		if (existsSync(join(installPath, "manifest.json"))) return "dhara";
		if (installPath.endsWith(".ts") || existsSync(join(installPath, "index.ts"))) return "pi";
		if (existsSync(join(installPath, "package.json"))) return "pi";
	} catch {
		// fall through
	}
	return "pi";
}

// ─── Install ─────────────────────────────────────────────────────────

export function installExtension(zosmaDir: string, source: string, ref?: string): ZemExtension {
	const parsed = parseSource(source, ref);
	const extDir = extensionsDir(zosmaDir);
	ensureDir(extDir);

	switch (parsed.type) {
		case "npm":
			return installFromNpm(zosmaDir, extDir, parsed);
		case "git":
			return installFromGit(zosmaDir, extDir, parsed);
		case "local":
			return installFromLocal(zosmaDir, extDir, parsed);
		default:
			throw new Error(`Unsupported extension source type: ${parsed.type}`);
	}
}

function installFromNpm(zosmaDir: string, extDir: string, source: ExtensionSource): ZemExtension {
	const pkgName = source.value;
	// Flatten scoped package names: @zosmaai/pi-llm-wiki → zosmaai-pi-llm-wiki
	const safeName = pkgName
		.replace(/^@/, "") // Remove leading @
		.replace(/\//g, "-") // Replace / with -
		.replace(/[^a-z0-9._-]/gi, "_");
	const targetDir = join(extDir, safeName);

	// Validate the package name is not just a scope (e.g., @zosmaai/)
	if (!pkgName || pkgName === "@" || pkgName.endsWith("/") || pkgName === "/") {
		throw new Error(
			`Invalid package name: "${pkgName}". Please provide a full package name, e.g., "@zosmaai/slide-generator" or "npm:some-package"`,
		);
	}

	// pi-first: if pi already manages this package — declared in its
	// settings.json `packages` or already installed under ~/.pi/agent/npm — do
	// NOT extract a second drop-in into extensions/. Two copies register the
	// same tools and pi refuses to load the duplicate (the pi-web-access
	// "Tool X conflicts" startup failure). Defer to pi's copy and self-heal any
	// stale drop-in a previous buggy install may have left behind.
	if (piManagesPackage(zosmaDir, pkgName)) {
		if (existsSync(targetDir)) {
			rmSync(targetDir, { recursive: true, force: true });
		}
		addPiPackage(zosmaDir, pkgName);
		const registry = loadRegistry(zosmaDir);
		registry.extensions[safeName] = {
			enabled: registry.extensions[safeName]?.enabled ?? true,
			installedAt: registry.extensions[safeName]?.installedAt ?? new Date().toISOString(),
			source: { type: "npm", value: source.value, ref: source.ref },
		};
		saveRegistry(zosmaDir, registry);
		const piPath = npmModulePath(pkgName);
		return buildExtensionEntry(
			zosmaDir,
			safeName,
			existsSync(piPath) ? piPath : targetDir,
			registry,
		);
	}

	// Remove existing if any
	if (existsSync(targetDir)) {
		rmSync(targetDir, { recursive: true, force: true });
	}

	// Run npm pack and extract
	const tmpDir = join(extDir, `.tmp-${safeName}`);
	ensureDir(tmpDir);
	ensureDir(targetDir);
	try {
		const version = source.ref ? `@${source.ref}` : "";
		const npmCmd = `npm pack ${pkgName}${version}`;
		log("npm: %s", npmCmd);
		// Capture stderr for better error messages
		try {
			execSync(`${npmCmd} --pack-destination "${tmpDir}"`, {
				cwd: extDir,
				stdio: "pipe",
				timeout: 300_000,
			});
		} catch (npmErr: unknown) {
			const stderr = (npmErr as { stderr?: Buffer })?.stderr?.toString() || "";
			const msg = (npmErr as Error)?.message || "";
			// Extract npm's error message which is usually cleaner
			const npmMsg =
				stderr
					.split("\n")
					.filter((l) => l.startsWith("npm error"))
					.join("; ") || msg;
			throw new Error(`npm install failed: ${npmMsg}`);
		}
		// Find the tarball
		const files = readdirSync(tmpDir);
		const tarball = files.find((f) => f.endsWith(".tgz"));
		if (!tarball) throw new Error("npm pack produced no tarball");

		// Extract
		execSync(`tar -xzf "${join(tmpDir, tarball)}" -C "${targetDir}"`, {
			stdio: "pipe",
			timeout: 30_000,
		});

		// If extracted to package/, move contents up
		const pkgSubdir = join(targetDir, "package");
		if (existsSync(pkgSubdir)) {
			const contents = readdirSync(pkgSubdir);
			for (const item of contents) {
				const src = join(pkgSubdir, item);
				const dst = join(targetDir, item);
				// Remove destination if exists
				try {
					rmSync(dst, { recursive: true, force: true });
				} catch {
					// ignore
				}
				// Rename (move) — works within same filesystem since tmpDir and extDir are on same partition
				try {
					// Rename works for both files and directories on same filesystem
					execSync(`mv "${src}" "${dst}"`, { stdio: "pipe" });
				} catch (moveErr) {
					log(
						"Failed to move %s: %s",
						item,
						moveErr instanceof Error ? moveErr.message : String(moveErr),
					);
					// If rename fails (cross-device), copy recursively
					copyRecursiveSync(src, dst);
				}
			}
			rmSync(pkgSubdir, { recursive: true, force: true });
		}

		// Install dependencies
		if (existsSync(join(targetDir, "package.json"))) {
			try {
				execSync("npm install --production", {
					cwd: targetDir,
					stdio: "pipe",
					timeout: 120_000,
				});
			} catch {
				// Non-fatal: deps may already be bundled
			}
		}
	} finally {
		// Clean up temp
		if (existsSync(tmpDir)) {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	}

	// Register
	const registry = loadRegistry(zosmaDir);
	registry.extensions[safeName] = {
		enabled: true,
		installedAt: new Date().toISOString(),
		source: { type: "npm", value: source.value, ref: source.ref },
	};
	saveRegistry(zosmaDir, registry);

	return buildExtensionEntry(zosmaDir, safeName, targetDir, registry);
}

function installFromGit(zosmaDir: string, extDir: string, source: ExtensionSource): ZemExtension {
	const url = source.value;
	const safeName = basename(url)
		.replace(/\.git$/, "")
		.replace(/^@/, "")
		.replace(/\//g, "-")
		.replace(/[^a-z0-9._-]/gi, "_");
	const targetDir = join(extDir, safeName);

	if (existsSync(targetDir)) {
		rmSync(targetDir, { recursive: true, force: true });
	}

	const refArg = source.ref ? ` --branch ${source.ref}` : "";
	execSync(`git clone${refArg} --depth 1 "${url}" "${targetDir}"`, {
		stdio: "pipe",
		timeout: 120_000,
	});

	// Install dependencies
	if (existsSync(join(targetDir, "package.json"))) {
		try {
			execSync("npm install --production", {
				cwd: targetDir,
				stdio: "pipe",
				timeout: 120_000,
			});
		} catch {
			// Non-fatal
		}
	}

	const registry = loadRegistry(zosmaDir);
	registry.extensions[safeName] = {
		enabled: true,
		installedAt: new Date().toISOString(),
		source: { ...source },
	};
	saveRegistry(zosmaDir, registry);

	return buildExtensionEntry(zosmaDir, safeName, targetDir, registry);
}

function installFromLocal(zosmaDir: string, extDir: string, source: ExtensionSource): ZemExtension {
	const srcPath = resolve(source.value);
	const baseName = basename(srcPath)
		.replace(/^@/, "")
		.replace(/\//g, "-")
		.replace(/[^a-z0-9._-]/gi, "_");
	const targetDir = join(extDir, baseName);

	if (!existsSync(srcPath)) {
		throw new Error(`Local path not found: ${srcPath}`);
	}

	// For local paths, symlink or copy
	if (existsSync(targetDir)) {
		rmSync(targetDir, { recursive: true, force: true });
	}

	try {
		// Try symlink first
		execSync(`ln -sf "${srcPath}" "${targetDir}"`, { stdio: "pipe" });
	} catch {
		// Fall back to copy for non-Unix
		execSync(`cp -r "${srcPath}" "${targetDir}"`, { stdio: "pipe" });
	}

	const registry = loadRegistry(zosmaDir);
	registry.extensions[baseName] = {
		enabled: true,
		installedAt: new Date().toISOString(),
		source: { type: "local", value: source.value },
	};
	saveRegistry(zosmaDir, registry);

	return buildExtensionEntry(zosmaDir, baseName, targetDir, registry);
}

// ─── Uninstall ───────────────────────────────────────────────────────

export function uninstallExtension(zosmaDir: string, extensionId: string): void {
	const registry = loadRegistry(zosmaDir);
	if (!registry.extensions[extensionId]) {
		throw new Error(`Extension not found: ${extensionId}`);
	}

	const entry = registry.extensions[extensionId];
	delete registry.extensions[extensionId];
	saveRegistry(zosmaDir, registry);

	// Remove from disk
	const installPath = join(extensionsDir(zosmaDir), extensionId);
	if (existsSync(installPath)) {
		rmSync(installPath, { recursive: true, force: true });
	}

	// Also clean up from pi settings if it was managed there
	if (entry.source.type === "npm" || entry.source.type === "git") {
		try {
			const settings = loadPiSettings(zosmaDir);
			if (settings.packages) {
				const idx = settings.packages.indexOf(entry.source.value);
				if (idx >= 0) {
					settings.packages.splice(idx, 1);
					writeFileSync(settingsFile(zosmaDir), JSON.stringify(settings, null, 2), "utf-8");
				}
			}
		} catch {
			// Non-fatal
		}
	}
}

// ─── Enable / Disable ───────────────────────────────────────────────

export function setExtensionEnabled(zosmaDir: string, extensionId: string, enabled: boolean): void {
	const registry = loadRegistry(zosmaDir);
	if (!registry.extensions[extensionId]) {
		throw new Error(`Extension not found: ${extensionId}`);
	}
	registry.extensions[extensionId].enabled = enabled;
	saveRegistry(zosmaDir, registry);
}

// ─── Config ─────────────────────────────────────────────────────────

export function setExtensionConfig(
	zosmaDir: string,
	extensionId: string,
	config: Record<string, unknown>,
): void {
	const registry = loadRegistry(zosmaDir);
	if (!registry.extensions[extensionId]) {
		throw new Error(`Extension not found: ${extensionId}`);
	}
	registry.extensions[extensionId].config = config;
	saveRegistry(zosmaDir, registry);
}

// ─── NPM Registry Search ────────────────────────────────────────────

const NPM_REGISTRY = "https://registry.npmjs.org";

/**
 * Search npm for packages that might be pi-compatible extensions.
 * Looks for:
 * - Packages with the "pi" keyword in package.json
 * - Packages with a "pi" or "piConfig" field in package.json
 * - Packages under known pi-related scopes
 */
/**
 * Default search queries mapped to their npm search filters.
 */
const DEFAULT_SEARCHES = [
	"keywords:pi-package", // Official pi packages
	"keywords:pi-extension", // Pi extensions
	"@earendil-works/pi-", // Official pi mono packages
];

/**
 * Search npm for packages. If the query looks like a default search hint
 * (e.g., "pi extensions" or "@zosmaai"), we use a curated query.
 * Otherwise we search the raw text.
 */
export function buildSearchQuery(query: string): string {
	const lower = query.toLowerCase().trim();
	// Map common search terms to npm search filters
	if (
		lower === "pi" ||
		lower === "pi extensions" ||
		lower === "pi packages" ||
		lower === "keywords:pi"
	) {
		return "keywords:pi-package";
	}
	if (lower.startsWith("scope:") || lower.startsWith("keywords:") || lower.startsWith("@")) {
		return query; // Already an npm search syntax
	}
	if (lower.startsWith("@zosmaai")) {
		return "scope:@zosmaai keywords:pi";
	}
	// General search — look for pi-related packages
	return `${query} keywords:pi-package`;
}

export async function searchNpmRegistry(query: string): Promise<
	{
		name: string;
		description: string;
		version: string;
		score: number;
	}[]
> {
	const searchQuery = buildSearchQuery(query);
	const url = `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(searchQuery)}&size=20`;

	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) throw new Error(`npm search returned ${response.status}`);
		const data = (await response.json()) as {
			objects: Array<{
				package: {
					name: string;
					description: string;
					version: string;
					keywords?: string[];
				};
				score: { detail: { quality: number; popularity: number; maintenance: number } };
			}>;
		};

		return data.objects.map((obj) => ({
			name: obj.package.name,
			description: obj.package.description || "",
			version: obj.package.version,
			score: Math.round(
				((obj.score.detail.quality + obj.score.detail.popularity + obj.score.detail.maintenance) /
					3) *
					100,
			),
		}));
	} catch (err) {
		log("npm search failed: %s", err instanceof Error ? err.message : String(err));
		return [];
	}
}

/**
 * Get details about a specific npm package (to check if it's pi-compatible).
 * Returns the package metadata including the `pi` config field.
 */
export async function getPackageDetails(pkgName: string): Promise<{
	name: string;
	description: string;
	version: string;
	isPiPackage: boolean;
	piConfig?: Record<string, unknown>;
} | null> {
	const url = `${NPM_REGISTRY}/${encodeURIComponent(pkgName).replace(/^%40/, "@")}`;

	try {
		const response = await fetch(url, {
			signal: AbortSignal.timeout(10_000),
		});
		if (!response.ok) return null;
		const data = (await response.json()) as {
			name: string;
			description: string;
			version: string;
			keywords?: string[];
		};

		const isPiPackage =
			data.keywords?.includes("pi") ||
			data.keywords?.includes("pi-extension") ||
			data.keywords?.includes("zosma") ||
			data.name?.startsWith("@zosmaai/") ||
			data.name?.startsWith("@earendil-works/pi-");

		return {
			name: data.name,
			description: data.description || "",
			version: data.version,
			isPiPackage,
		};
	} catch {
		return null;
	}
}

// ─── Logging ─────────────────────────────────────────────────────────

function log(...args: unknown[]) {
	process.stderr.write(`[ext-manager] ${args.join(" ")}\n`);
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Recursively copy a file or directory */
function copyRecursiveSync(src: string, dest: string): void {
	try {
		const stat = statSync(src);
		if (stat.isDirectory()) {
			mkdirSync(dest, { recursive: true });
			const entries = readdirSync(src);
			for (const entry of entries) {
				copyRecursiveSync(join(src, entry), join(dest, entry));
			}
		} else {
			writeFileSync(dest, readFileSync(src));
		}
	} catch (err) {
		log("copyRecursiveSync error: %s", err instanceof Error ? err.message : String(err));
	}
}

function parseSource(source: string, ref?: string): ExtensionSource {
	if (source.startsWith("npm:") || source.startsWith("@")) {
		const value = source.startsWith("npm:") ? source.slice(4) : source;
		return { type: "npm", value, ref };
	}
	if (
		source.startsWith("git:") ||
		source.startsWith("http://") ||
		source.startsWith("https://") ||
		source.startsWith("ssh://") ||
		source.startsWith("git@")
	) {
		const value = source.startsWith("git:") ? source.slice(4) : source;
		return { type: "git", value, ref };
	}
	if (
		source.startsWith("/") ||
		source.startsWith("./") ||
		source.startsWith("../") ||
		isAbsolute(source)
	) {
		return { type: "local", value: source };
	}
	// Default to npm
	return { type: "npm", value: source, ref };
}

function buildExtensionEntry(
	zosmaDir: string,
	id: string,
	installPath: string,
	registry: ExtensionRegistry,
): ZemExtension {
	const entry = registry.extensions[id];
	const meta = readExtensionMeta(installPath);
	return {
		id,
		name: meta?.name || id,
		version: meta?.version || "0.0.0",
		description: meta?.description || "",
		author: meta?.author,
		icon: meta?.icon,
		category: meta?.category,
		source: entry?.source || { type: "local", value: installPath },
		capabilities: meta?.capabilities || {},
		runtime: detectRuntime(installPath),
		installed: true,
		enabled: entry?.enabled ?? true,
		installPath,
		config: entry?.config,
		configSchema: meta?.configSchema,
	};
}
