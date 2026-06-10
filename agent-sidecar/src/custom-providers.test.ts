/**
 * Tests for the custom-OpenAI-compatible provider store.
 *
 * Issue #207 — the desktop app needs a way to point pi-mono at a local
 * inference server (Ollama, LM Studio, vLLM, llama.cpp `--server`, …) by
 * supplying just a base URL and an optional API key. pi-mono's
 * `ModelRegistry` already speaks `models.json`'s `providers.<id>` shape;
 * this module is the thin upsert/list/delete layer the sidecar exposes
 * to the UI.
 *
 * The most important guarantee here is the round-trip with the real
 * `ModelRegistry`: whatever we write to models.json MUST be loaded back
 * as a usable `Model<Api>` so the model dropdown lights up. That's the
 * last test below — fail-loud against pi-coding-agent's own validator.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AuthStorage, ModelRegistry } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	deleteCustomProvider,
	listCustomProviders,
	saveCustomProvider,
} from "./custom-providers.js";

const VALID_INPUT = {
	id: "custom-local-llm",
	name: "Custom Local LLM",
	baseUrl: "http://localhost:11434/v1",
	models: [{ id: "llama3.1:8b", name: "Llama 3.1 8B (local)" }],
};

describe("custom-providers", () => {
	let dir: string;
	let modelsPath: string;
	let authPath: string;

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "zosma-custom-providers-"));
		modelsPath = join(dir, "models.json");
		authPath = join(dir, "auth.json");
	});
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true });
	});

	// ── saveCustomProvider ─────────────────────────────────────────────

	it("writes a fresh models.json with the canonical providers.<id> shape", () => {
		saveCustomProvider(modelsPath, { ...VALID_INPUT, apiKey: "sk-test-1234" });

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"]).toMatchObject({
			name: "Custom Local LLM",
			baseUrl: "http://localhost:11434/v1",
			apiKey: "sk-test-1234",
			api: "openai-completions",
			models: [{ id: "llama3.1:8b", name: "Llama 3.1 8B (local)" }],
		});
	});

	it("creates the parent directory if missing", () => {
		const nestedPath = join(dir, "deep", "nested", "models.json");
		saveCustomProvider(nestedPath, VALID_INPUT);
		expect(existsSync(nestedPath)).toBe(true);
	});

	it("merges with an existing models.json without clobbering other providers", () => {
		writeFileSync(
			modelsPath,
			JSON.stringify({
				providers: {
					"other-provider": { baseUrl: "https://example.com/v1", apiKey: "k" },
				},
			}),
		);

		saveCustomProvider(modelsPath, VALID_INPUT);

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(Object.keys(config.providers).sort()).toEqual([
			"custom-local-llm",
			"other-provider",
		]);
		expect(config.providers["other-provider"].baseUrl).toBe("https://example.com/v1");
	});

	it("overwrites an existing entry with the same id (idempotent re-save)", () => {
		saveCustomProvider(modelsPath, VALID_INPUT);
		saveCustomProvider(modelsPath, {
			...VALID_INPUT,
			baseUrl: "http://localhost:1234/v1",
			models: [{ id: "phi-3-mini" }],
		});

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"].baseUrl).toBe("http://localhost:1234/v1");
		expect(config.providers["custom-local-llm"].models).toEqual([
			{ id: "phi-3-mini", name: "phi-3-mini" },
		]);
	});

	it("strips a trailing slash from the base URL so the OpenAI client doesn't double it", () => {
		saveCustomProvider(modelsPath, { ...VALID_INPUT, baseUrl: "http://localhost:11434/v1/" });

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"].baseUrl).toBe("http://localhost:11434/v1");
	});

	// pi-coding-agent's ModelRegistry.validateConfig REQUIRES an apiKey for
	// any non-built-in provider that defines custom models, even though local
	// servers like Ollama/LM Studio ignore the Authorization header. We store
	// a sentinel placeholder so the validator passes; the user can override
	// it later from the UI without breaking anything.
	it("stores a sentinel placeholder when the API key is omitted", () => {
		saveCustomProvider(modelsPath, VALID_INPUT);

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"].apiKey).toBe("no-auth");
	});

	it("treats an empty-string API key the same as omitted (placeholder)", () => {
		saveCustomProvider(modelsPath, { ...VALID_INPUT, apiKey: "" });

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"].apiKey).toBe("no-auth");
	});

	// Edit flow: the raw key never round-trips to the UI, so re-saving with a
	// blank key must KEEP the previously stored key, not wipe it to the sentinel.
	it("preserves an existing real API key when re-saved with a blank key (edit)", () => {
		saveCustomProvider(modelsPath, { ...VALID_INPUT, apiKey: "sk-keep-me" });
		// Edit the model id, leave the key field blank.
		saveCustomProvider(modelsPath, {
			...VALID_INPUT,
			apiKey: undefined,
			models: [{ id: "phi-3-mini" }],
		});

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"].apiKey).toBe("sk-keep-me");
		expect(config.providers["custom-local-llm"].models).toEqual([
			{ id: "phi-3-mini", name: "phi-3-mini" },
		]);
	});

	it("does not invent a key when a keyless provider is re-saved blank (stays sentinel)", () => {
		saveCustomProvider(modelsPath, VALID_INPUT);
		saveCustomProvider(modelsPath, { ...VALID_INPUT, baseUrl: "http://localhost:9999/v1" });

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"].apiKey).toBe("no-auth");
	});

	// ── validation ─────────────────────────────────────────────────────

	it("rejects an empty id", () => {
		expect(() => saveCustomProvider(modelsPath, { ...VALID_INPUT, id: "" })).toThrow(
			/id/i,
		);
	});

	it("rejects an empty name", () => {
		expect(() => saveCustomProvider(modelsPath, { ...VALID_INPUT, name: "  " })).toThrow(
			/name/i,
		);
	});

	it("rejects an empty base URL", () => {
		expect(() => saveCustomProvider(modelsPath, { ...VALID_INPUT, baseUrl: "" })).toThrow(
			/url/i,
		);
	});

	it("rejects a non-http(s) base URL", () => {
		expect(() =>
			saveCustomProvider(modelsPath, { ...VALID_INPUT, baseUrl: "ftp://nope" }),
		).toThrow(/url/i);
	});

	it("rejects an empty models array", () => {
		expect(() => saveCustomProvider(modelsPath, { ...VALID_INPUT, models: [] })).toThrow(
			/model/i,
		);
	});

	it("rejects a model with an empty id", () => {
		expect(() =>
			saveCustomProvider(modelsPath, { ...VALID_INPUT, models: [{ id: "  " }] }),
		).toThrow(/model/i);
	});

	// ── listCustomProviders ────────────────────────────────────────────

	it("lists saved providers with a masked API-key hint, never the raw key", () => {
		saveCustomProvider(modelsPath, { ...VALID_INPUT, apiKey: "sk-test-abcd1234" });

		const list = listCustomProviders(modelsPath);
		expect(list).toEqual([
			{
				id: "custom-local-llm",
				name: "Custom Local LLM",
				baseUrl: "http://localhost:11434/v1",
				hasApiKey: true,
				apiKeyHint: "…1234",
				models: [{ id: "llama3.1:8b", name: "Llama 3.1 8B (local)" }],
			},
		]);
		// Belt-and-braces: the raw key must never appear in the serialised list.
		expect(JSON.stringify(list)).not.toContain("sk-test-abcd1234");
	});

	it("reports hasApiKey:false when the stored value is the sentinel placeholder", () => {
		saveCustomProvider(modelsPath, VALID_INPUT);

		const list = listCustomProviders(modelsPath);
		expect(list[0]).toMatchObject({ hasApiKey: false });
		expect(list[0]).not.toHaveProperty("apiKeyHint");
	});

	it("returns [] when models.json is missing", () => {
		expect(listCustomProviders(modelsPath)).toEqual([]);
	});

	it("returns [] when models.json has no providers key", () => {
		writeFileSync(modelsPath, JSON.stringify({}));
		expect(listCustomProviders(modelsPath)).toEqual([]);
	});

	it("returns [] when models.json is corrupt JSON (does not throw)", () => {
		writeFileSync(modelsPath, "{ not valid json");
		expect(listCustomProviders(modelsPath)).toEqual([]);
	});

	// ── deleteCustomProvider ───────────────────────────────────────────

	it("removes the entry and leaves siblings intact", () => {
		writeFileSync(
			modelsPath,
			JSON.stringify({
				providers: {
					"keep-me": { baseUrl: "https://example.com/v1", apiKey: "k" },
				},
			}),
		);
		saveCustomProvider(modelsPath, VALID_INPUT);

		deleteCustomProvider(modelsPath, "custom-local-llm");

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(Object.keys(config.providers)).toEqual(["keep-me"]);
	});

	it("is a no-op when the provider id is unknown", () => {
		saveCustomProvider(modelsPath, VALID_INPUT);
		expect(() => deleteCustomProvider(modelsPath, "ghost")).not.toThrow();

		const config = JSON.parse(readFileSync(modelsPath, "utf-8"));
		expect(config.providers["custom-local-llm"]).toBeDefined();
	});

	it("is a no-op when models.json doesn't exist", () => {
		expect(() => deleteCustomProvider(modelsPath, "anything")).not.toThrow();
	});

	// ── ROUND-TRIP with the real pi-coding-agent ModelRegistry ─────────
	//
	// This is the keystone test. If pi-mono can't load what we wrote, the
	// user clicks Save and gets an invisible failure — the dropdown stays
	// empty. We verify against ModelRegistry itself, not a mock.

	it("round-trips: saved models become loadable by pi-coding-agent ModelRegistry", () => {
		saveCustomProvider(modelsPath, {
			...VALID_INPUT,
			apiKey: "sk-test-1234",
			models: [
				{ id: "llama3.1:8b", name: "Llama 3.1 8B (local)", contextWindow: 131072 },
				{ id: "qwen2.5-coder:7b" },
			],
		});

		const authStorage = AuthStorage.create(authPath);
		const registry = ModelRegistry.create(authStorage, modelsPath);

		expect(registry.getError()).toBeUndefined();
		const ours = registry
			.getAll()
			.filter((m) => m.provider === "custom-local-llm")
			.map((m) => ({ id: m.id, name: m.name, baseUrl: m.baseUrl, api: m.api }));
		expect(ours).toEqual([
			{
				id: "llama3.1:8b",
				name: "Llama 3.1 8B (local)",
				baseUrl: "http://localhost:11434/v1",
				api: "openai-completions",
			},
			{
				id: "qwen2.5-coder:7b",
				name: "qwen2.5-coder:7b",
				baseUrl: "http://localhost:11434/v1",
				api: "openai-completions",
			},
		]);
	});

	it("round-trips even with no user-supplied API key (sentinel keeps the validator happy)", () => {
		saveCustomProvider(modelsPath, VALID_INPUT);

		const authStorage = AuthStorage.create(authPath);
		const registry = ModelRegistry.create(authStorage, modelsPath);

		expect(registry.getError()).toBeUndefined();
		expect(registry.getAll().some((m) => m.provider === "custom-local-llm")).toBe(true);
	});
});
