import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// extension-manager resolves all resource paths from homedir() (~/.pi/agent),
// so we point HOME at a throwaway dir per test.
let HOME = "";
vi.mock("node:os", async (orig) => {
	const actual = await orig<typeof import("node:os")>();
	return { ...actual, homedir: () => HOME };
});

import { discoverExtensions, installExtension } from "./extension-manager.js";

const piAgent = () => join(HOME, ".pi", "agent");
const extDir = () => join(piAgent(), "extensions");

beforeEach(() => {
	HOME = mkdtempSync(join(tmpdir(), "zem-home-"));
	mkdirSync(piAgent(), { recursive: true });
});

afterEach(() => {
	if (HOME && existsSync(HOME)) rmSync(HOME, { recursive: true, force: true });
});

describe("installFromNpm pi-first guard", () => {
	it("does NOT create a drop-in when pi already manages the package (settings.json packages)", () => {
		// pi declares the package — its own loader owns it.
		writeFileSync(
			join(piAgent(), "settings.json"),
			JSON.stringify({ packages: ["npm:pi-web-access"] }),
		);

		const ext = installExtension(HOME, "pi-web-access");

		// No second physical copy under extensions/ → no tool-name collision.
		expect(existsSync(join(extDir(), "pi-web-access"))).toBe(false);
		expect(ext.source).toEqual({ type: "npm", value: "pi-web-access", ref: undefined });
	});

	it("self-heals a stale drop-in left by a previous buggy install", () => {
		writeFileSync(
			join(piAgent(), "settings.json"),
			JSON.stringify({ packages: ["npm:pi-web-access"] }),
		);
		// Simulate the bug: a leftover extracted copy in extensions/.
		const stale = join(extDir(), "pi-web-access");
		mkdirSync(stale, { recursive: true });
		writeFileSync(join(stale, "index.ts"), "export default () => {};");

		installExtension(HOME, "pi-web-access");

		expect(existsSync(stale)).toBe(false);
	});

	it("treats an already-npm-installed package as pi-managed (no drop-in)", () => {
		// Present in ~/.pi/agent/npm/node_modules even without a packages entry.
		const mod = join(piAgent(), "npm", "node_modules", "pi-web-access");
		mkdirSync(mod, { recursive: true });
		writeFileSync(
			join(mod, "package.json"),
			JSON.stringify({ name: "pi-web-access", version: "0.10.7" }),
		);

		installExtension(HOME, "pi-web-access");

		expect(existsSync(join(extDir(), "pi-web-access"))).toBe(false);
		// And pi's settings.json becomes the source of truth.
		const settings = JSON.parse(
			require("node:fs").readFileSync(join(piAgent(), "settings.json"), "utf-8"),
		);
		expect(settings.packages).toContain("npm:pi-web-access");
	});
});

describe("discoverExtensions dedupe", () => {
	it("lists a package once when it appears in both the cowork registry and pi packages", () => {
		writeFileSync(
			join(piAgent(), "settings.json"),
			JSON.stringify({ packages: ["npm:pi-web-access"] }),
		);
		writeFileSync(
			join(piAgent(), "cowork-extensions.json"),
			JSON.stringify({
				extensions: {
					"pi-web-access": {
						enabled: true,
						installedAt: new Date().toISOString(),
						source: { type: "npm", value: "pi-web-access" },
					},
				},
			}),
		);

		const found = discoverExtensions(HOME).filter(
			(e) => e.id === "pi-web-access" || e.id === "npm:pi-web-access",
		);
		expect(found).toHaveLength(1);
	});
});
