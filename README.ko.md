# Zosma Cowork 🇮🇳

[English](./README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | [日本語](./README.ja.md) | [Deutsch](./README.de.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | **한국어** | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> [pi agent SDK](https://github.com/earendil-works/pi-coding-agent)로 구동되는 데스크톱 AI 동료 — 스트리밍, 사고 과정, 도구 호출, 멀티턴 세션 및 스티어링을 모두 아름다운 네이티브 앱에 통합했습니다.

> 🇮🇳 **India's first Non-Coding Agentic Work Harness**
>
> **From India to the World 🌏 — Made with ❤️ by [Zosma AI](https://zosma.ai)**

![zosma-cowork-스크린샷](./assets/screenshot.png)

## Demo

<video src="./assets/demo.mp4" controls width="100%">
  Your browser doesn't support the video tag. [Download the demo](./assets/demo.mp4).
</video>

## Zosma Cowork 를 선택해야 하는 이유

### 🌟 pi 기반 최초의 데스크톱 코워커

Zosma Cowork는 [pi](https://github.com/earendil-works/pi-coding-agent) — 최소한의 언어에 구애받지 않는 코딩 에이전트 하니스 — 위에 구축된 최초의 데스크톱 애플리케이션입니다. 모든 pi 확장이 래퍼나 어댑터 없이 직접 작동합니다.

### 🆓 무료, Freemium 아님

월 $20의 구독료 없음. 기능 제한 없음. 사용 상한 없음. Zosma Cowork는 **100% 무료 오픈소스** (MIT)입니다. 자신의 API 키를 가져오거나 로컬 모델을 사용하세요 — 비용을 직접 제어할 수 있습니다.

### 🧩 완전한 pi 확장 생태계

[pi 생태계](https://github.com/earendil-works/pi-coding-agent)에는 수백 개의 확장, 스킬, 도구, 프롬프트, 테마가 포함되어 있습니다 — 모두 Zosma Cowork와 호환됩니다. `~/.zosmaai/cowork/`에 플러그인하기만 하면 작동합니다. 어댑터 불필요, 락인 없음.

### 👥 비기술자 동료의 시작을 도우세요

에이전트 워크는 CLI 명령어를 입력할 수 있는 사람만을 위한 것이 아닙니다. **비개발자도 최소한의 접근 가능한 워크 하니스를 가질 자격이 있습니다.** 기술에 익숙하지 않은 친구와 동료를 위해 Zosma Cowork를 설정하세요 — 무료, 간단, 즉시 사용 가능.

**이것이 인도 개발자가 기여해야 하는 이유입니다.** 당신이 또 다른 도구를 필요로 해서가 아니라 — 당신의 비기술자 친구들이 에이전트 AI 세계로의 무료하고 간단한 진입로를 필요로 하기 때문입니다.

> *"인도는 기술을 소비만 하지 않습니다 — 우리는 그것을 구축하고, 출시하고, 선도합니다. 그리고 누구도 뒤처지지 않도록 합니다."*


## 기능

- **인프로세스 에이전트 런타임** — pi agent SDK가 앱 내에서 직접 실행 (서브프로세스 없음, 런타임 시 CLI 의존성 없음)
- **멀티턴 세션** — 영구 세션 기록으로 완전한 대화 연속성
- **스트리밍 응답** — 에이전트가 생각하고, 쓰고, 도구를 호출하는 것을 실시간으로 확인
- **사고 블록** — 확장 가능한 모델의 추론 과정
- **도구 호출 타임라인** — 인수와 결과가 포함된 실시간 bash/edit/write 도구 호출
- **세션 관리** — `~/.zosmaai/cowork/`에 저장되는 지속적인 채팅 세션
- **라이트 & 다크 모드** — 따뜻한 크림 라이트 모드와 따뜻한 차콜 다크 모드
- **키보드 단축키** — `Cmd/Ctrl+Shift+K`로 포커스, `Cmd/Ctrl+N`으로 새 세션
- **중단 및 스티어링** — 턴 중간에 실행 중인 에이전트 중지, 후속 스티어링 메시지 전송
- **Claude 스타일 UI** — 사이드바, 작업 공간, 정보 패널이 있는 3열 레이아웃

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| 프론트엔드 | React 19, Tailwind CSS v4, Radix UI |
| 데스크톱 셸 | Tauri v2, Rust, Tokio |
| 에이전트 엔진 | Node.js sidecar — pi-mono SDK (`@earendil-works/pi-coding-agent`)
| 에이전트 SDK | `@earendil-works/pi-coding-agent` — pi-mono TypeScript SDK
| 테스트 | Vitest, Testing Library, jsdom, `cargo test` |
| 린터 | Biome (프론트엔드), Clippy (Rust) |

## 빠른 시작

### 전제 조건

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+

### 설치 및 실행

```bash
# 의존성 설치
npm install

# 프론트엔드 개발 서버 실행
npm run dev:frontend

# 전체 Tauri 앱 실행 (프론트엔드 + Rust 백엔드 + Node.js agent sidecar)
npm run dev
```

## 설정 및 데이터

| 항목 | 위치 | 참고 |
|------|------|------|
| LLM 제공자 및 API 키 | `~/.zosmaai/agent/settings.json` | 앱에서 관리 |
| 모델 정의 | `~/.zosmaai/agent/models.json` | 앱에서 관리 |
| 확장 및 스킬 | `~/.zosmaai/agent/extensions/` | 로컬 확장 디렉토리 |
| 세션 기록 | `~/.zosmaai/cowork/` | Zosma Cowork에서 관리 |

## 🇮🇳 Made in India

**Zosma Cowork**는 **ZOSMAAI SOLUTIONS PRIVATE LIMITED**에 의해 **인도 벵갈루루**에서 자랑스럽게 구축되었습니다.

인도에서 세계로 🌏 — [Zosma AI](https://zosma.ai) 팀의 ❤️를 담아.

> *"인도는 기술을 소비만 하지 않습니다 — 우리는 그것을 구축하고, 출시하고, 선도합니다."*

## 라이선스

MIT © [Zosma AI](https://zosma.ai)
