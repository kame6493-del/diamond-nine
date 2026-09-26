# がっこう野球部ものがたり 切り出し済み制作アセット

## 内容

このZIPは、栄冠ナイン風の高校野球部育成ゲーム用に切り出したUI素材セットです。

## フォルダ

- `buttons/`：メニュー、決定、キャンセル、タブ、操作系
- `mascots/`：透過マスコット、顔、バッジ
- `panels/`：モーダル、会話枠、チュートリアル、情報パネル
- `cards/`：選手カード、選手一覧
- `scoreboards/`：試合スコア、結果、練習結果
- `schedule/`：カレンダー、週間予定、施設、ミッション、セーブ枠
- `icons/`：能力アイコン、ランクバッジ、装飾
- `docs/`：対応表、元画像
- `codex/`：Codex用プロンプト、assets.ts雛形

## Codexに渡す流れ

1. このZIPを展開
2. 中身を `public/assets/production/` に配置
3. `codex/CODEX_PROMPT_USE_CUT_ASSETS.md` の内容をCodexに貼る
4. 必要なら `codex/assets.ts` を `src/constants/assets.ts` として使う

## 注意

一部はスプライトシートからの概算切り出しです。
ゲーム実装では、PNGをそのままボタンにするより、PNGの雰囲気を参考にCSS/TailwindでUIを作る方が扱いやすいです。
