# Codexに投げる指示

このプロジェクトに、切り出し済みPNGアセットを本格的に組み込んでください。

## アセット配置

ZIP内の各フォルダを以下に配置します。

public/assets/production/

例：
public/assets/production/buttons/btn_match_large.png
public/assets/production/mascots/mascot_standing.png
public/assets/production/panels/dialog_modal_large.png
public/assets/production/cards/player_cards_set.png
public/assets/production/scoreboards/scoreboard_main.png

## 実装方針

1. `src/constants/assets.ts` を作り、すべてのアセットパスを一元管理してください。
2. `src/components/assets/AssetImage.tsx` を作り、アセット表示用の共通コンポーネントを作ってください。
3. `src/components/assets/AssetPreviewScreen.tsx` を作り、全アセットを一覧表示できる画面を追加してください。
4. ナビゲーションに「アセット」タブを追加してください。
5. HomeScreenにタイトル画像・マスコット・大きめメニューボタン風のUIを組み込んでください。
6. TrainingScreenは `buttons/` と `panels/` を参考に、黄色・青・緑の大きめカード型UIにしてください。
7. PlayerList/PlayerDetailは `cards/player_cards_set.png` と `cards/roster_table_rows.png` を参考に、選手カードを作り直してください。
8. MatchScreenは `scoreboards/scoreboard_main.png` を装飾として表示し、濃紺のスコアボードUIにしてください。
9. ResultModalは `panels/dialog_modal_large.png` と `panels/dialogue_box_mascot_left.png` の雰囲気に寄せてください。
10. SchoolScreenは `schedule/location_tiles.png` を参考に施設カードを作ってください。
11. DataScreenは `schedule/calendar_month.png` と `schedule/weekly_schedule_cards.png` を参考に、年間予定・週間予定を表示してください。
12. SaveLoadPanelは `schedule/save_slots.png` を参考にしてください。
13. マスコットは以下のように使ってください。
    - Home: `mascots/mascot_standing.png`
    - Training: `mascots/mascot_pointing.png`
    - Player: `mascots/mascot_clipboard.png`
    - Match勝利: `mascots/mascot_cheering.png`
    - Match敗北/注意: `mascots/mascot_sweating.png`

## UIルール

- 画像をそのままボタンとして無理に使うより、HTMLボタンをアセット風にCSSで再現してください。
- PNGは装飾・マスコット・参考表示として使ってください。
- 色は黄色、青、緑、白、濃紺で統一してください。
- 角丸は大きく、枠線は太く、影をつけてください。
- 文字は大きめで読みやすくしてください。
- PC/スマホ両対応のレスポンシブにしてください。
- TypeScriptエラーを出さないでください。
- `npm run dev` で起動できる状態を維持してください。

## 追加してほしいREADME内容

- アセットの配置場所
- アセット確認画面の開き方
- どの画面でどの画像を使っているか
- 今後、画像を差し替える場合の手順
