// 2026-11-07 夜 持ち主「とりあえず速く売りたい。収益上げたい」: 欲しくなる場面で、本物の中身を見せて購入の案内を出す。
// だます作りはしない(嘘のカウントダウン・残り数・脅しは使わない)。同じ場面で何度も出さない。
//  - 'short' : スカウトでポイントが足りない時に、引くボタンを押した(本人の操作。回数の制限なし)
//  - 'hit'   : 金・虹カードを引いた後、次の1回のポイントが足りない(本人の操作。回数の制限なし)
//  - 'loss'  : 監督して戦った大事な試合に負けた(自動。下の回数の制限あり)
//  - 'season': 優勝を逃したシーズンの結果を閉じた(自動。下の回数の制限あり)
// 自動で出すのは 1日 OFFER_DAILY_AUTO 回まで・前回から OFFER_GAP_MS あける・同じ場面は1日1回。
// はじめての購入だけのパック(pt_first_30000)は、はじめて値段つきで見せた時から FIRST_PACK_WINDOW_MS の間だけ。
// 過ぎたら本当にどこにも出さない(残り時間の表示はこの時刻から数える本物)。
export type OfferMoment = 'short' | 'hit' | 'loss' | 'season';
export const AUTO_MOMENTS: readonly OfferMoment[] = ['loss', 'season'];
export const OFFER_DAILY_AUTO = 2;
export const OFFER_GAP_MS = 30 * 60 * 1000;
// 自動の案内は、スカウトを何回か引いて仕組みが分かってから(はじめての数分で売り込まない)。
export const OFFER_MIN_PULLS = 5;
export const FIRST_PACK_WINDOW_MS = 72 * 60 * 60 * 1000;

const day = (t: number) => {const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;};

export interface OfferLog {day: string; shown: number; last: number; moments: OfferMoment[]}
export const emptyOfferLog = (): OfferLog => ({day: '', shown: 0, last: 0, moments: []});
export function parseOfferLog(raw: string | null): OfferLog {
 try {
  const v = raw ? JSON.parse(raw) : null;
  if (v && typeof v.day === 'string' && Number.isFinite(v.shown) && Number.isFinite(v.last) && Array.isArray(v.moments)) return {day: v.day, shown: v.shown, last: v.last, moments: v.moments.filter((m: unknown) => typeof m === 'string') as OfferMoment[]};
 } catch {/* 壊れていたら最初から */}
 return emptyOfferLog();
}
/** 自動の案内を今出してよいか。本人が押した時('short'・'hit')は数えない。 */
export function offerDue(log: OfferLog, moment: OfferMoment, now: number, pulls: number): boolean {
 if (!AUTO_MOMENTS.includes(moment)) return true;
 if (pulls < OFFER_MIN_PULLS) return false;
 const today = day(now), same = log.day === today;
 if (same && log.shown >= OFFER_DAILY_AUTO) return false;
 if (same && log.moments.includes(moment)) return false;
 if (now - log.last < OFFER_GAP_MS) return false;
 return true;
}
export function noteOffer(log: OfferLog, moment: OfferMoment, now: number): OfferLog {
 if (!AUTO_MOMENTS.includes(moment)) return log;
 const today = day(now), same = log.day === today;
 return {day: today, shown: (same ? log.shown : 0) + 1, last: now, moments: [...(same ? log.moments : []), moment]};
}

/** はじめての購入だけのパックの期間。start=はじめて見せた時刻(null=まだ見せていない)。 */
export function firstPackWindow(start: number | null, now: number): {open: boolean; leftMs: number} {
 if (start === null) return {open: true, leftMs: FIRST_PACK_WINDOW_MS};
 const left = start + FIRST_PACK_WINDOW_MS - now;
 return {open: left > 0, leftMs: Math.max(0, left)};
}
/** 残り時間の表示(切り捨て。0分になる前に「1分未満」)。 */
export function formatLeft(ms: number): string {
 const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
 if (ms <= 0) return '終了';
 if (d > 0) return `${d}日 ${h}時間`;
 if (h > 0) return `${h}時間 ${mm}分`;
 return m > 0 ? `${m}分` : '1分未満';
}
/** 回数 n を引いた時の、その段の平均の枚数(提供割合 × 回数)。 */
export const expectedCount = (draws: number, rate: number) => draws * rate;

// ---- 端末に覚える(セーブとは別) ----
const LOG_KEY = 'diamond-nine-offer-log', FIRST_KEY = 'diamond-nine-first-pack-start';
const read = (k: string) => {try {return typeof localStorage === 'undefined' ? null : localStorage.getItem(k);} catch {return null;}};
const write = (k: string, v: string) => {try {localStorage.setItem(k, v);} catch {/* この回だけ */}};
export const readOfferLog = () => parseOfferLog(read(LOG_KEY));
export const writeOfferLog = (log: OfferLog) => write(LOG_KEY, JSON.stringify(log));
export const readFirstPackStart = (): number | null => {const v = Number(read(FIRST_KEY)); return Number.isFinite(v) && v > 0 ? v : null;};
/** はじめて値段つきで見せた時に呼ぶ(2回目からは何もしない)。 */
export const startFirstPackWindow = (now = Date.now()) => {if (readFirstPackStart() === null) write(FIRST_KEY, String(now));};
export const firstPackWindowNow = (now = Date.now()) => firstPackWindow(readFirstPackStart(), now);
