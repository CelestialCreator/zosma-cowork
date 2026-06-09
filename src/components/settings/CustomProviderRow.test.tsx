/**
 * Tests for <CustomProviderRow /> — the "Custom Local LLM" UI for #207.
 *
 * Verifies the user-visible contract:
 *   1. Collapsed by default; clicking the row expands the form.
 *   2. On mount, asks the sidecar for the existing custom providers.
 *   3. Save with valid fields invokes `save_custom_provider` with the
 *      exact payload the sidecar's `SaveCustomProviderInput` expects.
 *   4. An empty API key is forwarded as `undefined` (sidecar substitutes
 *      its sentinel) — the UI never types "no-auth" itself.
 *   5. Existing entries render with a Delete button that invokes
 *      `delete_custom_provider` for that id.
 *   6. Sidecar validation errors surface inline.
 *   7. A successful save dispatches `config-reload` so other panels
 *      (ModelSelector, useAuth, …) refresh.
 */

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CustomProviderRow } from "./CustomProviderRow";

const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
	invoke: (...args: unknown[]) => mockInvoke(...args),
}));

function configureSidecar(
	opts: {
		providers?: Array<{
			id: string;
			name: string;
			baseUrl: string;
			hasApiKey: boolean;
			apiKeyHint?: string;
			models: { id: string; name: string }[];
		}>;
		saveError?: string;
	} = {},
) {
	const { providers = [], saveError } = opts;
	mockInvoke.mockImplementation((cmd: string) => {
		if (cmd === "list_custom_providers") return Promise.resolve({ providers });
		if (cmd === "save_custom_provider") {
			if (saveError) return Promise.reject(saveError);
			return Promise.resolve({ success: true });
		}
		if (cmd === "delete_custom_provider") return Promise.resolve({ success: true });
		return Promise.resolve(null);
	});
}

