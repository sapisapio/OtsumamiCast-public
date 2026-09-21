# OtsumamiCast 仕様・規格（総合）

このドキュメントは **現行コードを根拠にした最新仕様** をまとめたものです。
古い引き継ぎ文書や検証用HTMLに依存せず、実装に即した全体像を把握できることを目的とします。

---

## 1. 概要

- **用途**: PeerCast配信者向けの YouTube 同期視聴アプリ（Electronデスクトップ）
- **構成**: Electron（UI）+ Node.js/Express（内蔵サーバー）+ WebSocket（同期/通知）
- **主要ロール**:
  - **ホスト**: 配信者。ローカル環境からのみホスト登録を許可
  - **リスナー**: 視聴者。YPまたはIPでホストに接続

---

## 2. 起動・動作モード

### 開発モード
- `npm run dev:server` でサーバー起動
- `npm run dev:client` でElectron起動
- Electronは **内蔵サーバーを起動しない**

### パッケージ版
- Electron起動時に `server/index.js` を自動起動
- `OTS_USER_DATA` 環境変数を介して userData 配下を保存先に使用

---

## 3. コンポーネント構成

### Electron メインプロセス
- `electron-main.js`
  - 二重起動防止
  - パッケージ版のみ内蔵サーバーを起動
  - メイン/ビデオ/オーバーレイウィンドウを管理
  - IPC ハンドラーを登録

### ウィンドウ
- **メインウィンドウ**: `windows/main-window.js`
  - `http://localhost:7244` を読み込む
  - カスタムタイトルバー（フレームなし）
- **オーバーレイ**: `windows/overlay-manager.js`
  - インジケーター + オーバーレイの2枚構成
  - 透明・常時最前面・クリック透過切替
  - 右端基準でリサイズ
- **ビデオウィンドウ**: `windows/video-window.js`
  - `public/video.html` を表示

### サーバー
- `server/index.js`
  - Express + WebSocket + UPnP + 設定/状態管理
  - 静的配信: `public/`
  - WebSocket: `server/websocket.js`
  - 主要設定: `config/default.js`

---

## 4. ネットワーク / ポート

- **HTTP/WebSocket**: `7244`
- **ホスト判定**: WebSocket接続で `role: host` はローカルIPのみ許可
- **UPnP**: /api/upnp 経由でポート開放
- **YP**: 2サーバーのリストを統合して配信者一覧を表示

---

## 5. WebSocket 仕様

### 接続
- クライアントは `join` で登録（旧仕様互換）
  - 送信: `{ type: 'join', roomId, role }`
- `register` も受け付け（新仕様）

### サーバー → クライアント主要イベント
- `joined` / `registered`
- `stamp-list` / `stamp-config`
- `sync`（動画同期）
- `stamp`（スタンプ送信）
- `queue-enabled` / `queue-update` / `load-video`
- `comment`
- `ohinerimaki-bell` / `ohinerimaki-deleted`
- `vcast-config` / `vcast-state` / `vcast-reaction`
- `error`

### クライアント → サーバー主要イベント
- `join` / `register`
- `sync`（ホストのみ）
- `stamp` / `stamp-add` / `stamp-add-local`
- `stamp-reorder` / `stamp-category` / `stamp-delete`
- `toggle-queue` / `request-video` / `remove-queue-item` / `play-next`
- `ohinerimaki-bell` / `ohinerimaki-delete`
- `vcast-reaction`
- `profile-config-updated`

---

## 6. HTTP API 仕様（Express）

### YP
- `GET /api/yp` : YPサーバーの配信者一覧を統合取得

### UPnP
- `POST /api/upnp/open` : ポート開放
- `POST /api/upnp/close` : ポート閉鎖
- `GET /api/upnp/ip` : 外部IP取得

### スタンプ
- `GET /api/stamps` : スタンプ一覧
- `POST /api/stamps` : スタンプ追加（内部利用）
- `DELETE /api/stamps/:stampId`
- `GET /api/stamp-config` : 設定取得
- `POST /api/stamp-config/save-all` : 設定一括保存
- `POST /api/stamp-config/max-file-size`
- `POST /api/stamp-config/max-stamp-count`
- `POST /api/stamp-config/listener-permission`
- `POST /api/stamp-config/discord-server`
- `DELETE /api/stamp-config/discord-server/:serverId`

### プロフィール
- `GET /api/profile-config`
- `POST /api/profile-config`

