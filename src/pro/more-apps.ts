// "Other apps by the developer" in the settings dialog (from vc42 / 1.4.9). Settings only:
// never during a season, a scout or a result screen. Taps are counted twice:
// the GA4 event crosspromo_open here, and installs in the target app's Play Console
// (User acquisition -> utm_source=diamondnine / utm_campaign=settings).
// Apps for adults only (Kachimake, 18+) are never listed. No prices, no "free".
export interface MoreApp {id:string;name:string;line:string;icon:string;key:string}

export const MORE_APPS:MoreApp[]=[
 {id:'jp.harunobouken.app',key:'haru',name:'ハルの冒険',line:'走って跳んで剣でたたかう、横スクロールのアクションゲーム',icon:'/assets/pro/more/haru.png'},
];

// referrer is passed by Play to the Install Referrer as-is, so encode its body once.
export function playUrl(targetId:string,source:string,campaign='settings'):string{
 const referrer=`utm_source=${source}&utm_medium=crosspromo&utm_campaign=${campaign}`;
 return `https://play.google.com/store/apps/details?id=${encodeURIComponent(targetId)}&referrer=${encodeURIComponent(referrer)}`;
}

// The app build and the web build are told apart in utm_source.
export const promoSource=(native:boolean)=>native?'diamondnine':'diamondnine_web';
