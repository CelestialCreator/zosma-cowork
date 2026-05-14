# Zosma Cowork 🇮🇳

[English](./README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [Deutsch](./README.de.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | **Русский** | [한국어](./README.ko.md) | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> Десктопный ИИ-коллега на базе [SDK pi agent](https://github.com/earendil-works/pi-coding-agent) — потоковая передача, процессы мышления, вызовы инструментов, мультитурновые сессии и управление, всё в красивом нативном приложении.

> 🇮🇳 **India's first Non-Coding Agentic Work Harness**
>
> **From India to the World 🌏 — Made with ❤️ by [Zosma AI](https://zosma.ai)**

![zosma-cowork-скриншот](./assets/screenshot.png)

## Demo

<video src="./assets/demo.mp4" controls width="100%">
  Your browser doesn't support the video tag. [Download the demo](./assets/demo.mp4).
</video>

## Почему Zosma Cowork?

### 🌟 Первый настольный coworker на базе pi

Zosma Cowork — первое настольное приложение, построенное на [pi](https://github.com/earendil-works/pi-coding-agent) — минимальном, языконезависимом кодинг-агентном инструментарии. Каждое расширение pi работает напрямую, без обёрток и адаптеров.

### 🆓 Бесплатно, не Freemium

Никаких подписок за $20/месяц. Никаких ограничений функций. Никаких лимитов использования. Zosma Cowork **100% бесплатен и с открытым исходным кодом** (MIT). Используйте свой API-ключ или локальные модели — вы контролируете расходы.

### 🧩 Полная экосистема расширений pi

[Экосистема pi](https://github.com/earendil-works/pi-coding-agent) включает сотни расширений, навыков, инструментов, промптов и тем — все совместимы с Zosma Cowork. Просто поместите их в `~/.zosmaai/cowork/` и они работают. Никаких адаптеров, никакой привязки.

### 👥 Помогите нетехническим коллегам начать

Агентная работа не должна ограничиваться теми, кто умеет вводить команды CLI. **Непрограммисты тоже заслуживают минимальный и доступный рабочий инструментарий.** Настройте Zosma Cowork для своих нетехнических друзей и коллег — бесплатно, просто, готово к использованию.

**Вот почему индийские разработчики должны вносить вклад.** Не потому что вам нужен ещё один инструмент — а потому что вашим нетехническим друзьям нужен бесплатный и простой вход в мир агентного ИИ.

> *"Индия не просто потребляет технологии — мы создаём их, доставляем их и лидируем в них. И мы следим, чтобы никто не остался позади."*


## Возможности

- **Внутрипроцессная среда агента** — SDK pi agent работает прямо внутри приложения (без подпроцессов, без зависимости от CLI во время выполнения)
- **Мультитурновые сессии** — Полная преемственность разговоров с постоянной историей сессий
- **Потоковые ответы** — Наблюдайте, как агент думает, пишет и вызывает инструменты в реальном времени
- **Блоки мышления** — Раскрываемый процесс рассуждения модели
- **Шкала вызовов инструментов** — Живые bash/edit/write вызовы с аргументами и результатами
- **Управление сессиями** — Постоянные чат-сессии сохраняются в `~/.zosmaai/cowork/`
- **Светлый и тёмный режим** — Тёплый кремовый светлый и тёплый угольный тёмный режим
- **Горячие клавиши** — `Cmd/Ctrl+Shift+K` для фокуса, `Cmd/Ctrl+N` для новой сессии
- **Прервать и управлять** — Остановить запущенный агент в середине хода, отправить последующие управляющие сообщения
- **UI вдохновлённый Claude** — 3-колоночный макет с боковой панелью, рабочей областью и информационной панелью

## Технологический стек

| Слой | Технология |
|------|-----------|
| Frontend | React 19, Tailwind CSS v4, Radix UI |
| Десктопная оболочка | Tauri v2, Rust, Tokio |
| Движок агента | Node.js sidecar — pi-mono SDK |
| SDK агента | `@earendil-works/pi-coding-agent` — pi-mono TypeScript SDK
| Тестирование | Vitest, Testing Library, jsdom, `cargo test` |
| Линтер | Biome (frontend), Clippy (Rust) |

## Быстрый старт

### Требования

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+

### Установка и запуск

```bash
# Установить зависимости
npm install

# Запустить frontend сервер разработки
npm run dev:frontend

# Запустить полное Tauri приложение (frontend + Rust backend + Node.js agent sidecar)
npm run dev
```

## Конфигурация и данные

| Что | Расположение | Примечания |
|-----|-------------|-----------|
| LLM-провайдеры и API-ключи | `~/.zosmaai/agent/settings.json` | Управляется приложением |
| Определения моделей | `~/.zosmaai/agent/models.json` | Управляется приложением |
| Расширения и навыки | `~/.zosmaai/agent/extensions/` | Локальная папка расширений |
| История сессий | `~/.zosmaai/cowork/` | Управляется Zosma Cowork |

## 🇮🇳 Made in India

**Zosma Cowork** с гордостью создан в **Бангалоре, Индия** компанией **ZOSMAAI SOLUTIONS PRIVATE LIMITED**.

Из Индии в мир 🌏 — с ❤️ от команды [Zosma AI](https://zosma.ai).

> *"Индия не просто потребляет технологии — мы создаем их, доставляем их и лидируем в них."*

## Лицензия

MIT © [Zosma AI](https://zosma.ai)
