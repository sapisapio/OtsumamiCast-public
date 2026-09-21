# OtsumamiCast - 開発ガイド

**対象**: 開発者向けドキュメント

---

## 🎯 開発環境セットアップ

### 前提条件

- Node.js 14以上
- npm または yarn
- Git

### セットアップ手順

```bash
# 1. リポジトリをクローン
git clone https://github.com/sapisapio/OtsumamiCast.git
cd OtsumamiCast

# 2. 依存パッケージをインストール
npm install

# 3. 環境変数を設定（オプション）
cp .env.example .env
# 必要に応じて .env を編集

# 4. 開発サーバーを起動
npm run dev:server

# 5. 別のターミナルでElectronアプリを起動
npm run dev:client
```

---

## 📂 ファイル構成と役割

### サーバーサイド (`server/`)

| ファイル | 役割 | 行数 |
|---------|------|------|
| `index.js` | メインサーバー | ~80 |
| `config.js` | 設定管理 | ~20 |
| `websocket.js` | WebSocket通信 | ~476 |
| `stamp-handler.js` | 画像処理 | ~328 |
| `stamp-manager.js` | メタデータ管理 | ~186 |
| `routes.js` | Express API | ~152 |
| `upnp.js` | UPnP機能 | ~98 |

### クライアントサイド (`public/js/`)

#### Core (`core/`)
- `state.js` - グローバル状態管理
- `websocket.js` - WebSocket通信
- `config.js` - クライアント設定

#### Features (`features/`)
- `stamps.js` - スタンプ機能（733行）
- `player.js` - YouTube動画制御
- `overlay.js` - オーバーレイ表示
- `upnp.js` - UPnP（クライアント側）

#### UI (`ui/`)
- `main.js` - メインUI
- `compact.js` - コンパクトUI
- `indicator.js` - インジケータUI
- `theme-switcher.js` - テーマ切り替え
- `custom-titlebar.js` - カスタムタイトルバー
- `toast.js` - トースト通知

#### Components (`ui/components/`)
- `buttons.js` - ボタン群
- `host-controls.js` - ホスト用コントロール
- `role-switcher.js` - ロール切り替え
- `viewer-controls.js` - ビューア用コントロール

#### Utils (`utils/`)
- `helpers.js` - ユーティリティ関数

---

## 🔄 データフロー

### スタンプ追加フロー

```
[ユーザー]
  ↓ ドラッグ&ドロップ
[stamps.js]
  ↓ WebSocket送信
[server/websocket.js]
  ↓ handleStampAdd()
[server/stamp-handler.js]
  ↓ addStampFromBase64()
  ↓ 画像保存 + サムネイル生成
[server/stamp-manager.js]
  ↓ stamp-list.json に追加
[全クライアント]
  ↓ WebSocket受信
[stamps.js]
  ↓ updateStampListFromServer()
[UI更新]
```

### 動画同期フロー

```
[ホスト]
  ↓ 再生/一時停止/シーク
[player.js]
  ↓ sendSync()
[server/websocket.js]
  ↓ handleSync()
[全リスナー]
  ↓ WebSocket受信
[player.js]
  ↓ applySync()
[動画同期]
```

---

## 🛠️ 主要な修正ポイント

### サーバー側の修正

#### 1. WebSocket メッセージハンドラーを追加

`server/websocket.js` に新しいメッセージタイプを追加：

```javascript
case 'new-message-type':
  handleNewMessage(ws, data);
  break;
```

#### 2. API エンドポイントを追加

`server/routes.js` に新しいルートを追加：

```javascript
app.post('/api/new-endpoint', (req, res) => {
  // 処理
  res.json({ success: true });
});
```

#### 3. 画像処理を追加

`server/stamp-handler.js` に新しいメソッドを追加：

```javascript
async newImageProcessing(inputPath) {
  // Sharp を使用して処理
  return await sharp(inputPath)
    .resize(...)
    .toFile(...);
}
```

### クライアント側の修正

#### 1. UI コンポーネントを追加

`public/js/ui/components/` に新しいファイルを作成：

