import {useEffect,useState} from 'react';

// 'bright' is the default: white background with the new effects and gold accents.
// 'stadium' is the night-game design; 'classic' keeps the original look and features.
export type UiTheme='bright'|'stadium'|'classic';
const THEMES:UiTheme[]=['bright','stadium','classic'];
export const UI_THEME_LABEL:Record<UiTheme,string>={bright:'ブライト(新)',stadium:'ナイター',classic:'以前のデザイン'};
const KEY='diamond-nine-ui-theme';
const EVENT='diamond-nine-ui-theme';

export function readUiTheme():UiTheme{
 try{const v=localStorage.getItem(KEY);return THEMES.includes(v as UiTheme)?v as UiTheme:'bright';}catch{return 'bright';}
}

export function setUiTheme(theme:UiTheme){
 try{localStorage.setItem(KEY,theme);}catch{/* the theme simply won't persist */}
 window.dispatchEvent(new Event(EVENT));
}

export const nextUiTheme=(theme:UiTheme)=>THEMES[(THEMES.indexOf(theme)+1)%THEMES.length];

// Class names on .simple-app. Both new themes share the .stadium features.
export const uiThemeClass=(theme:UiTheme)=>theme==='classic'?'':theme==='bright'?' stadium bright':' stadium';

export function useUiTheme():UiTheme{
 const [theme,setTheme]=useState<UiTheme>(readUiTheme);
 useEffect(()=>{const sync=()=>setTheme(readUiTheme());window.addEventListener(EVENT,sync);return()=>window.removeEventListener(EVENT,sync);},[]);
 return theme;
}

// Card frame tier by overall rating, used by the new themes.
export function cardTier(overall:number){
 return overall>=90?'tier-legend':overall>=80?'tier-gold':overall>=65?'tier-silver':'tier-bronze';
}
