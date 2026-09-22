# OtsumamiCast 0.2.6 引き継ぎ

基準: sapisapio/OtsumamiCast-public main de018cd49f3bb44c230c04b726fb3285cc361023。まりもさんの改良入り0.2.5を基準に修正。

## 実装と検証
変更一覧・検証範囲は CHANGELOG.md、公開条件は PUBLICATION.md / LICENSE / THIRD_PARTY_NOTICES.md を参照。npm test は11件成功。JS/CJS構文検査成功。Electron描画テストと同梱FFmpegのPNG/GIF生成テストも実施済み。

## 維持する仕様
- ポートは保存して次回起動反映。YP取得は7244固定。変更時はURLまたはIP:ポートで接続する注意書きのみ。ポート自動探索は追加しない。
- 接続先から取得するサムネイルの安定URLとキャッシュを維持。毎回の時刻付与や全動画取得に戻さない。
- YouTubeのシークしきい値は変更しない。同期による強制タブ移動は廃止。
- 新機能や全面リファクタリングを増やさず、公開前の実機確認を優先。

## 次に必要なこと
1. 通常Windowsで起動・終了・再起動、OBS領域復元、ホスト/リスナー接続を確認。
2. 実YouTube同期、実ルーターUPnPを確認。
3. 配布する場合はNSISインストーラーをビルドしてインストール確認。今回のdirectory buildはインストーラー検証ではない。署名処理とネイティブ依存再ビルドを省略。
4. PRをレビューしてからmainへ反映。GitHub上のPR作成は実機動作保証や配布完了を意味しない。

## 再現コマンド
npm ci
npm test
npm start
npm run build:win

描画テスト: node_modules/electron/dist/electron.exe tests/renderer.cjs
この作業環境ではテスト時だけ --no-sandbox --in-process-gpu --disable-gpu --disable-software-rasterizer が必要だった。製品設定は弱めない。

## ソース入手
GitHubの修正ブランチをcloneする。ローカルのsource-only ZIPには依存パッケージ・FFmpegバイナリを含めない。FFmpegは基準リポジトリのffmpeg-binを使用する。
