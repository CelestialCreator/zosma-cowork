# Zosma Cowork 🇮🇳

**English** | [中文](./README.zh.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [Deutsch](./README.de.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [한국어](./README.ko.md) | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> 🇮🇳 **India's first Non-Coding Agentic Work Harness** — The first desktop coworker built on [pi](https://github.com/earendil-works/pi-coding-agent), the minimal agentic work harness. Streaming, thinking, tool calls, multi-turn sessions — all free, all open-source, all local.
>
> **Free yourself — and your non-technical colleagues — from expensive proprietary tools.** Zosma Cowork brings the full [pi extension ecosystem](https://github.com/earendil-works/pi-coding-agent) into a native desktop app. No subscriptions, no usage caps, no lock-in. Just bring your own API key or use local models.
>
> **From India to the World 🌏 — Made with ❤️ by [Zosma AI](https://zosma.ai)**

## Demo

<video src="./assets/demo.mp4" controls width="100%">
  Your browser doesn't support the video tag. [Download the demo](./assets/demo.mp4).
</video>

![Zosma Cowork screenshot](./assets/screenshot.png)

## Why Zosma Cowork?

### 🌟 The First Desktop Coworker Built on pi

Zosma Cowork is the first desktop application built on [pi](https://github.com/earendil-works/pi-coding-agent) — the minimal, language-agnostic coding agent harness. pi's philosophy of simplicity and composability carries directly into your desktop experience. Every pi extension works out of the box, with zero wrappers or adapters.

### 🆓 Free, Not Freemium

No $20/month subscriptions. No feature gates. No usage limits. Zosma Cowork is **100% free and open-source** (MIT). Bring your own API key, use an existing subscription (Claude, ChatGPT, Copilot), or run local models — you control the costs, not a SaaS meter.

### 🧩 Full pi Extension Ecosystem

The [pi ecosystem](https://github.com/earendil-works/pi-coding-agent) includes hundreds of extensions, skills, tools, prompts, and themes — all compatible with Zosma Cowork. Plug them into your `~/.zosmaai/cowork/` directory and they just work. No wrapping, no porting, no lock-in.

#### vs Other Agentic Work Harnesses

| | Zosma Cowork | Claude Code / Sidebar | Cursor / Copilot | Open-source harnesses |
|--|--|--|--|--|
| **Built on pi** | ✅ Full pi SDK | ❌ Proprietary | ❌ Proprietary | ❌ Different base |
| **pi extensions** | ✅ Direct, no adapters | ❌ | ❌ | Partial |
| **Price** | 🆓 Free (MIT) | 💰 $20/mo (Pro) | 💰 $20-40/mo | Varies |
| **Desktop app** | ✅ Tauri v2 native | 🟡 CLI only | IDE-only | CLI-only |
| **Local-first** | ✅ Keys + data stay local | ❌ Cloud-bound | ✅ Partial | Varies |
| **Non-coder friendly** | ✅ Minimal UI, no CLI needed | 🟡 Developer-focused | 🟡 Developer-focused | ❌ CLI-only |
| **Made in India 🇮🇳** | ✅ Built in Bengaluru | ❌ | ❌ | ❌ |

### 👥 Help Your Non-Technical Friends Get Started

Agentic work shouldn't be limited to people who can type CLI commands. **Non-coders deserve a minimal, approachable work harness too.**

Zosma Cowork is designed to be the tool you set up for:
- **Your friend** who wants to use AI but doesn't know where to start
- **Your colleague** on the business side who needs AI assistance without a terminal
- **Your team members** who shouldn't have to pay for an expensive subscription just to try agentic AI

**This is why Indian developers should contribute.** Not because you need another tool — but because your non-technical friends, colleagues, and community members need a free, simple on-ramp into the agentic AI world.

> *"India doesn't just consume technology — we build it, we ship it, we lead it. And we make sure nobody gets left behind."

## Features

- **Node.js agent sidecar** — The pi-mono TypeScript SDK runs in a managed sidecar process for full agent capabilities (extensions, tools, providers)
- **Thin Tauri relay** — The Rust layer is a minimal IPC bridge between React and the sidecar, keeping the native desktop shell lightweight
- **pi extension ecosystem** — Compatible with pi extensions via `DefaultResourceLoader` — skills, tools, and prompts auto-discovered from `~/.zosmaai/cowork/`
- **Multi-turn sessions** — Full conversation continuity with persistent session history
- **Streaming responses** — See the agent think, write, and call tools in real-time
- **Thinking blocks** — Expandable reasoning from the model
- **Tool call timeline** — Live bash/edit/write tool calls with args and results
- **Session management** — Persistent chat sessions saved to `~/.zosmaai/cowork/`
- **Light & dark mode** — Warm cream light mode, warm charcoal dark mode
- **Keyboard shortcuts** — `Cmd/Ctrl+Shift+K` to focus, `Cmd/Ctrl+N` for new session
- **Abort & steering** — Stop a running agent mid-turn, send follow-up steering messages
- **Claude-inspired UI** — 3-column layout with sidebar, workspace, and info panel

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Tauri v2 Desktop Shell (Rust — thin relay)                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌────────────┐  │
│  │  Left Sidebar   │  │  Center Workspace│  │Right Panel │  │
│  │  (Sessions)     │  │  (Chat/Welcome)  │  │(Progress)  │  │
│  └─────────────────┘  └──────────────────┘  └────────────┘  │
│           ▲ React + Tailwind CSS v4                         │
│           │                                                  │
│  ┌────────┴─────────────────────────────────────────────┐   │
│  │  Tauri IPC Commands                                   │   │
│  │  get_models · send_prompt · abort · set_model         │   │
│  │  save_auth · has_credentials · reload                  │   │
│  └────────────┬───────────────────────────┬──────────────┘   │
└───────────────┼───────────────────────────┼──────────────────┘
                │  stdin/stdout JSON lines   │
┌───────────────┼───────────────────────────┼──────────────────┐
│  Agent Sidecar (Node.js)                  │                  │
│  ┌──────────┴──────────────────────────┐ │                  │
│  │  pi-mono SDK (@earendil-works/pi)   │ │                  │
│  │  • AuthStorage — API keys           │ │                  │
│  │  • ModelRegistry — model discovery  │ │                  │
│  │  • SessionManager — conversation    │ │                  │
│  │  • DefaultResourceLoader            │ │                  │
│  │    → extensions, skills, prompts    │ │                  │
│  └──────────┬──────────────────────────┘ │                  │
│             │                              │                  │
│       LLM Providers                        │                  │
│  (OpenAI, Anthropic, Google, ...)          │                  │
└─────────────────────────────────────────────┘                  │
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS v4, Radix UI |
| Desktop Shell | Tauri v2, Rust, Tokio |
| Agent Engine | Node.js sidecar using `@earendil-works/pi-coding-agent` (pi-mono SDK) |
| Testing | Vitest, Testing Library, jsdom |
| Linting | Biome (frontend + sidecar), Clippy (Tauri relay) |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+ (for Tauri desktop shell)

### Quick Start

```bash
# Install frontend dependencies
npm install

# Install agent-sidecar dependencies
cd agent-sidecar && npm install && cd ..

# Run frontend dev server
npm run dev:frontend

# Run full Tauri app (frontend + Rust relay + Node.js sidecar)
npm run dev
```

### Scripts

```bash
# Frontend
npm run lint          # Biome lint
npm run typecheck     # TypeScript check
npm run test          # Vitest run
npm run validate      # lint + typecheck + test
npm run format        # Biome format

# Tauri
npm run build:frontend
npm run build         # Build release binary

# Agent Sidecar
cd agent-sidecar
npm run build         # TypeScript → JavaScript
npm run dev           # tsx watch (standalone development)

# Rust (Tauri relay only)
cargo fmt --all --check
cargo clippy --workspace -- -D warnings
```

## Config & Data

| What | Location | Notes |
|------|----------|-------|
| LLM providers & API keys | `~/.zosmaai/cowork/auth.json` | Managed by the app |
| Model definitions | `~/.zosmaai/cowork/models.json` | Managed by the app |
| Extensions & skills | `~/.zosmaai/cowork/extensions/` | Pi-compatible extensions |
| Session history | `~/.zosmaai/cowork/` | Managed by Zosma Cowork |

## IPC Protocol

The Tauri relay communicates with the Node.js sidecar via stdin/stdout JSON lines:

**Commands (→ sidecar):**

| Command | Description |
|---------|-------------|
| `init` | Initialize agent with zosmaDir config |
| `get_models` | List available models from all providers |
| `prompt` | Send user message, stream events |
| `abort` | Cancel running prompt |
| `set_model` | Switch active model |
| `save_auth` | Save API key for a provider |
| `reload` | Reinitialize with fresh extensions/auth |

**Events (← sidecar):**

| Event | UI Effect |
|-------|-----------|
| `ready` | Models loaded, enable UI |
| `event` | Agent session events (thinking, text, tool calls) |
| `done` | Prompt completed |
| `result` | Response to a request command |
| `error` | Error with message |

## Project Structure

```
zosma-cowork/
├── agent-sidecar/                # Node.js agent process
│   └── src/
│       └── index.ts              # Sidecar: pi-mono SDK, stdin/stdout protocol
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── ChatMessage.tsx       # Message with thinking + tool calls
│   │   ├── ThinkingBlock.tsx     # Expandable reasoning
│   │   ├── ToolCallTimeline.tsx  # Tool execution timeline
│   │   ├── MessageInput.tsx      # Chat input
│   │   └── ui/                   # Primitives (tooltip, badge, etc.)
│   ├── hooks/
│   │   ├── usePiStream.ts        # Streaming state machine (useReducer)
│   │   └── useSessions.ts        # Session persistence
│   ├── types/
│   │   ├── index.ts              # ChatMessage, ToolCallInfo
│   │   └── pi-events.ts          # CoworkEvent types
│   ├── App.tsx                   # Main 3-column layout
│   └── App.css                   # Tailwind theme (light + dark)
├── src-tauri/                    # Tauri desktop shell (thin Rust relay)
│   └── src/
│       ├── main.rs               # Entry point
│       └── lib.rs                # IPC commands → sidecar process
├── docs/                         # Architecture & plans
└── .github/workflows/            # CI/CD
```

## 🇮🇳 Made in India

**Zosma Cowork** is proudly built in **Bengaluru, India** by **ZOSMAAI SOLUTIONS PRIVATE LIMITED**.

From India to the World 🌏 — with ❤️ from the team at [Zosma AI](https://zosma.ai).

> *"India doesn't just consume technology — we build it, we ship it, we lead it."*

## License

MIT © [Zosma AI](https://zosma.ai)
