# アプリ公開の準備状況

2026-09-25。App Store / Google Play への提出・公開は未実施。

## 作成したもの
- Capacitor 8.5.2 の iOS / Android プロジェクト。仮のアプリIDは com.diamondninebaseball.game（初回提出前に所有者アカウントで使用可能か確認）。
- ゲーム・カードデータ・音声・画像を同梱するビルド。リモートサイトを表示するだけの構成ではありません。
- アプリ内のセーブ書き出し・優勝画像共有。OS共有画面経由。実機確認は未実施。
- ネイティブ版ではAdSense無効、Google Fonts外部取得なし。広告SDK・課金SDKは未導入。
- アプリ内プライバシー説明とiOSのファイル時刻API理由宣言。最終アーカイブに含まれる全SDKの宣言をMacで確認すること。
- 日本語ストア説明文。保存済みのブラウザ版データは自動移行しません。書き出し／読み込みで移行します。

## 現在の提出ブロッカー
1. Apple Developer / Google Play Console の登録状況・本人確認が未確認。
2. このWindows環境にJDK・Android SDKが見つからず、Android AAB/APKは未ビルド。署名鍵も未作成。
3. 所有者はMacを利用できないため、Macを備えたクラウドビルド環境が必要。Apple署名が未確認。iOSアーカイブ・IPAは未作成。
4. サポート連絡先は kame6493@gmail.com。/app-support.html と /app-privacy.html を準備済み。
5. ひな形アイコンの差し替え、実機スクリーンショット、端末テストが必要。
6. 選手査定・名称・画像・音声等の配布利用権を確認すること。現状データには外部Wiki等を基にした情報があります。伏字や地名化だけでは権利処理の証明にはなりません。利用許諾のあるデータへの整理が必要か確認してから提出します。
7. 新しい個人Google Playアカウントの場合、現行規定では12名以上のテスターが14日連続参加するクローズドテストが必要。テスト後に本番公開アクセスを申請します。

## ビルド
ルートで npm ci、mobile で npm ci を実行後、ルートから：

```
npm --prefix mobile run sync
npm --prefix mobile run open:android
npm --prefix mobile run open:ios
```

Android Studioでmobile/androidを開き、SDKを導入して実機確認。Generate Signed Bundle / APKから署名済みAABを作成し、内部テストへアップロードします。署名鍵・パスワードをGitへ入れないこと。

MacではXcode 26以上でmobile/ios/App/App.xcodeprojを開き、SigningのTeamを所有者に設定。アイコンを差し替え、iPhone/iPadで検証し、ArchiveからApp Store ConnectへアップロードしてTestFlightで確認します。

## 実機で必要な確認
初回起動、機内モード、セーブ保持、バックグラウンド復帰、端末の戻る操作、共有キャンセル、画像共有、JSON書き出し／読み込み、音声、縦横表示、安全領域、143/162試合進行、設定・ガイド・外部リンク、完全リセット。

## 公式情報
- Apple年会費：99米ドル相当（地域通貨）。https://developer.apple.com/support/compare-memberships/
- Google Play登録料：25米ドルの一回払い。https://support.google.com/googleplay/android-developer/answer/6112435
- 個人アカウントのテスト要件：https://support.google.com/googleplay/android-developer/answer/14151465
- Apple審査要件：https://developer.apple.com/jp/app-store/review/guidelines/
- 開発環境：https://capacitorjs.com/docs/getting-started/environment-setup

審査通過や公開日は保証されません。年齢区分・権利確認・データ申告は実際の提出物に基づいて行います。
