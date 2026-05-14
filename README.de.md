# Zosma Cowork 🇮🇳

[English](./README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | **Deutsch** | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [한국어](./README.ko.md) | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> Ein Desktop-KI-Mitarbeiter, angetrieben vom [pi agent SDK](https://github.com/earendil-works/pi-coding-agent) — Streaming, Denkprozesse, Tool-Aufrufe, Multi-Turn-Sitzungen und Steuerung, alles in einer schönen nativen App.

> 🇮🇳 **India's first Non-Coding Agentic Work Harness**
>
> **From India to the World 🌏 — Made with ❤️ by [Zosma AI](https://zosma.ai)**

![zosma-cowork-screenshot](./assets/screenshot.png)

## Demo

<video src="./assets/demo.mp4" controls width="100%">
  Your browser doesn't support the video tag. [Download the demo](./assets/demo.mp4).
</video>

## Warum Zosma Cowork?

### 🌟 Der erste Desktop-Coworker auf Basis von pi

Zosma Cowork ist die erste Desktop-Anwendung, die auf [pi](https://github.com/earendil-works/pi-coding-agent) basiert — dem minimalen, sprachunabhängigen Coding-Agent-Harness. Jede pi-Erweiterung funktioniert direkt ohne Wrapper oder Adapter.

### 🆓 Kostenlos, nicht Freemium

Keine $20/Monat Abos. Keine Funktionsbeschränkungen. Keine Nutzungslimits. Zosma Cowork ist **100% kostenlos und Open Source** (MIT). Verwende deinen eigenen API-Key oder lokale Modelle — du kontrollierst die Kosten.

### 🧩 Vollständiges pi-Erweiterungs-Ökosystem

Das [pi-Ökosystem](https://github.com/earendil-works/pi-coding-agent) umfasst hunderte Erweiterungen, Skills, Tools, Prompts und Themes — alle kompatibel mit Zosma Cowork. Einfach in `~/.zosmaai/cowork/` einfügen und loslegen. Keine Adapter, kein Lock-in.

### 👥 Hilf nicht-technischen Kollegen beim Einstieg

Agentische Arbeit sollte nicht auf CLI-Benutzer beschränkt sein. **Nicht-Entwickler verdienen ebenfalls einen minimalen, zugänglichen Work-Harness.** Richte Zosma Cowork für deine nicht-technischen Freunde und Kollegen ein — kostenlos, einfach, sofort einsatzbereit.

**Deshalb sollten indische Entwickler beitragen.** Nicht weil du ein weiteres Tool brauchst — sondern weil deine nicht-technischen Freunde einen kostenlosen, einfachen Einstieg in die Welt der agentischen KI brauchen.

> *"Indien konsumiert nicht nur Technologie — wir bauen sie, liefern sie und führen darin. Und wir stellen sicher, dass niemand zurückgelassen wird."*


## Funktionen

- **In-Process-Agenten-Laufzeit** — Das pi agent SDK läuft direkt in der App (kein Subprozess, keine CLI-Abhängigkeit zur Laufzeit)
- **Multi-Turn-Sitzungen** — Volle Gesprächskontinuität mit persistentem Sitzungsverlauf
- **Streaming-Antworten** — Beobachte den Agenten in Echtzeit beim Denken, Schreiben und Tool-Aufrufen
- **Denkblöcke** — Erweiterbares Modell-Reasoning
- **Tool-Aufruf-Zeitleiste** — Live bash/edit/write Tool-Aufrufe mit Argumenten und Ergebnissen
- **Sitzungsverwaltung** — Persistente Chat-Sitzungen gespeichert in `~/.zosmaai/cowork/`
- **Hell- & Dunkelmodus** — Warmer Creme-Hellmodus und warmer Kohle-Dunkelmodus
- **Tastaturkürzel** — `Cmd/Ctrl+Shift+K` zum Fokussieren, `Cmd/Ctrl+N` für neue Sitzung
- **Abbrechen & Steuern** — Laufenden Agenten mid-turn stoppen, Folge-Steuerungsnachrichten senden
- **Claude-inspirierte UI** — 3-Spalten-Layout mit Seitenleiste, Arbeitsbereich und Infopanel

## Technologie-Stack

| Ebene | Technologie |
|-------|------------|
| Frontend | React 19, Tailwind CSS v4, Radix UI |
| Desktop-Shell | Tauri v2, Rust, Tokio |
| Agenten-Engine | 
| Agenten-SDK | `@earendil-works/pi-coding-agent` — pi-mono TypeScript SDK
| Tests | Vitest, Testing Library, jsdom, `cargo test` |
| Linter | Biome (Frontend), Clippy (Rust) |

## Schnellstart

### Voraussetzungen

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+

### Installieren & Ausführen

```bash
# Abhängigkeiten installieren
npm install

# Frontend-Entwicklungsserver starten
npm run dev:frontend

# Vollständige Tauri-App ausführen (Frontend + Rust-Backend + Node.js agent sidecar)
npm run dev
```

## Konfiguration & Daten

| Was | Speicherort | Hinweise |
|-----|-------------|----------|
| LLM-Anbieter & API-Schlüssel | `~/.zosmaai/agent/settings.json` | Von der App verwaltet |
| Modelldefinitionen | `~/.zosmaai/agent/models.json` | Von der App verwaltet |
| Erweiterungen & Skills | `~/.zosmaai/agent/extensions/` | Lokales Erweiterungsverzeichnis |
| Sitzungsverlauf | `~/.zosmaai/cowork/` | Verwaltet von Zosma Cowork |

## 🇮🇳 Made in India

**Zosma Cowork** wird stolz in **Bengaluru, Indien** von **ZOSMAAI SOLUTIONS PRIVATE LIMITED** entwickelt.

Von Indien in die Welt 🌏 — mit ❤️ vom Team bei [Zosma AI](https://zosma.ai).

> *"Indien konsumiert nicht nur Technologie — wir bauen sie, wir liefern sie, wir führen darin."*

## Lizenz

MIT © [Zosma AI](https://zosma.ai)
