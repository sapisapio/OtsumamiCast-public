# OtsumamiCast (おつまみキャスト)

**YouTube同期視聴デスクトップアプリ** - PeerCast配信者向けツール

配信者（ホスト）と視聴者（リスナー）が同じYouTube動画をリアルタイムで同期視聴できるElectronアプリケーションです。

---

## 🎯 主要機能

- ✅ **YouTube同期視聴** - ホストとリスナー間で再生・一時停止・シーク位置を完全同期
- ✅ **スタンプ機能 & リアルタイムオーバーレイ** - 視聴者が送信したスタンプを画面上に演出表示
  - 動的カテゴリ管理（カテゴリの自由追加・削除・複数付与）
  - 負荷軽減モード（静止画サムネイル表示）
  - サムネイルのホバー拡大プレビュー
  - サムネイル一括再生成
- ✅ **WebSocketリアルタイム通信** - 低遅延な同期と通知
- ✅ **UPnP自動ポート開放** - ルーターのポート開放設定を自動化
- ✅ **YP（イエローページ）対応** - 配信者リストの取得・連携
- ✅ **おひねり撒き / Vcast / プロフィール機能**

---

## 💖 謝辞 / Special Thanks

本ソフトウェアの機能改善にあたり、多大なるご協力をいただきました。心より感謝申し上げます。

- **[まりも 様 (@Marimo_J)](https://x.com/Marimo_J/)**
  - スタンプカテゴリ管理機能の拡張（動的追加・削除・複数カテゴリ対応）
  - サムネイル軽量化・負荷軽減モード実装
  - ホバー拡大プレビューおよびサムネイル再生成機能の実装
  - UI/UXの改善およびURL正規化による安定性向上

---

## 📋 クイックスタート

### 前提条件
- Node.js (v18以上推奨)
- npm

### 開発環境での起動

```bash
# 依存パッケージをインストール
npm install

# 開発用サーバー＆クライアントを起動
npm run dev
```
または個別に起動:
```bash
# サーバー起動 (ターミナル1)
npm run dev:server

# Electron起動 (ターミナル2)
npm run dev:client
```

### パッケージ・ビルド

```bash
# Windows用インストーラー作成
npm run build:win

# Mac用
npm run build:mac

# Linux用
npm run build:linux
```

---

## 📁 プロジェクト構成

```
OtsumamiCast/
├── electron-main.js          # Electronメインプロセス
├── preload.js                # セキュアAPI（メインウィンドウ）
├── preload-overlay.js        # セキュアAPI（オーバーレイ）
├── windows/                  # ウィンドウ管理
├── ipc/                      # IPCハンドラー
├── server/                   # Node.js/Express + WebSocket
├── public/                   # フロントエンドUI・アセット
├── config/                   # 各種設定
├── ffmpeg-bin/               # 音声・動画処理用バイナリ
└── docs/                     # ドキュメント
```

---

## 📄 ライセンス

ISC License
