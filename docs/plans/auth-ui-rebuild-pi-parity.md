# Auth UI rebuild — pi `/login` parity (fixes #150)

## Goal

Replace the current single-provider hardcoded auth UI with pi-coding-agent's
two-step `/login` UX so every provider pi-ai supports (32 today, including
`openrouter`) is reachable, without us maintaining a hardcoded provider list.

## Root cause of #150

`src/hooks/useAuth.ts` and `src/components/HomeView.tsx` both call:

```ts
invoke("save_auth_key", { provider: "opencode-go", key })
```

Every API key the user pastes — OpenRouter, Anthropic raw, OpenAI, Groq, etc. —
is written to disk under the `opencode-go` slot, so `ModelRegistry` never
resolves it for the real provider. The Rust command and sidecar handler are
already generic; only the frontend hardcoded the id.

## Non-goals

- Adding new providers to pi-mono (pi-ai already ships 32).
- ~~Custom OpenAI-compat base-URL UI (already covered by `models.json`
  custom-model definitions in pi-mono; future enhancement, not blocking #150).~~
  **Done in #207** — see `src/components/settings/CustomProviderRow.tsx`
  and `agent-sidecar/src/custom-providers.ts`.
- Identity/system-prompt changes (issue #112 already handled).

## UX (mirrors `pi-coding-agent`'s login-dialog)

```
┌─ Authentication ──────────────────────────────────────┐
│  Connected:                                           │
│   ✓  Claude Pro/Max (subscription)        Sign out   │
│   ✓  OpenAI (api key, sk-…abc1)           Remove     │
│                                                       │
│  + Add credential ▼                                   │
└───────────────────────────────────────────────────────┘
         │
         ▼ click
┌─ Add credential — step 1 of 2 ────────────────────────┐
│   ⬤ Use a subscription   (Claude Pro, ChatGPT Plus,   │
│                           GitHub Copilot)             │
│   ○ Use an API key       (any provider)               │
│                       [ Continue ]   [ Cancel ]       │
└───────────────────────────────────────────────────────┘
         │
   ┌─────┴─────┐
   ▼           ▼
[Step 2a]    [Step 2b]

Step 2a — Subscription
┌───────────────────────────────────────────────────────┐
│   ⬤ Claude Pro/Max         (anthropic OAuth)         │
│   ○ ChatGPT Plus/Pro       (openai-codex OAuth)      │
│   ○ GitHub Copilot         (github-copilot device)   │
│                       [ Sign in ]   [ Back ]         │
└───────────────────────────────────────────────────────┘

Step 2b — API key (provider picker, searchable)
┌───────────────────────────────────────────────────────┐
│   [ search providers… ]                              │
│   ────────────────────────────                       │
│   ⬤  OpenRouter            openrouter                │
│   ○  Anthropic             anthropic                 │
│   ○  OpenAI                openai                    │
│   ○  Groq                  groq                      │
│   ○  Mistral               mistral                   │
│   ○  Google                google                    │
│   …                                                  │
│   ────────────────────────────                       │
│   Key:  [ sk-or-… ]                  👁 reveal       │
│                       [ Save ]   [ Back ]            │
└───────────────────────────────────────────────────────┘
```

## Architecture (no new SDK calls; we already have everything)

### Sidecar (`agent-sidecar/src/index.ts`)

Extend the existing `get_auth_status` response shape:

```ts
// before
{ providers: [{ id, type, expires? }], supported: string[] }

// after (backwards-compatible — `supported` retained)
{
  providers:        [{ id, type, expires? }],   // unchanged
  supported:        string[],                   // unchanged (= oauthProviders ids)
  oauthProviders:   [{ id, name }],             // NEW — from authStorage.getOAuthProviders()
  apiKeyProviders:  [{ id, displayName }],      // NEW — modelRegistry.getAll(),
                                                //       deduped by provider,
                                                //       displayName via
                                                //       modelRegistry.getProviderDisplayName(id)
}
```

No new SDK calls — both arrays come from objects we already construct at boot.

Also add a `logout_provider` message handler that calls
`authStorage.remove(provider)` — the Rust side already invokes it via the
existing pipeline; the sidecar just needs to honor it (verify with grep,
fix if missing).

### Rust (`src-tauri/src/lib.rs`)

No surface change. `save_auth_key(provider, key)` is already generic and
correct. Confirm `logout_provider(provider)` is wired (it appears to be —
referenced in the auth-section docstring).

### Frontend

New files:

- `src/components/auth/AddCredentialDialog.tsx`
  Three-screen state machine (`type-picker → subscription-picker | apikey-picker`).
  Reuses existing `oauth_*` event listeners from `ProviderAuthSection` for step 2a.
- `src/components/auth/ProviderPicker.tsx`
  Searchable list of `apiKeyProviders` from `get_auth_status`.
  Brand icons for known IDs, generic key icon fallback.
- `src/components/auth/ApiKeyForm.tsx`
  Reusable key input with reveal/copy, validates non-empty, calls
  `invoke("save_auth_key", { provider: <picked>, key })`.

Refactored files:

- `src/hooks/useAuth.ts`
  - `saveApiKey(apiKey)` → `saveApiKey(provider, apiKey)`.
  - Drop hardcoded `"opencode-go"`.
- `src/components/settings/Authentication.tsx`
  - Replace OAuth-only row list with a **connected credentials** list
    (from `authStatus.providers`) plus an **+ Add credential** button that
    opens `AddCredentialDialog`.
  - Remove `PROVIDERS_CONFIG` constant.
- `src/components/HomeView.tsx`
  - Replace any inline `save_auth_key("opencode-go", …)` call with the
    dialog flow.
- `src/components/ProviderAuthSection.tsx`
  - Keep as the per-provider OAuth row component used inside
    `AddCredentialDialog` step 2a (drop the `provider` prop assumption that
    it's pre-known; pass picked id).

### Brand-icon mapping

Add to `src/components/BrandIcons.tsx`:

```ts
export const PROVIDER_ICONS: Record<string, React.FC<{className?:string}>> = {
  anthropic: ClaudeIcon,
  openai: OpenAIIcon,
  "openai-codex": OpenAIIcon,
  "github-copilot": GitHubIcon,
  openrouter: OpenRouterIcon,     // new SVG
  google: GoogleIcon,             // new SVG
  "google-vertex": GoogleIcon,
  mistral: MistralIcon,           // new SVG
  groq: GroqIcon,                 // new SVG
  deepseek: DeepSeekIcon,         // new SVG
  xai: XAIIcon,                   // new SVG
  // …rest fall back to <Key /> from lucide-react
};
```

Add SVGs lazily as needed; missing icons render the generic key glyph.

## Implementation order

1. **Sidecar**: extend `get_auth_status` to return `oauthProviders` +
   `apiKeyProviders`. Verify `logout_provider` is honored.
2. **Frontend types + hook**: update `useAuth.saveApiKey` signature; thread
   the change through call sites (compile error guides us to each one).
3. **Frontend UI**: build `AddCredentialDialog` + `ProviderPicker` +
   `ApiKeyForm`.
4. **Refactor**: replace `Authentication.tsx` body with credentials list +
   add-credential button.
5. **HomeView onboarding**: route first-time users through the dialog
   instead of the hardcoded path.
6. **Tests**:
   - Unit: `useAuth.saveApiKey(provider, key)` issues the correct
     `save_auth_key` invoke with the real provider id.
   - Component: `ProviderPicker` filters by search; `AddCredentialDialog`
     advances through states.
   - Integration: paste an OpenRouter key (`sk-or-…`), pick `openrouter`,
     verify `auth.json` (in tmp dir) has the key under the right slot.
7. **Manual smoke**: round-trip OpenRouter sign-in → model selector lists
   OpenRouter models → send a message → reply arrives.

## Verification for #150

- Paste an OpenRouter key → it's saved under `openrouter`, not
  `opencode-go`.
- `ModelRegistry.getAvailable()` then includes every model whose
  `provider === "openrouter"`.
- Closing #150 requires: screen recording of new dialog + successful
  message round-trip against a real OpenRouter model.

## Out of scope for #150 (track separately)

- ~~Custom OpenAI-compatible base URL input (e.g. self-hosted vLLM, LM Studio,
  Together, etc.). pi-mono already supports this via `models.json` custom
  model definitions; UI can come in a follow-up.~~ **Shipped in #207.**
- `models.json` editor inside settings.
- Multi-account-per-provider (pi-mono treats one credential per provider id).
