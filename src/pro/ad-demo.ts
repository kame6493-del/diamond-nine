// ブラウザ版で「広告を見て1回引く」の流れを確かめるための見本(テスト表示)。
// URL に ?addemo=1 を付けたときだけ入る(タブを閉じるまで有効)。本物の広告は出さず、広告SDKも読み込まない。
// アプリ版は mobile/monetize.ts の本物の AdMob ブリッジが window.diamondMonetize に入るので、ここは何もしない。
import {REWARD_AD_DAILY_LIMIT,REWARD_AD_POINTS,dailyLeft,localDay,parseDaily,spendDaily,type MonetizeBridge,type MonetizeSnapshot,type RewardOutcome} from './monetization';

const KEY='diamond-nine-reward-ads-demo',FLAG='diamond-nine-addemo',SECONDS=5;
const read=(k:string)=>{try{return localStorage.getItem(k);}catch{return null;}};
const write=(k:string,v:string)=>{try{localStorage.setItem(k,v);}catch{/* this session only */}};

export function installAdDemo(){
 if(typeof window==='undefined'||window.diamondMonetize)return;
 let on=false;
 try{on=new URLSearchParams(location.search).get('addemo')==='1'||sessionStorage.getItem(FLAG)==='1';if(on)sessionStorage.setItem(FLAG,'1');}catch{/* storage blocked */}
 if(!on)return;
 const listeners=new Set<()=>void>();let busy=false;
 const build=():MonetizeSnapshot=>({privacyOptions:false,premium:{status:'unavailable',owned:false,verified:false,price:null,busy:false,message:''},reward:{available:true,busy,left:dailyLeft(parseDaily(read(KEY)),localDay(),REWARD_AD_DAILY_LIMIT),limit:REWARD_AD_DAILY_LIMIT,points:REWARD_AD_POINTS}});
 let snap=build();const emit=()=>{snap=build();for(const l of listeners)l();};
 const showRewardAd=(onReward:(points:number)=>void)=>new Promise<RewardOutcome>(resolve=>{
  if(busy){resolve('busy');return;}
  if(dailyLeft(parseDaily(read(KEY)),localDay(),REWARD_AD_DAILY_LIMIT)<=0){resolve('limit');return;}
  busy=true;emit();
  const box=document.createElement('div');box.className='dn-addemo';box.setAttribute('role','dialog');box.setAttribute('aria-label','広告(テスト表示)');
  box.innerHTML='<div class="dn-addemo-card"><p class="dn-addemo-tag">テスト表示</p><h2>ここに動画広告が流れます</h2><p>アプリ版では AdMob のリワード広告を最後まで見ると、1回引けます。</p><p class="dn-addemo-count"></p><button type="button" class="dn-addemo-close">閉じる</button></div>';
  document.body.appendChild(box);
  const count=box.querySelector('.dn-addemo-count') as HTMLElement,close=box.querySelector('.dn-addemo-close') as HTMLButtonElement;
  let left=SECONDS,granted=false;
  const tick=()=>{count.textContent=left>0?`あと ${left} 秒で報酬`:'報酬を受け取りました。閉じると1回引きます。';};
  tick();
  const timer=setInterval(()=>{left--;if(left<=0&&!granted){granted=true;clearInterval(timer);write(KEY,JSON.stringify(spendDaily(parseDaily(read(KEY)),localDay())));onReward(REWARD_AD_POINTS);}tick();},1000);
  close.onclick=()=>{clearInterval(timer);box.remove();busy=false;emit();resolve(granted?'rewarded':'dismissed');};
 });
 const bridge:MonetizeBridge={
  snapshot:()=>snap,subscribe:l=>{listeners.add(l);return()=>{listeners.delete(l);};},
  buyPremium:async()=>{},restorePremium:async()=>{},showRewardAd,noteScout:()=>{},showInterstitial:async()=>false,claimPremiumDaily:()=>0,showPrivacyOptions:async()=>{},
 };
 window.diamondMonetize=bridge;
}