```javascript
export function createNewComponent() {
  // UI作成
  return element;
}
```

#### 2. 機能モジュールを追加

`public/js/features/` に新しいファイルを作成：

```javascript
export const newFeature = {
  init() { /* 初期化 */ },
  execute() { /* 実行 */ }
};
```

#### 3. WebSocket メッセージハンドラーを追加

`public/js/core/websocket.js` に受信処理を追加：

```javascript
case 'new-message-type':
  handleNewMessage(data);
  break;
```

---

## 🧪 テスト方法

### サーバーテスト

```bash
# サーバーのみ起動
npm run dev:server

# ブラウザで http://localhost:7244 にアクセス
# コンソールログを確認
```

### Electronアプリテスト

```bash
# Electronアプリ起動
npm run dev:client

# 開発者ツール: Ctrl+Shift+I
# コンソール、ネットワーク、ストレージを確認
```

### WebSocket通信テスト

```bash
# WebSocket接続をテスト
# ブラウザコンソール:
const ws = new WebSocket('ws://localhost:7244');
ws.onmessage = (e) => console.log(e.data);
ws.send(JSON.stringify({ type: 'test' }));
```

---

## 📝 コーディング規約

### ファイル命名規則

- **サーバー**: `camelCase.js` (例: `stamp-handler.js`)
- **クライアント**: `camelCase.js` (例: `stamps.js`)
- **フォルダ**: `kebab-case` (例: `ui/components/`)

### 関数命名規則

```javascript
// 同期関数
function doSomething() { }

// 非同期関数
async function doSomethingAsync() { }

// イベントハンドラー
function onClickButton() { }
function handleStampAdd(data) { }

// ゲッター/セッター
function getStampList() { }
function setStampList(list) { }
```

### コメント規約

```javascript
/**
 * 関数の説明
 * @param {type} paramName - パラメータ説明
 * @returns {type} 戻り値説明
 */
function example(paramName) {
  // 処理の説明
}
```

---

## 🔍 デバッグ方法

### サーバーデバッグ

```bash
# デバッグモードで起動
DEBUG=true npm run dev:server

# ログ出力
console.log('[Module] Message:', data);
console.error('[Module] Error:', error);
```

### クライアントデバッグ

```javascript
// 開発者ツール (F12) で確認
console.log('Debug:', data);
debugger;  // ブレークポイント
```

### WebSocket デバッグ

```javascript
// public/js/core/websocket.js
ws.onmessage = (event) => {
  console.log('[WS] Received:', event.data);
};

ws.send(JSON.stringify({ type: 'test' }));
```

---

## 📦 パッケージ管理

### 新しいパッケージを追加

```bash
npm install パッケージ名

# 開発用パッケージ
npm install --save-dev パッケージ名
```

### パッケージを削除

```bash
npm uninstall パッケージ名
```

### 依存パッケージを更新

```bash
npm update
```

---

## 🚀 ビルド・デプロイ

### Windows版ビルド

```bash
npm run build:win
# dist/ フォルダに .exe ファイルが生成される
```

### Mac版ビルド

```bash
npm run build:mac
# dist/ フォルダに .dmg ファイルが生成される
```

### Linux版ビルド

```bash
npm run build:linux
# dist/ フォルダに AppImage ファイルが生成される
```

---

## 🔐 セキュリティ考慮事項

### Electron セキュリティ

- `preload.js` でセキュアなAPI公開
- `nodeIntegration: false` を設定
- `sandbox: true` を設定

### WebSocket セキュリティ

- メッセージ検証を実装
- 入力値のサニタイズ
- レート制限を実装

### ファイル操作セキュリティ

- パストラバーサル対策
- ファイルサイズ制限
- MIME タイプ検証

---

## 📚 参考資料

- [Electron公式ドキュメント](https://www.electronjs.org/docs)
- [Express.js公式ドキュメント](https://expressjs.com/)
- [WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [Sharp画像処理](https://sharp.pixelplumbing.com/)

---

**最終更新**: 2024年12月3日