### おひねり撒き
- `GET /api/ohinerimaki-config`
- `POST /api/ohinerimaki-config`
- `GET /api/ohinerimaki-notifications`
- `POST /api/ohinerimaki-notifications/delete`

### Vcast
- `GET /api/vcast-config`
- `POST /api/vcast-config`
- `GET /api/vcast-state`

### その他
- `GET /api/health`

---

## 7. データ保存先

保存先は **開発版 / パッケージ版** で切り替わります。

| 種別 | 開発モード | パッケージ版 |
| --- | --- | --- |
| スタンプ保存 | `public/stamps/` | `userData/stamps/` |
| スタンプリスト | `stamp-list.json` | `userData/stamp-list.json` |
| スタンプ設定 | `public/stamp-config.json` | `userData/stamp-config.json` |
| プロフィール設定 | `public/profile-config.json` | `userData/profile-config.json` |
| おひねり設定 | `server/data/ohinerimaki-config.json` | `userData/ohinerimaki-config.json` |
| おひねり通知 | `server/data/ohinerimaki-notifications.json` | `userData/ohinerimaki-notifications.json` |
| Vcast設定 | `server/data/vcast-config.json` | `userData/vcast-config.json` |
| Vcast状態 | `server/data/vcast-state.json` | `userData/vcast-state.json` |
| Vcast署名 | `server/data/vcast-secret.json` | `userData/vcast-secret.json` |
| 画像（プロフィール/Vcast） | `public/images/` | `userData/images/` |

---

## 8. 機能仕様

### 8.1 おつまみ（YouTube同期）
- ホストのみ動画操作を送信
- リスナーは同期情報を受信して再生/シーク
- YouTube IFrame API を利用
- **キュー機能**
  - ホストが受付ON/OFF
  - リスナーがURLをリクエスト
  - ホストが次の動画を再生

### 8.2 スタンプ
- **追加方法**
  - Discord CDN URL（`cdn.discordapp.com` / `media.discordapp.net`）
  - ローカルファイル（ホストのみ・localhost限定）
- **対応形式**
  - 画像: png/jpg/gif/webp
  - 動画: mp4/webm（サムネイル生成は ffmpeg）
- **スタンプ設定**
  - ファイルサイズ上限（MB）
  - 最大スタンプ数（無制限可）
  - リスナー追加権限
  - 着信音 / 音量 / 表示時間
- **編集**
  - 並び替え / カテゴリ付与 / 削除
- **オーバーレイ表示**
  - ランダム位置に表示、一定時間でフェードアウト

### 8.3 プロフィール
- 主要項目: 名前/ふりがな/愛称/好き/場所/活動開始年/活動時間
- SNSリンク（最大5件）
- フリーフォーム項目（複数）
- スキン切替（CSS読み込み）
- 機能ON/OFFフラグ（タブの有効化に使用）
- プロフィール画像は `/images/` 配下に保存される

### 8.4 おひねり撒き
- リスナーがベル通知を送信
- **入力制限**
  - 名前: 全角6文字/半角12文字以内
  - 金額: 1〜50,000円（ギフトアイコン時は不要）
- サーバー側で **IP単位30分制限**
- タブ側で **クールダウン表示（60秒）**
- 通知履歴を保存し、削除も可能
- オーバーレイに音と通知を表示

### 8.5 Vcast
- 画像アバターをオーバーレイ表示
- 位置・サイズ・アニメーション・音声反応を設定可能
- アバター画像は `/images/` 配下に保存される
- **リアクション**
  - `stroke` / `massage` / `rub` / `lick`
  - リスナーのみ送信可
  - IP単位で1日1回の制限
  - ポイントと気分（mood）を更新
- 状態は署名付きで保存

---

## 9. セキュリティ / 制約

- **ホスト権限はローカル接続のみ**
- リモートアクセス時は自動的に **viewer固定**
- CSPで外部接続を制限
- スタンプローカル追加は **localhost限定**
- スタンプ動画のサムネ生成は **ffmpeg が必要**

---

## 10. 主要ファイル位置

- Electron: `electron-main.js`, `windows/*`, `ipc/handlers.js`, `preload.js`
- サーバー: `server/index.js`, `server/websocket.js`, `server/routes.js`
- UI: `public/index.html`, `public/js/*`, `public/*-tab.html`
- 設定: `config/default.js`

---

## 11. 更新ルール

- 本ドキュメントは **現行コードと同じ内容に保つ**
- 仕様変更時は **必ずここに反映**
