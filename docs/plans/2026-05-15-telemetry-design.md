# Telemetry & Crash Reporting — Design

**Date**: 2026-05-15
**Status**: Design — ready for implementation

## Overview

Add opt-in anonymous usage analytics (Aptabase) and crash reporting (Sentry) to
Zosma Cowork. Both services are managed cloud free tiers for now; self-hosting
can be revisited later.

## Decisions

| Decision | Choice |
|---|---|
| Consent model | Opt-in, off by default. First-run dialog. |
| Single toggle | One toggle enables both analytics + crash reporting. |
| Managed vs self-hosted | Managed (Aptabase Cloud, Sentry.io) for MVP. |
| Sentry integration | Frontend-only (`@sentry/browser`) for MVP. Native minidumps deferred. |

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 Zosma Cowork App                   │
│                                                    │
│  ┌──────────────────────┐  ┌───────────────────┐   │
│  │   React Frontend      │  │   Rust Backend     │   │
│  │                       │  │                    │   │
│  │ telemetry.ts          │  │ tauri-plugin-      │   │
│  │  ├─ trackEvent()      │  │   aptabase         │   │
│  │  ├─ initSentry()      │  │  (Rust plugin)     │   │
│  │  └─ consent gate      │  │                    │   │
│  │                       │  │ set_telemetry_     │   │
│  │ useTelemetry hook     │  │   enabled IPC cmd   │   │
│  │ consent dialog        │  │                    │   │
│  └───────────────────────┘  └────────┬───────────┘   │
└──────────────────────────────────────┼────────────────┘
                                       │
                        ┌──────────────┴──────────────┐
                        │                              │
                        ▼                              ▼
                  ┌──────────┐                  ┌──────────┐
                  │ Aptabase │                  │  Sentry  │
                  │  Cloud   │                  │  Cloud   │
                  │(analytics)                  │(crashes) │
                  └──────────┘                  └──────────┘
```

## Components

### 1. Telemetry Consent Dialog

- Full-screen centered modal on first launch (before chat is usable)
- Shows: "Help improve Zosma Cowork" + bullet list of what's collected
- Two buttons: "Not Now" (dismiss) / "Enable Telemetry" (opt in)
- Footer note: "You can change this anytime in Settings"
- Check: `get_settings` → `telemetry.enabled` flag. If absent (new user or
  upgrade from pre-telemetry version), show dialog.
- Choice persisted via `save_settings({ telemetry: { enabled: true/false } })`

### 2. Settings Toggle

- Single toggle in Settings panel: "Telemetry"
- Label: "Share anonymous usage data and crash reports"
- Sub-label: "Nothing is sent unless this is enabled."
- Calls `save_settings({ telemetry: { enabled: true/false } })`

### 3. Telemetry Service (`src/lib/telemetry.ts`)

```typescript
interface TelemetryEvent {
  name: string;
  props?: Record<string, string | number | boolean>;
}

// Called once on app mount with the initial consent state
function initTelemetry(enabled: boolean): void;

// Toggle at runtime (from settings change)
function setTelemetryEnabled(enabled: boolean): void;

// Track an event — no-ops when consent is off
function trackEvent(name: string, props?: Record<string, string | number | boolean>): void;
```

Events tracked:

| Event | Properties | When |
|---|---|---|
| `app_launch` | `{version, os, arch}` | App start |
| `app_exit` | — | App close |
| `message_sent` | `{provider, model}` | Per user message |
| `session_created` | — | New chat |
| `export_action` | `{type}` | Copy / Save / Open |
| `file_picked` | `{count}` | File picker |
| `screenshot_pasted` | — | Paste detection |
| `suggested_action` | `{action}` | Quick action click |

### 4. Sentry Integration

- Frontend-only for MVP: `@sentry/browser` npm package
- Init only when consent is ON
- Initialized with: no user context, no session replay, no performance
- Captures: unhandled JS exceptions, breadcrumbs

### 5. Rust-side: Aptabase Plugin

- `tauri-plugin-aptabase` registered via Cargo feature `telemetry`
- App key loaded from `APTABASE_KEY` environment variable at compile time
- `track_event` calls gated behind an `AtomicBool` state managed via new IPC
  command `set_telemetry_enabled`

### 6. IPC Commands

```rust
#[tauri::command]
async fn set_telemetry_enabled(enabled: bool, s: State<'_, TelemetryState>) -> Result<(), String>;
```

`TelemetryState` is a simple `Arc<AtomicBool>` managed as Tauri state.

### 7. Permissions

Add to `capabilities/default.json`:
```json
"aptabase:allow-track-event"
"sentry:default"
```

## Implementation Plan

### Task 1: Rust plugin + IPC
- Add `tauri-plugin-aptabase` dependency (Cargo feature `telemetry`)
- Add `TelemetryState` (`Arc<AtomicBool>`) as managed state
- Register Aptabase plugin in `lib.rs` when `telemetry` feature is active
- Add `set_telemetry_enabled` IPC command
- Add `app_launch` / `app_exit` tracking in Rust
- Update capabilities

### Task 2: Frontend consent dialog
- Create `src/components/TelemetryConsentDialog.tsx` + test
- Create `src/lib/telemetry.ts` + test (service layer)
- Create `src/hooks/useTelemetry.ts` + test
- Add telemetry toggle to Settings panel in `Sidebar.tsx`

### Task 3: Integration into App shell
- Wire consent dialog into `App.tsx` (show on first launch)
- Wire `trackEvent` calls into existing components (MessageInput, ChatMessage,
  SuggestedActions, etc.)
- Wire `app_launch` / `app_exit` on app mount/unmount

### Task 4: First-run detection
- Check `telemetry.enabled` in settings on mount
- If absent (new user / upgrade), show consent dialog
- Persist choice to settings

### Task 5: Sentry frontend integration
- Install `@sentry/browser` npm package
- Initialize in `telemetry.ts` when consent is enabled
- Verify with a test throw

## Future (not in MVP)

- Rust-native sentry via `tauri-plugin-sentry` for minidump capture
- Self-hosted Aptabase / Sentry
- Telemetry dashboard / public stats page
