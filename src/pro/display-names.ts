// Display aliases only. Player/team IDs and the reference snapshots stay stable.
export function maskPlayerName(name:string):string{
 if(name.includes('〇'))return name;
 const chars=Array.from(name);
 const letters=chars.flatMap((char,index)=>/\p{L}/u.test(char)?[index]:[]);
 if(!letters.length)return '〇';
 chars[letters[1]??letters[0]]='〇';
 return chars.join('');
}

const locations:Record<string,[name:string,mark:string,short?:string]>={
 t:['兵庫','HY'],g:['東京','TK'],db:['横浜','YH'],c:['広島','HR'],
 s:['東京・新宿','SJ'],d:['愛知','AC'],h:['福岡','FK'],f:['北海道','HK'],
 b:['大阪','OS'],e:['宮城','MG'],l:['埼玉','ST'],m:['千葉','CB'],
 'mlb-108':['アナハイム','ANH'],'mlb-109':['アリゾナ','AZ'],
 'mlb-110':['ボルチモア','BAL'],'mlb-111':['ボストン','BOS'],
 'mlb-112':['シカゴ北','CHN'],'mlb-113':['シンシナティ','CIN'],
 'mlb-114':['クリーブランド','CLE'],'mlb-115':['コロラド','COL'],
 'mlb-116':['デトロイト','DET'],'mlb-117':['ヒューストン','HOU'],
 'mlb-118':['カンザスシティ','KC'],'mlb-119':['ロサンゼルス','LA'],
 'mlb-120':['ワシントン','WSH'],
 'mlb-121':['ニューヨーク・クイーンズ','QNS','クイーンズ'],
 'mlb-133':['カリフォルニア','CA'],'mlb-134':['ピッツバーグ','PIT'],
 'mlb-135':['サンディエゴ','SD'],'mlb-136':['シアトル','SEA'],
 'mlb-137':['サンフランシスコ','SF'],'mlb-138':['セントルイス','STL'],
 'mlb-139':['タンパベイ','TB'],'mlb-140':['テキサス','TX'],
 'mlb-141':['トロント','TOR'],'mlb-142':['ミネソタ','MIN'],
 'mlb-143':['フィラデルフィア','PHL'],'mlb-144':['アトランタ','ATL'],
 'mlb-145':['シカゴ南','CHS'],'mlb-146':['マイアミ','MIA'],
 'mlb-147':['ニューヨーク・ブロンクス','BRX','ブロンクス'],
 'mlb-158':['ミルウォーキー','MIL'],
};

// Stable display identities for the space circuit. Save/schedule IDs are shared
// with the overseas circuit, so aliases must always be resolved per season.
export const spaceTeams:Record<string,{name:string;short:string;mark:string}>=Object.fromEntries(([
 ['108','ソーラーフレアーズ','SOL'],['109','ルナガーディアンズ','LUN'],
 ['110','マーズブレイカーズ','MAR'],['111','ジュピタータイタンズ','JUP'],
 ['112','サターンリングス','SAT'],['113','ネプチューンウェーブス','NEP'],
 ['114','マーキュリーブレイズ','MER'],['115','ヴィーナスウィングス','VEN'],
 ['116','ウラヌスストームズ','URA'],['117','プルートシャドウズ','PLU'],
 ['118','オリオンスターズ','ORI'],['119','シリウスキングス','SIR'],
 ['120','ベガアローズ','VEG'],['121','アルタイルファルコンズ','ALT'],
 ['133','テラパイオニアーズ','TER'],['134','デネブフェニックス','DEN'],
 ['135','リゲルナイツ','RIG'],['136','アンタレススコーピオンズ','ANT'],
 ['137','ポラリスセントリーズ','POL'],['138','アンドロメダレギオン','AND'],
 ['139','ペガサスフライヤーズ','PEG'],['140','ドラコファングス','DRA'],
 ['141','ケンタウルスランサーズ','CEN'],['142','カシオペアクラウンズ','CAS'],
 ['143','フェニックスノヴァ','PHX'],['144','コメットストライカーズ','COM'],
 ['145','ネビュラミラージュ','NEB'],['146','パルサーボルツ','PUL'],
 ['147','クエーサードミナーズ','QSR'],['158','エクリプスレイヴンズ','ECL'],
] as const).map(([id,name,mark])=>[`mlb-${id}`,{name,short:name,mark}]));

export function teamLocation(id:string){
 const location=locations[id];
 if(!location)throw new Error(`Missing team location: ${id}`);
 const [name,mark,short=name]=location;
 return {name,short,mark};
}
