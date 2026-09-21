# OtsumamiCast

**YouTube同期視聴デスクトップアプリ** - PeerCast配信者向けツール

配信者（ホスト）と視聴者（リスナー）が同じYouTube動画をリアルタイムで同期視聴できるElectronアプリケーションです。

---

## 🎯 主要機能

- ✅ **YouTube同期視聴** - ホスト/リスナー間で動画を同期
- ✅ **WebSocketリアルタイム通信** - 低遅延同期と通知
- ✅ **UPnP自動ポート開放** - ルーター設定の簡易化
- ✅ **スタンプオーバーレイ** - スタンプをリアルタイム表示
- ✅ **YP（イエローページ）対応** - 配信者リスト取得
- ✅ **おひねり撒き / Vcast / プロフィール** - 追加機能群

---

## 📋 クイックスタート

### 開発環境での起動

```bash
# 依存パッケージをインストール
npm install

# サーバーを起動（ターミナル1）
npm run dev:server

# Electronアプリを起動（ターミナル2）
npm run dev:client
```

### ビルド

```bash
npm run build:win
npm run build:mac
npm run build:linux
```

---

## 📁 プロジェクト構成（主要部）

```
OtsumamiCast/
├── electron-main.js          # Electronメインプロセス
├── preload.js                # セキュアAPI（メインウィンドウ）
├── preload-overlay.js        # セキュアAPI（オーバーレイ）
├── windows/                  # ウィンドウ管理
├── ipc/                      # IPCハンドラー
├── server/                   # Node.js/Express + WebSocket
├── public/                   # フロントエンド
├── config/                   # 設定
└── docs/                     # ドキュメント
```

---

## 📚 ドキュメント

- **[SPEC.md](./SPEC.md)** - 現行実装に基づく総合仕様
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** - 開発ガイド

---

## ⚙️ 環境変数（任意）

```bash
PORT=7244
HOST=0.0.0.0
NODE_ENV=development
DEBUG=false
UPNP_ENABLED=true
```

---

## 🐛 トラブルシューティング

### サーバーが起動しない

```bash
# ポートが使用中の場合
netstat -ano | findstr :7244

# ポート番号を変更
set PORT=7245
npm run dev:server
```

### スタンプが表示されない

1. `public/stamps/` フォルダが存在するか確認
2. `stamp-list.json` が正しい形式か確認
3. ブラウザの開発者ツール（F12）でエラーを確認

---

