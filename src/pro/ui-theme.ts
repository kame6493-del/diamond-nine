import {useEffect,useState} from 'react';

// 'stadium' is the night-game design; 'classic' keeps the original look.
export type UiTheme='stadium'|'classic';
const KEY='diamond-nine-ui-theme';
const EVENT='diamond-nine-ui-theme';

export function readUiTheme():UiTheme{
 try{return localStorage.getItem(KEY)==='classic'?'classic':'stadium';}catch{return 'stadium';}
}

export function setUiTheme(theme:UiTheme){
 try{localStorage.setItem(KEY,theme);}catch{/* the theme simply won't persist */}
 window.dispatchEvent(new Event(EVENT));
}

export function useUiTheme():UiTheme{
 const [theme,setTheme]=useState<UiTheme>(readUiTheme);
 useEffect(()=>{const sync=()=>setTheme(readUiTheme());window.addEventListener(EVENT,sync);return()=>window.removeEventListener(EVENT,sync);},[]);
 return theme;
}

// Card frame tier by overall rating, used by the stadium theme.
export function cardTier(overall:number){
 return overall>=90?'tier-legend':overall>=80?'tier-gold':overall>=65?'tier-silver':'tier-bronze';
}
