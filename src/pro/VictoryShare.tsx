import {saveGameFile} from './native-files';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Camera,Copy,Download,Share2} from 'lucide-react';
import type {GameState,Season} from './engine';
import {canShareVictory,publicGameUrl,victoryShareData,victoryPostText,xPostIntent} from './victory-share';
import {renderVictoryImage,VICTORY_IMAGE_WIDTH,VICTORY_IMAGE_HEIGHT} from './victory-image';
import './victory-share.css';
import {track} from './analytics';

export function VictoryShare({state,season}:{state:GameState;season:Season}){
 const data=useMemo(()=>victoryShareData(state,season),[season,state.club,state.name,state.lineup,state.pitchers,state.defense,state.owned,state.training]);
 const gameUrl=typeof window==='undefined'?'':window.diamondNativeFiles?'https://diamond-nine-baseball.com/':publicGameUrl(window.location.href);
 const [image,setImage]=useState<{url:string;file:File;key:typeof data}|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[sharing,setSharing]=useState(false),[attempt,setAttempt]=useState(0);
 const [zoomed,setZoomed]=useState(false);
 const textArea=useRef<HTMLTextAreaElement>(null),shareLock=useRef(false);
 useEffect(()=>{
  let cancelled=false,objectUrl='';setImage(null);setError('');setNotice('');setZoomed(false);
  if(data)void renderVictoryImage(data,gameUrl).then(blob=>{
   if(cancelled)return;objectUrl=URL.createObjectURL(blob);
   setImage({url:objectUrl,file:new File([blob],`diamond-nine-${data.league}-season-${data.year}.png`,{type:'image/png'}),key:data});
  }).catch(()=>{if(!cancelled)setError('画像を作れませんでした。もう一度お試しください。');});
  return()=>{cancelled=true;if(objectUrl)URL.revokeObjectURL(objectUrl);};
 },[data,gameUrl,attempt]);
 if(!data)return null;
 const ready=image?.key===data?image:null,text= victoryPostText(data,gameUrl),intent=xPostIntent(text);
 const native=!!ready&&(!!window.diamondNativeFiles||canShareVictory(navigator,ready.file,window.isSecureContext));
 const download=()=>{if(!ready)return;void saveGameFile(ready.file).catch(()=>setNotice('画像を保存できませんでした。もう一度お試しください。'));};
 const share=async()=>{
  if(!ready||shareLock.current)return;shareLock.current=true;setSharing(true);setNotice('');
  try{await (window.diamondNativeFiles?window.diamondNativeFiles.share({files:[ready.file],text,title:`DIAMOND NINE · ${data.title}`}):navigator.share({files:[ready.file],text,title:`DIAMOND NINE · ${data.title}`}));setNotice('共有先に画像と投稿文を渡しました。');track('share',{content:data.champion?'victory':'season',method:window.diamondNativeFiles?'native':'web_share'});}
  catch(error){if((error as Error)?.name!=='AbortError')setNotice('この端末では画像を共有できませんでした。画像を保存してXに添付できます。');}
  finally{shareLock.current=false;setSharing(false);}
 };
 const copy=async()=>{try{await navigator.clipboard.writeText(text);setNotice('投稿文をコピーしました。');}catch{textArea.current?.focus();textArea.current?.select();setNotice('投稿文を選択しました。コピーしてお使いください。');}};
 return <section className="victory-share" aria-label={data.champion?'優勝の記録をシェア':'シーズンの記録をシェア'}>
  <div className="victory-share-heading"><Camera size={23}/><div><h2>{data.champion?'優勝の記録をシェア':'シーズンの記録をシェア'}</h2><p>打撃成績・チーム能力・選手一人ひとりの能力を、1枚の記念画像に。</p></div></div>
  {!ready&&!error&&<p role="status">記念画像を作っています…</p>}
  {error&&<p role="alert">{error}<button className="s-text-link" onClick={()=>setAttempt(n=>n+1)}>画像を作り直す</button></p>}
  {ready&&<><div className="victory-share-actions">
   {native?<button className="s-primary" disabled={sharing} onClick={share}><Share2 size={17}/>{sharing?'共有メニューを開いています…':'画像付きで共有する'}</button>:<a className="s-primary" href={intent} target="_blank" rel="noopener noreferrer" onClick={()=>{download();setNotice('保存した画像をXの投稿画面に添付してください。');track('share',{content:data.champion?'victory':'season',method:'x_intent'});}}><Share2 size={17}/>画像を保存してXへ</a>}
   <button className="s-button" onClick={download}><Download size={16}/>画像を保存</button>
  </div><p className="victory-share-help">{native?'共有先でXを選んで投稿できます。':'Xの投稿画面で、保存した画像を添付してください。'}{!gameUrl&&' 公開後はゲームのURLも自動で入ります。'}</p></>}
  <details className="victory-share-preview"><summary>画像・投稿文を確認</summary>
   {ready&&<><div className={`victory-share-image${zoomed?' is-zoomed':''}`} role="region" aria-label="記念画像プレビュー" tabIndex={zoomed?0:undefined}><button className="victory-share-image-button" aria-label={zoomed?'記念画像を縮小する':'記念画像を拡大する'} aria-pressed={zoomed} onClick={()=>setZoomed(value=>!value)}><img src={ready.url} alt={`${data.year}年目の${data.title}記念画像。${data.name}の打撃成績と${data.abilityLabel}、野手9人・投手${data.pitcherAbilities.length}人の${data.playerAbilityLabel}。`} width={VICTORY_IMAGE_WIDTH} height={VICTORY_IMAGE_HEIGHT}/></button></div><p className="victory-share-help">{zoomed?'上下・左右にスクロールして確認できます。もう一度タップすると縮小します。':'画像をタップすると拡大できます。'}</p></>}
   <label>投稿文<textarea ref={textArea} value={text} readOnly rows={6}/></label>
   <div className="victory-share-tools"><button className="s-button" onClick={copy}><Copy size={15}/>投稿文をコピー</button><a className="s-text-link" href={intent} target="_blank" rel="noopener noreferrer">Xの投稿画面を開く ↗</a></div>
  </details>
  {notice&&<p role="status" className="victory-share-notice">{notice}</p>}
 </section>;
}
