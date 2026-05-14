# Zosma Cowork 🇮🇳

[English](./README.md) | [中文](./README.zh.md) | [Español](./README.es.md) | **日本語** | [Deutsch](./README.de.md) | [Français](./README.fr.md) | [Português](./README.pt.md) | [Русский](./README.ru.md) | [한국어](./README.ko.md) | [हिंदी](./README.hi.md)

[![CI](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/ci.yml)
[![Release](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml/badge.svg)](https://github.com/zosmaai/zosma-cowork/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made in India](https://img.shields.io/badge/Made_in_India-🇮🇳-FF9933?labelColor=138808)](https://zosma.ai)

> [pi agent SDK](https://github.com/earendil-works/pi-coding-agent) を搭載したデスクトップ AI コワーカー — ストリーミング、思考プロセス、ツール呼び出し、マルチターンセッション、ステアリングをすべて美しいネイティブアプリに統合。

> 🇮🇳 **India's first Non-Coding Agentic Work Harness**
>
> **From India to the World 🌏 — Made with ❤️ by [Zosma AI](https://zosma.ai)**

![zosma-cowork-スクリーンショット](./assets/screenshot.png)

## Demo

<video src="./assets/demo.mp4" controls width="100%">
  Your browser doesn't support the video tag. [Download the demo](./assets/demo.mp4).
</video>

## Zosma Cowork の特徴

### 🌟 pi 初のデスクトップコワーカー

Zosma Cowork は [pi](https://github.com/earendil-works/pi-coding-agent) 上に構築された初のデスクトップアプリケーションです — ミニマルで言語に依存しないコーディングエージェントハーネス。すべての pi 拡張機能がラッパーやアダプターなしで直接動作します。

### 🆓 無料、Freemium ではありません

月額 $20 のサブスクリプションは不要。機能制限なし。使用上限なし。Zosma Cowork は **100% 無料のオープンソース** (MIT) です。API キーを持ち込むか、ローカルモデルを使用してください。

### 🧩 完全な pi 拡張エコシステム

[pi エコシステム](https://github.com/earendil-works/pi-coding-agent) には何百もの拡張機能、スキル、ツール、プロンプト、テーマが含まれています — すべて Zosma Cowork と互換性があります。`~/.zosmaai/cowork/` にプラグインするだけで動作します。アダプター不要、ロックインなし。

### 👥 非技術者の同僚を支援

エージェントワークは CLI コマンドを入力できる人だけのものではありません。**非開発者にもミニマルでアクセスしやすいワークハーネスを。** 技術者でない友人や同僚のために Zosma Cowork をセットアップしてください — 無料、シンプル、すぐに使えます。

**これがインドの開発者が貢献すべき理由です。** あなたが別のツールを必要としているからではなく — あなたの非技術者の友人がエージェント AI への無料でシンプルな入り口を必要としているからです。

> *"インドはテクノロジーを消費するだけではありません — 私たちはそれを構築し、届け、リードします。そして誰も取り残されないようにします。"*


## 機能

- **インプロセスエージェントランタイム** — pi agent SDK がアプリ内で直接実行（サブプロセスなし、実行時のCLI依存なし）
- **マルチターンセッション** — 永続的なセッション履歴による完全な会話の継続性
- **ストリーミングレスポンス** — エージェントが考え、書き、ツールを呼び出すのをリアルタイムで確認
- **思考ブロック** — 展開可能なモデルの推論プロセス
- **ツール呼び出しタイムライン** — 引数と結果付きでbash/edit/writeツール呼び出しをリアルタイム表示
- **セッション管理** — `~/.zosmaai/cowork/` に保存される永続的なチャットセッション
- **ライト＆ダークモード** — 温かみのあるクリームライトモードとチャコールダークモード
- **キーボードショートカット** — `Cmd/Ctrl+Shift+K` でフォーカス、`Cmd/Ctrl+N` で新規セッション
- **中止とステアリング** — ターン途中で実行中のエージェントを停止、フォローアップステアリングメッセージを送信
- **Claude 風 UI** — サイドバー、ワークスペース、情報パネルの 3 列レイアウト

## 技術スタック

| レイヤー | テクノロジー |
|---------|------------|
| フロントエンド | React 19, Tailwind CSS v4, Radix UI |
| デスクトップシェル | Tauri v2, Rust, Tokio |
| エージェントエンジン | Node.js sidecar — pi-mono SDK (`@earendil-works/pi-coding-agent`)
| エージェント SDK | `@earendil-works/pi-coding-agent` — pi-mono TypeScript SDK
| テスト | Vitest, Testing Library, jsdom, `cargo test` |
| リンター | Biome（フロントエンド）、Clippy（Rust） |

## クイックスタート

### 前提条件

- [Node.js](https://nodejs.org/) 22+
- [Rust](https://rustup.rs/) 1.85+

### インストールと実行

```bash
# 依存関係のインストール
npm install

# フロントエンド開発サーバーの実行
npm run dev:frontend

# フル Tauri アプリの実行（フロントエンド + Rust バックエンド + Node.js agent sidecar）
npm run dev
```

## 設定とデータ

| 項目 | 場所 | 備考 |
|------|------|------|
| LLM プロバイダーと API キー | `~/.zosmaai/agent/settings.json` | アプリが管理 |
| モデル定義 | `~/.zosmaai/agent/models.json` | アプリが管理 |
| 拡張機能とスキル | `~/.zosmaai/agent/extensions/` | ローカル拡張ディレクトリ |
| セッション履歴 | `~/.zosmaai/cowork/` | Zosma Cowork が管理 |

## 🇮🇳 Made in India

**Zosma Cowork** は **ZOSMAAI SOLUTIONS PRIVATE LIMITED** によって **インド・バンガロール** で誇りを持って構築されています。

インドから世界へ 🌏 — [Zosma AI](https://zosma.ai) チームより ❤️ を込めて。

> *「インドは技術を消費するだけではない — 私たちはそれを構築し、届け、リードする。」*

## ライセンス

MIT © [Zosma AI](https://zosma.ai)
