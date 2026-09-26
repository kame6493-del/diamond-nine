# iOS 版のビルドと TestFlight 提出（Mac なし）

2026-09-26 作成。GitHub Actions のクラウド Mac でビルドし、そのまま App Store Connect（TestFlight）へ上げる。
設定ファイルは `.github/workflows/ios-testflight.yml` と `mobile/ios/ExportOptions.plist`。

## 済んでいること
- アイコンと起動画面を DIAMOND NINE のロゴに差し替えた（それまでは Capacitor の初期アイコンのままだった）。作り直しは `python scripts/make-ios-icons.py`。
- iPhone 専用にした（`TARGETED_DEVICE_FAMILY = 1`）。iPad も対象にすると iPad 用スクリーンショットが別に必要になる。
- Info.plist の端末条件を armv7 → arm64 に直した。暗号化の申告（`ITSAppUsesNonExemptEncryption = false`）を入れた。HTTPS 以外の暗号は使っていないので、提出ごとの輸出規制の質問が出なくなる。
- ビルド番号は GitHub Actions の実行回数を使う。バージョン名は 1.0。
- git だけでウェブ部分がビルドできることを、きれいな複製で確認した。

- リポジトリは https://github.com/kame6493-del/diamond-nine （非公開）。2026-09-26 に「compile_only」で署名なしビルドを流し、Xcode 26.6 で BUILD SUCCEEDED を確認した。
- 無料枠の注意：非公開リポジトリの macOS は 1 分が 10 分扱い。無料の月 2,000 分は macOS だと約 200 分（ビルド 5〜10 回分）。

## 持ち主がやること（1 回だけ）

### 1. Apple Developer Program に登録
iPhone の「Apple Developer」アプリから個人で登録できる。年額 99 米ドル相当。承認まで 1〜2 日かかることがある。

### 2. アプリの ID と App Store Connect のアプリを作る
1. https://developer.apple.com/account/resources/identifiers で「+」→ App IDs → App。Bundle ID は Explicit で `com.diamondninebaseball.game`。
2. https://appstoreconnect.apple.com →「アプリ」→「+」→ 新規 App。プラットフォーム iOS、名前「DIAMOND NINE 野球シミュレーション」、言語 日本語、バンドル ID は上で作ったもの、SKU は `diamondnine`。

### 3. App Store Connect API キーを作る
1. App Store Connect →「ユーザとアクセス」→「統合」→「App Store Connect API」→「チームキー」→「+」。
2. 名前 `github-actions`、アクセス「Admin」（自動署名で証明書とプロファイルを作るため）。
3. `.p8` ファイルをダウンロードする（1 回しかダウンロードできない）。「キー ID」と、表の上にある「Issuer ID」を控える。
4. チーム ID は https://developer.apple.com/account の「メンバーシップの詳細」にある 10 文字。

キーと ID はチャットに貼らない。

### 4. GitHub にシークレットを 4 つ登録
リポジトリ（作成済み）の Settings → Secrets and variables → Actions → New repository secret。

| 名前 | 中身 |
|---|---|
| `ASC_KEY_ID` | キー ID |
| `ASC_ISSUER_ID` | Issuer ID |
| `APPLE_TEAM_ID` | チーム ID |
| `ASC_KEY_P8_BASE64` | `.p8` を base64 にした文字列（下のコマンド） |

PowerShell で `.p8` を base64 にしてクリップボードへ入れる:
```
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$HOME\Downloads\AuthKey_XXXXXXXXXX.p8")) | Set-Clipboard
```

## ビルドの実行
GitHub のリポジトリ → Actions →「iOS TestFlight」→「Run workflow」。20〜40 分で App Store Connect の TestFlight に届く。
届いたら TestFlight の「内部テスト」に自分を入れれば、iPhone の TestFlight アプリで遊べる。

## 審査に出す前に App Store Connect で入れるもの
- スクリーンショット：6.9 インチ用 1320×2868 の 5 枚を `mobile/store-assets/app-store/iphone69-1.png`〜`5.png` に用意済み（Google Play 用の 1080×1920 は iPhone では使えない）。
- 説明文・キーワード・サポート URL（https://diamond-nine-baseball.com/app-support.html）・プライバシーポリシー URL（https://diamond-nine-baseball.com/app-privacy.html）。
- App のプライバシー：「データを収集しない」。Google Play の回答と同じ。
- 年齢制限：質問票はすべて「なし」。
- AI で作った画像：ロゴは AI 製（持ち主の回答）。

## うまくいかないとき
- `No profiles for 'com.diamondninebaseball.game'`：API キーのアクセスが Admin でない。または手順 2 の App ID が無い。
- `Secret ... is not set`：手順 4 のシークレット名の打ち間違い。
- ビルド番号の重複で上がらない：Actions をもう 1 回実行すれば番号が進む。
