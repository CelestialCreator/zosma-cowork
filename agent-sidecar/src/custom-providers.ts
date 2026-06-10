/**
 * Custom OpenAI-compatible provider store (issue #207).
 *
 * The Authentication UI used to offer subscriptions (Claude/Copilot/Codex)
 * and API keys for pi-mono's ~30 built-in providers, but never a "point me
 * at my local server" path. pi-mono already speaks the OpenAI Chat
 * Completions wire protocol against any `baseUrl`, exposed through its
 * `ModelRegistry` via `models.json`'s `providers.<id>` map. This module is
 * the thin upsert/list/delete layer the sidecar exposes to the UI.
 *
 * Why the `NO_AUTH_SENTINEL` placeholder: pi-coding-agent's
 * `ModelRegistry.validateConfig` requires a non-empty `apiKey` for any
 * non-built-in provider that ships custom models, even though local
 * inference servers (Ollama, LM Studio, llama.cpp `--server`,
 * text-generation-webui) ignore the Authorization header. Storing a
 * sentinel keeps the validator happy without making the user invent a
 * fake key in the UI.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/** Sentinel stored when the user leaves the API-key field blank. See header. */
export const NO_AUTH_SENTINEL = "no-auth";

/** Input shape the sidecar accepts from the Tauri layer. */
export interface SaveCustomProviderInput {
	/** Slug used as the providers map key (e.g. "custom-local-llm"). */
	id: string;
	/** Human-friendly label shown in the model selector. */
	name: string;
	/** OpenAI-compatible base URL, e.g. "http://localhost:11434/v1". */
	baseUrl: string;
	/** Optional. Omit or empty → stored as the NO_AUTH_SENTINEL. */
	apiKey?: string;
	/** At least one entry; each needs a non-empty id. */
	models: Array<{
		id: string;
		name?: string;
		contextWindow?: number;
		maxTokens?: number;
	}>;
}

/** Outward-facing summary — never leaks the raw API key. */
export interface CustomProviderSummary {
	id: string;
	name: string;
	baseUrl: string;
	hasApiKey: boolean;
	/** Last 4 chars only, shown like "…abcd". Only present when hasApiKey. */
	apiKeyHint?: string;
	models: Array<{ id: string; name: string }>;
}

// ─── internal helpers ──────────────────────────────────────────────────

type ProvidersMap = Record<string, Record<string, unknown>>;
type ModelsConfig = { providers: ProvidersMap };

function readConfig(modelsPath: string): ModelsConfig {
	if (!existsSync(modelsPath)) return { providers: {} };
	try {
		const raw = JSON.parse(readFileSync(modelsPath, "utf-8"));
		if (!raw || typeof raw !== "object") return { providers: {} };
		const providers =
			raw.providers && typeof raw.providers === "object" && !Array.isArray(raw.providers)
				? (raw.providers as ProvidersMap)
				: {};
		return { ...raw, providers };
	} catch {
		// Corrupt JSON: pretend the file is empty. Caller's save will replace it.
		return { providers: {} };
	}
}

function writeConfig(modelsPath: string, config: ModelsConfig): void {
	mkdirSync(dirname(modelsPath), { recursive: true });
	writeFileSync(modelsPath, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
}

function require_(field: string, value: unknown): string {
	if (typeof value !== "string" || value.trim().length === 0) {
		throw new Error(`Custom provider: "${field}" is required`);
	}
	return value.trim();
}

function normaliseBaseUrl(raw: string): string {
	const trimmed = require_("baseUrl", raw);
	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error('Custom provider: "baseUrl" must be a valid URL');
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		throw new Error('Custom provider: "baseUrl" must use http(s)');
	}
	// pi-ai appends the path component itself, so strip the trailing slash.
	return trimmed.replace(/\/+$/, "");
}

