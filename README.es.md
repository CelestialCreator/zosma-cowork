# Zosma Cowork 🇮🇳

[English](./README.md) | [中文](./README.zh.md) | **Español** | [日本語](./README.ja.md) | [Deutsch](./README.de.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [한국어](./README.ko.md) | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> Un compañero de escritorio impulsado por el [SDK de pi agent](https://github.com/earendil-works/pi-coding-agent) — transmisión en tiempo real, procesos de pensamiento, llamadas a herramientas, sesiones multi-turno y dirección, todo en una hermosa aplicación nativa.

> 🇮🇳 **India's first Non-Coding Agentic Work Harness**
>
> **From India to the World 🌏 — Made with ❤️ by [Zosma AI](https://zosma.ai)**

![zosma-cowork-captura](./assets/screenshot.png)

## Demo

<video src="./assets/demo.mp4" controls width="100%">
  Your browser doesn't support the video tag. [Download the demo](./assets/demo.mp4).
</video>

## ¿Por qué Zosma Cowork?

### 🌟 El primer escritorio colaborativo basado en pi

Zosma Cowork es la primera aplicación de escritorio construida sobre [pi](https://github.com/earendil-works/pi-coding-agent) — el arnés de agente mínimo y agnóstico al lenguaje. Cada extensión de pi funciona directamente, sin envoltorios ni adaptadores.

### 🆓 Gratuito, no Freemium

Sin suscripciones de $20/mes. Sin límites de funciones. Sin restricciones de uso. Zosma Cowork es **100% gratuito y de código abierto** (MIT). Trae tu propia clave API o usa modelos locales — tú controlas los costos.

### 🧩 Ecosistema completo de extensiones pi

El [ecosistema pi](https://github.com/earendil-works/pi-coding-agent) incluye cientos de extensiones, skills, herramientas, prompts y temas — todos compatibles con Zosma Cowork. Plúgalos en `~/.zosmaai/cowork/` y funcionan. Sin adaptadores, sin bloqueo.

### 👥 Ayuda a colegas no técnicos a comenzar

El trabajo agentivo no debería limitarse a quienes saben usar la CLI. **Los no programadores también merecen un arnés de trabajo mínimo y accesible.** Configura Zosma Cowork para tus amigos y colegas no técnicos — gratis, simple, listo para usar.

**Por eso los desarrolladores indios deberían contribuir.** No porque necesites otra herramienta — sino porque tus amigos no técnicos necesitan una entrada gratuita y simple al mundo de la IA agentiva.

> *"India no solo consume tecnología — la construimos, la enviamos, la lideramos. Y nos aseguramos de que nadie se quede atrás."*


## Características

- **Tiempo de ejecución del agente en proceso** — El SDK de pi agent se ejecuta directamente dentro de la aplicación (sin subprocesos, sin dependencia de CLI en tiempo de ejecución)
- **Sesiones multi-turno** — Continuidad completa de conversación con historial de sesión persistente
- **Respuestas en streaming** — Observa al agente pensar, escribir y llamar herramientas en tiempo real
- **Bloques de pensamiento** — Razonamiento expandible del modelo
- **Línea de tiempo de llamadas a herramientas** — Llamadas bash/edit/write en tiempo real con argumentos y resultados
- **Gestión de sesiones** — Sesiones de chat persistentes guardadas en `~/.zosmaai/cowork/`
- **Modo claro y oscuro** — Modo claro crema cálido y modo oscuro carbón cálido
- **Atajos de teclado** — `Cmd/Ctrl+Shift+K` para enfocar, `Cmd/Ctrl+N` para nueva sesión
- **Abortar y dirigir** — Detener un agente en ejecución a mitad de turno, enviar mensajes de dirección de seguimiento
- **UI inspirada en Claude** — Diseño de tres columnas con barra lateral, espacio de trabajo y panel de información

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19, Tailwind CSS v4, Radix UI |
| Shell de escritorio | Tauri v2, Rust, Tokio |
| Motor del agente | Node.js sidecar — pi-mono SDK |
| SDK del agente | `@earendil-works/pi-coding-agent` — pi-mono TypeScript SDK
| Pruebas | Vitest, Testing Library, jsdom, `cargo test` |
| Linter | Biome (frontend), Clippy (Rust) |

## Inicio rápido

### Prerrequisitos

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+

### Instalar y ejecutar

```bash
# Instalar dependencias
npm install

# Ejecutar servidor de desarrollo frontend
npm run dev:frontend

# Ejecutar aplicación Tauri completa (frontend + backend Rust + Node.js agent sidecar)
npm run dev
```

## Configuración y datos

| Qué | Ubicación | Notas |
|-----|-----------|-------|
| Proveedores LLM y claves API | `~/.zosmaai/agent/settings.json` | Gestionado por la app |
| Definiciones de modelos | `~/.zosmaai/agent/models.json` | Gestionado por la app |
| Extensiones y habilidades | `~/.zosmaai/agent/extensions/` | Directorio local de extensiones |
| Historial de sesiones | `~/.zosmaai/cowork/` | Gestionado por Zosma Cowork |

## 🇮🇳 Made in India

**Zosma Cowork** está orgullosamente construido en **Bengaluru, India** por **ZOSMAAI SOLUTIONS PRIVATE LIMITED**.

De India para el Mundo 🌏 — con ❤️ del equipo de [Zosma AI](https://zosma.ai).

> *"India no solo consume tecnología — la construimos, la enviamos, la lideramos."*

## Licencia

MIT © [Zosma AI](https://zosma.ai)
