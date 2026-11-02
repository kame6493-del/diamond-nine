// オンラインランキングの Firebase(ウェブ)の設定。公開してよい識別子だけ。
// null の間はランキングの入口を出さない(ゲームは今までどおり)。
// 2026-11-03: 新しいプロジェクト diamondnine-rank はアカウントのプロジェクト数の上限で作れず、まだ空。
// 作れたら、Firebase コンソールのウェブアプリの firebaseConfig をそのまま入れる。
export const firebaseConfig:Record<string,string>|null=null;
