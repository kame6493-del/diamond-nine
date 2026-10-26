# アプリ公開の準備状況

2026-09-25。Androidの署名済みAPK/AABを作成。Google Playアプリ登録済み。一般公開・課金販売は未開始。App Store未提出。

## 2026-10-26 Android 23 / 1.3.1（見切れ・課金・広告・起動画面）

持ち主 10/26 夜「上が見切れる」「課金がシステムとして出来ていない」「広告を見て1回引くが再生されない」「起動時にアイコンが見切れて変な感じ」。

- 見切れ: 明るい見た目（pawa）のヘッダーは高さ固定（--hdr 52px・border-box）なのに、native-safe-area.css がステータスバーの高さを padding に足していたため、ステータスバーが高い端末（パンチホール 40〜52dp）でロゴ・pt・音ボタンが下に押し出されて切れていた。ヘッダーの高さをインセットぶん伸ばし（--hdr = 52px + 上のインセット）、1画面に収める画面（スカウト・試合・チーム）も同じだけ縮むようにした。pawa のシート・ダイアログ（ポイント購入・提供割合・選手詳細・目標）とトースト類も上下のインセットを避ける。SystemBars に initialViewportFitValueHint=cover を入れ、起動直後の余白の付け替え（ガクッとずれる）を無くした。360x640・390x844・412x915・412x915（上52/下48）を headless Edge で撮って確認（env() を注入値に置き換えて Android WebView 140+ と同じ状態で撮った）。
- 課金: 商品（premium_pass・pt_pack 6本）は Play で有効。止まっていたのはアプリ側。@capgo/native-purchases は呼ぶたびに前の BillingClient を閉じるので、(1) 起動時にパスとパックの価格の取得が同時に走って互いを切り「販売準備中」のまま、(2) 購入シートが閉じた時の resume で再読み込みが走り、購入中の BillingClient を閉じて結果が届かず、ボタンが押せないまま・ポイントは次の起動まで入らなかった。ストアの呼び出しを1本ずつ並べる（monetize.ts の store()）、購入中は resume で読み直さない、シートが開かない／結果が来ない時は打ち切ってストアを読み直して受け取る（購入済みなら付与）、取れた価格は一時的な失敗で消さない、つながらない時は「もう一度読み込む」。
- 広告: AdMob のアカウントが 10/6 に不承認（「利用要件を満たしていない」）のままで、広告が配信されない。コードは ID・初期化とも正しい。初期化・同意・読み込みに時間の上限を付け、読めない／出せない時は「広告を読み込めませんでした。少し待ってから、もう一度押してください。」を出してボタンを戻す（無料で引ける形にはしていない）。1時間を過ぎた読み込み済みの広告は読み直す。失敗の理由を GA4 の ad_error / reward_ad(reason) に送る。
- 起動: ランチャーのアイコンが Capacitor の初期アイコン（X 印）のまま、manifest は正方形の絵（diamond_nine_logo）を直接アイコンにしていて丸く切られていた。スプラッシュもその正方形の絵で、円に切り抜かれて見切れていた。ChatGPT で作ったエンブレム（D9）と夜の球場のロード画面（mobile/store-assets/launch-gpt-2026-10-26/）から、アダプティブアイコン（66dp の安全域）・スプラッシュ（288dp の中の 192dp の円）・旧端末の splash.png を作り直した（mobile/scripts-make-launch-assets.py）。背景は紺 #0A2A66 にそろえ、スプラッシュはウェブ側のロード画面が描けるまで保持（LaunchScreenPlugin・最大4秒）→ロード画面でロゴが上へ動きながら球場が出る→ゲームが描けたらフェード。白い画面が挟まらない。
- エミュレータはこの PC に仮想化支援が無く起動できないため、端末での起動の録画はしていない。Web 側の流れは headless Edge で連続コマを撮って確認。
- テスト版（クローズドテスト alpha）に versionCode 23 を出した。製品版（vc22 審査中）には触っていない。

## 2026-10-17 Android 20 / 1.2.1（10連を外した版）

- 持ち主 10/17「10連スカウトは入れないで」（10/11 にも言われていた）。10/16 の課金の作り直しで入れてしまった 10連（30,000pt で10枚・金以上1枚確定）と、前からあった「まとめて引く」の一覧を、ゲームから外した。スカウトは1枚ずつだけ。
- ポイントのパック6種・プレミアムパス・年齢の月上限・特商法/資金決済法の表示はそのまま。パックの表示は「スカウト◯回分」。
- versionCode 20 / versionName 1.2.1 の AAB をクローズドテストに出して審査へ送った（署名は前と同じ鍵）。
- 製品版へのアクセスは申請中。承認されたら、製品版は versionCode 20（またはそれ以降）で出す。19 以前には 10連が入っているので、製品版に 19 を出さない。

## 作成したもの
- Capacitor 8.5.2 の iOS / Android プロジェクト。アプリIDは com.diamondninebaseball.game（Google Playで利用可能を確認・登録済み）。
- ゲーム・カードデータ・音声・画像を同梱するビルド。リモートサイトを表示するだけの構成ではありません。
- アプリ内のセーブ書き出し・優勝画像共有。OS共有画面経由。実機確認は未実施。
- ネイティブ版ではAdSense無効、Google Fonts外部取得なし。広告SDKは未導入。AndroidにPlay Billing 9.1.0の商品照会のみ導入。決済は無効。
- アプリ内プライバシー説明とiOSのファイル時刻API理由宣言。最終アーカイブに含まれる全SDKの宣言をMacで確認すること。
- 日本語ストア説明文。保存済みのブラウザ版データは自動移行しません。書き出し／読み込みで移行します。

## 現在の提出ブロッカー
1. Google PlayアプリID 4975152091784936533 を作成済み。開発者アカウント登録通過はユーザーから報告済み。Appleは別途登録処理待ち。
2. JDK 21・Android SDK 36導入済み。scripts/build-android.ps1で署名済みAAB/APKを作成。mobile/releasesに出力。接続Android端末がなく、実機検証は未実施。
3. 所有者はMacを利用できないため、Macを備えたクラウドビルド環境が必要。Apple署名が未確認。iOSアーカイブ・IPAは未作成。
4. サポート連絡先は kame6493@gmail.com。/app-support.html と /app-privacy.html を準備済み。
5. アプリアイコン・起動画面は提供済みDIAMOND NINEロゴに差し替え済み。ストア用画像・実機スクリーンショット・端末テストは未実施。
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

## Androidビルドと署名鍵

`npm --prefix mobile run sync:android` → `pwsh -File scripts/build-android.ps1`。iOSはsync:ios。
署名鍵は %LOCALAPPDATA%/DiamondNineBuild/signing/diamond-nine-upload.jks。パスワードは同じフォルダーのDPAPI暗号化ファイル（このWindowsユーザーで復号）。Gitへは保存しない。PC交換前に安全な場所へ鍵と復号可能なパスワードを別途バックアップする。鍵を上書き・再生成しない。

Android報酬・販売案・課金の未実装事項は POINTS-AND-BILLING.md を参照。