describe("<CustomProviderRow />", () => {
	beforeEach(() => {
		mockInvoke.mockReset();
		configureSidecar();
	});
	afterEach(() => {
		vi.clearAllMocks();
	});

	it("starts collapsed and shows the label", () => {
		render(<CustomProviderRow onChange={() => {}} />);
		expect(screen.getByText(/custom local llm/i)).toBeInTheDocument();
		expect(screen.queryByLabelText(/base url/i)).not.toBeInTheDocument();
	});

	it("queries the sidecar for existing providers on mount", async () => {
		render(<CustomProviderRow onChange={() => {}} />);
		await waitFor(() => expect(mockInvoke).toHaveBeenCalledWith("list_custom_providers"));
	});

	it("expands the form when the row is clicked", () => {
		render(<CustomProviderRow onChange={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: /custom local llm/i }));
		expect(screen.getByLabelText(/base url/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/model id/i)).toBeInTheDocument();
		// Anchored — the eye toggle button uses an aria-label that also
		// contains "api key", so we match only the form-field label here.
		expect(screen.getByLabelText(/^api key/i)).toBeInTheDocument();
	});

	it("disables Save until base URL + model id are filled", () => {
		render(<CustomProviderRow onChange={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: /custom local llm/i }));
		const save = screen.getByRole("button", { name: /^save$/i });
		expect(save).toBeDisabled();

		fireEvent.change(screen.getByLabelText(/base url/i), {
			target: { value: "http://localhost:11434/v1" },
		});
		expect(save).toBeDisabled();

		fireEvent.change(screen.getByLabelText(/model id/i), {
			target: { value: "llama3.1:8b" },
		});
		expect(save).toBeEnabled();
	});

	it("calls save_custom_provider with the right payload (no API key)", async () => {
		const onChange = vi.fn();
		render(<CustomProviderRow onChange={onChange} />);
		fireEvent.click(screen.getByRole("button", { name: /custom local llm/i }));
		fireEvent.change(screen.getByLabelText(/base url/i), {
			target: { value: "http://localhost:11434/v1" },
		});
		fireEvent.change(screen.getByLabelText(/model id/i), {
			target: { value: "llama3.1:8b" },
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
		});

		expect(mockInvoke).toHaveBeenCalledWith("save_custom_provider", {
			provider: {
				id: "custom-local-llm",
				name: "Custom Local LLM",
				baseUrl: "http://localhost:11434/v1",
				apiKey: undefined,
				models: [{ id: "llama3.1:8b" }],
			},
		});
		await waitFor(() => expect(onChange).toHaveBeenCalled());
	});

	it("forwards a typed API key verbatim", async () => {
		render(<CustomProviderRow onChange={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: /custom local llm/i }));
		fireEvent.change(screen.getByLabelText(/base url/i), {
			target: { value: "https://my-gateway.example/v1" },
		});
		fireEvent.change(screen.getByLabelText(/model id/i), {
			target: { value: "llama3.1:70b" },
		});
		fireEvent.change(screen.getByLabelText(/^api key/i), {
			target: { value: "sk-test-1234" },
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
		});

		expect(mockInvoke).toHaveBeenCalledWith(
			"save_custom_provider",
			expect.objectContaining({
				provider: expect.objectContaining({ apiKey: "sk-test-1234" }),
			}),
		);
	});

	it("dispatches config-reload after a successful save so other panels refresh", async () => {
		const reloadHandler = vi.fn();
		window.addEventListener("config-reload", reloadHandler);
		try {
			render(<CustomProviderRow onChange={() => {}} />);
			fireEvent.click(screen.getByRole("button", { name: /custom local llm/i }));
			fireEvent.change(screen.getByLabelText(/base url/i), {
				target: { value: "http://localhost:11434/v1" },
			});
			fireEvent.change(screen.getByLabelText(/model id/i), {
				target: { value: "llama3.1:8b" },
			});
			await act(async () => {
				fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
			});
			await waitFor(() => expect(reloadHandler).toHaveBeenCalled());
		} finally {
			window.removeEventListener("config-reload", reloadHandler);
		}
	});

	it("surfaces sidecar validation errors inline", async () => {
		configureSidecar({ saveError: 'Custom provider: "baseUrl" must use http(s)' });
		render(<CustomProviderRow onChange={() => {}} />);
		fireEvent.click(screen.getByRole("button", { name: /custom local llm/i }));
		fireEvent.change(screen.getByLabelText(/base url/i), {
			target: { value: "ftp://nope" },
		});
		fireEvent.change(screen.getByLabelText(/model id/i), {
			target: { value: "llama3.1:8b" },
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
		});

		expect(await screen.findByText(/must use http/i)).toBeInTheDocument();
	});

	it("lists existing providers with a Delete button", async () => {
		configureSidecar({
			providers: [
				{
					id: "custom-local-llm",
					name: "Custom Local LLM",
					baseUrl: "http://localhost:11434/v1",
					hasApiKey: false,
					models: [{ id: "llama3.1:8b", name: "llama3.1:8b" }],
				},
			],
		});
		render(<CustomProviderRow onChange={() => {}} />);
		expect(await screen.findByText("http://localhost:11434/v1")).toBeInTheDocument();

		const entry = screen.getByText("http://localhost:11434/v1").closest("li");
		expect(entry).not.toBeNull();
		await act(async () => {
			fireEvent.click(within(entry as HTMLElement).getByRole("button", { name: /delete/i }));
		});

		expect(mockInvoke).toHaveBeenCalledWith("delete_custom_provider", {
			providerId: "custom-local-llm",
		});
	});

	it("shows the API-key hint when one is configured (last 4 chars only)", async () => {
		configureSidecar({
			providers: [
				{
					id: "custom-local-llm",
					name: "Custom Local LLM",
					baseUrl: "https://my-gateway.example/v1",
					hasApiKey: true,
					apiKeyHint: "…1234",
					models: [{ id: "llama3.1:70b", name: "llama3.1:70b" }],
				},
			],
		});
		render(<CustomProviderRow onChange={() => {}} />);
		expect(await screen.findByText("…1234")).toBeInTheDocument();
	});
});
