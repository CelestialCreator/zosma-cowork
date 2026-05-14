# Zosma Cowork 🇮🇳

[English](./README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [Deutsch](./README.de.md) | [Français](./README.fr.md) | **Português** | [Русский](./README.ru.md) | [한국어](./README.ko.md) | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> Um coworker de IA para desktop powered by [pi agent SDK](https://github.com/earendil-works/pi-coding-agent) — streaming, processos de pensamento, chamadas de ferramentas, sessões multi-turno e direcionamento, tudo em um belo aplicativo nativo.

> 🇮🇳 **India's first Non-Coding Agentic Work Harness**
>
> **From India to the World 🌏 — Made with ❤️ by [Zosma AI](https://zosma.ai)**

![zosma-cowork-captura](./assets/screenshot.png)

## Demo

<video src="./assets/demo.mp4" controls width="100%">
  Your browser doesn't support the video tag. [Download the demo](./assets/demo.mp4).
</video>

## Por que Zosma Cowork?

### 🌟 O primeiro coworker de desktop baseado em pi

Zosma Cowork é o primeiro aplicativo de desktop construído sobre [pi](https://github.com/earendil-works/pi-coding-agent) — o harness de agente mínimo e independente de linguagem. Cada extensão do pi funciona diretamente, sem wrappers ou adaptadores.

### 🆓 Gratuito, não Freemium

Sem assinaturas de $20/mês. Sem limites de recursos. Sem restrições de uso. Zosma Cowork é **100% gratuito e open-source** (MIT). Traga sua própria chave de API ou use modelos locais — você controla os custos.

### 🧩 Ecossistema completo de extensões pi

O [ecossistema pi](https://github.com/earendil-works/pi-coding-agent) inclui centenas de extensões, skills, ferramentas, prompts e temas — todos compatíveis com Zosma Cowork. Basta plugá-los em `~/.zosmaai/cowork/` e funcionam. Sem adaptadores, sem lock-in.

### 👥 Ajude colegas não técnicos a começar

O trabalho agentivo não deve ser limitado a quem sabe digitar comandos CLI. **Não-programadores também merecem um harness de trabalho mínimo e acessível.** Configure o Zosma Cowork para seus amigos e colegas não técnicos — gratuito, simples, pronto para uso.

**É por isso que desenvolvedores indianos devem contribuir.** Não porque você precisa de outra ferramenta — mas porque seus amigos não técnicos precisam de uma entrada gratuita e simples no mundo da IA agentiva.

> *"A Índia não apenas consome tecnologia — nós a construímos, a enviamos, a lideramos. E garantimos que ninguém fique para trás."*


## Funcionalidades

- **Runtime do agente em processo** — O SDK pi agent roda diretamente dentro do app (sem subprocesso, sem dependência de CLI em tempo de execução)
- **Sessões multi-turno** — Continuidade completa de conversa com histórico de sessão persistente
- **Respostas em streaming** — Veja o agente pensar, escrever e chamar ferramentas em tempo real
- **Blocos de pensamento** — Raciocínio expansível do modelo
- **Linha do tempo de chamadas de ferramentas** — Chamadas bash/edit/write em tempo real com argumentos e resultados
- **Gerenciamento de sessões** — Sessões de chat persistentes salvas em `~/.zosmaai/cowork/`
- **Modo claro e escuro** — Modo claro creme quente e modo escuro carvão quente
- **Atalhos de teclado** — `Cmd/Ctrl+Shift+K` para focar, `Cmd/Ctrl+N` para nova sessão
- **Abortar e direcionar** — Parar um agente em execução mid-turn, enviar mensagens de direcionamento de acompanhamento
- **UI inspirada no Claude** — Layout de 3 colunas com barra lateral, espaço de trabalho e painel de informações

## Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 19, Tailwind CSS v4, Radix UI |
| Shell desktop | Tauri v2, Rust, Tokio |
| Motor do agente | Node.js sidecar — pi-mono SDK |
| SDK do agente | `@earendil-works/pi-coding-agent` — pi-mono TypeScript SDK
| Testes | Vitest, Testing Library, jsdom, `cargo test` |
| Linter | Biome (frontend), Clippy (Rust) |

## Início Rápido

### Pré-requisitos

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+

### Instalar e Executar

```bash
# Instalar dependências
npm install

# Executar servidor de desenvolvimento frontend
npm run dev:frontend

# Executar aplicativo Tauri completo (frontend + backend Rust + Node.js agent sidecar)
npm run dev
```

## Configuração e dados

| O quê | Localização | Notas |
|-------|-------------|-------|
| Provedores LLM e chaves API | `~/.zosmaai/agent/settings.json` | Gerenciado pelo app |
| Definições de modelos | `~/.zosmaai/agent/models.json` | Gerenciado pelo app |
| Extensões e habilidades | `~/.zosmaai/agent/extensions/` | Diretório local de extensões |
| Histórico de sessões | `~/.zosmaai/cowork/` | Gerenciado por Zosma Cowork |

## 🇮🇳 Made in India

**Zosma Cowork** é orgulhosamente construído em **Bengaluru, Índia** por **ZOSMAAI SOLUTIONS PRIVATE LIMITED**.

Da Índia para o Mundo 🌏 — com ❤️ da equipe da [Zosma AI](https://zosma.ai).

> *"A Índia não apenas consome tecnologia — nós a construímos, a enviamos, a lideramos."*

## Licença

MIT © [Zosma AI](https://zosma.ai)