function validateInput(input: SaveCustomProviderInput): {
	id: string;
	name: string;
	baseUrl: string;
	apiKey: string;
	models: Array<{ id: string; name: string; contextWindow?: number; maxTokens?: number }>;
} {
	const id = require_("id", input.id);
	const name = require_("name", input.name);
	const baseUrl = normaliseBaseUrl(input.baseUrl);

	if (!Array.isArray(input.models) || input.models.length === 0) {
		throw new Error('Custom provider: at least one model is required');
	}
	const models = input.models.map((m, i) => {
		const modelId = require_(`models[${i}].id`, m?.id);
		return {
			id: modelId,
			name: m.name && m.name.trim().length > 0 ? m.name.trim() : modelId,
			...(m.contextWindow !== undefined ? { contextWindow: m.contextWindow } : {}),
			...(m.maxTokens !== undefined ? { maxTokens: m.maxTokens } : {}),
		};
	});

	const apiKey =
		typeof input.apiKey === "string" && input.apiKey.trim().length > 0
			? input.apiKey.trim()
			: NO_AUTH_SENTINEL;

	return { id, name, baseUrl, apiKey, models };
}

// ─── public API ────────────────────────────────────────────────────────

/** Upsert a custom provider into models.json. Throws on invalid input. */
export function saveCustomProvider(modelsPath: string, input: SaveCustomProviderInput): void {
	const v = validateInput(input);
	const config = readConfig(modelsPath);
	// Edit flow: the raw API key never round-trips to the UI, so a blank key
	// field (→ NO_AUTH_SENTINEL here) on an *existing* provider means "keep the
	// current key", not "clear it". Preserve a previously stored real key so
	// editing the base URL or model id doesn't silently drop auth. To switch a
	// keyed provider back to keyless, delete and re-create it.
	let apiKey = v.apiKey;
	if (apiKey === NO_AUTH_SENTINEL) {
		const prev = config.providers[v.id];
		const prevKey = prev && typeof prev.apiKey === "string" ? prev.apiKey : "";
		if (prevKey && prevKey !== NO_AUTH_SENTINEL) {
			apiKey = prevKey;
		}
	}
	config.providers[v.id] = {
		name: v.name,
		baseUrl: v.baseUrl,
		apiKey,
		api: "openai-completions",
		models: v.models,
	};
	writeConfig(modelsPath, config);
}

/** Remove a provider entry. No-op when missing. */
export function deleteCustomProvider(modelsPath: string, providerId: string): void {
	if (!existsSync(modelsPath)) return;
	const config = readConfig(modelsPath);
	if (!(providerId in config.providers)) return;
	delete config.providers[providerId];
	writeConfig(modelsPath, config);
}

/** List user-added providers (those carrying our own canonical shape). */
export function listCustomProviders(modelsPath: string): CustomProviderSummary[] {
	const config = readConfig(modelsPath);
	const out: CustomProviderSummary[] = [];
	for (const [id, raw] of Object.entries(config.providers)) {
		// Be defensive: we only own entries that look like our shape (baseUrl +
		// models array). pi-mono allows override-only entries against built-in
		// providers — we deliberately skip those so the UI doesn't try to edit
		// them.
		if (typeof raw !== "object" || raw === null) continue;
		const baseUrl = typeof raw.baseUrl === "string" ? raw.baseUrl : "";
		const name = typeof raw.name === "string" && raw.name.trim() ? raw.name : id;
		const rawModels = Array.isArray(raw.models) ? raw.models : [];
		if (!baseUrl || rawModels.length === 0) continue;

		const apiKey = typeof raw.apiKey === "string" ? raw.apiKey : "";
		const hasApiKey = apiKey.length > 0 && apiKey !== NO_AUTH_SENTINEL;

		const summary: CustomProviderSummary = {
			id,
			name,
			baseUrl,
			hasApiKey,
			models: rawModels
				.filter(
					(m): m is { id: string; name?: string } =>
						typeof m === "object" && m !== null && typeof (m as { id: unknown }).id === "string",
				)
				.map((m) => ({ id: m.id, name: m.name && m.name.trim() ? m.name : m.id })),
		};
		if (hasApiKey) {
			summary.apiKeyHint = `…${apiKey.slice(-4)}`;
		}
		out.push(summary);
	}
	return out;
}
