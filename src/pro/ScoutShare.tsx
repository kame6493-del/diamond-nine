import {useRef,useState} from 'react';
import {Share2} from 'lucide-react';
import {saveGameFile} from './native-files';
import {canShareVictory,publicGameUrl,xPostIntent} from './victory-share';
import {renderScoutImage,scoutPostText,type ScoutShareData} from './share-kit';
import {track} from './analytics';
import {noteDailyMission} from './daily';

// One tap after a scout: build the card image, then hand image + post text to the
// OS share sheet (app) or Web Share; otherwise save the image and open X's composer.
export function ScoutShare({data}:{data:ScoutShareData}){
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState('');const lock=useRef(false);
 const gameUrl=typeof window==='undefined'?'':window.diamondNativeFiles?'https://diamond-nine-baseball.com/':publicGameUrl(window.location.href);
 const share=async()=>{
  if(lock.current)return;lock.current=true;setBusy(true);setNotice('');
  const text=scoutPostText(data,gameUrl);
  try{
   const blob=await renderScoutImage(data,gameUrl),file=new File([blob],'diamond-nine-scout.png',{type:'image/png'});
   if(window.diamondNativeFiles){await window.diamondNativeFiles.share({files:[file],text,title:'DIAMOND NINE · スカウト'});track('share',{content:'scout',method:'native',tier:data.tier});}
   else if(canShareVictory(navigator,file,window.isSecureContext)){await navigator.share({files:[file],text,title:'DIAMOND NINE · スカウト'});track('share',{content:'scout',method:'web_share',tier:data.tier});}
   else{await saveGameFile(file);window.open(xPostIntent(text),'_blank','noopener,noreferrer');setNotice('保存した画像をXの投稿画面に添付してください。');track('share',{content:'scout',method:'x_intent',tier:data.tier});}
  }catch(error){if((error as Error)?.name!=='AbortError')setNotice('共有できませんでした。もう一度お試しください。');}
  finally{lock.current=false;setBusy(false);noteDailyMission('share');}
 };
 return <div className="scout-share">
  <button type="button" className={'s-button scout-share-button'+(data.tier!=='standard'?' is-shiny':'')} disabled={busy} onClick={share}><Share2 size={16}/>{busy?'画像を作っています…':data.tier==='rainbow'?'虹カードを自慢する':data.tier==='gold'?'この当たりをシェア':'この選手をシェア'}</button>
  {notice&&<p role="status" className="scout-share-notice">{notice}</p>}
 </div>;
}
