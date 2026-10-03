// Tester feedback goes to a Google Form. The device/version field is prefilled
// so a report says which build it came from; nothing else about the player is sent.
export const FEEDBACK_FORM='https://docs.google.com/forms/d/e/1FAIpQLSeW1CNcA4YFOaGVqwPyNPMtCaV9qKY0zvOWA4bLxh_riS_v_w/viewform';
const DEVICE_ENTRY='entry.896994809';
declare global {interface Window {diamondAppVersion?: string}}

export function deviceLabel(w:{Capacitor?:{getPlatform?:()=>string};diamondAppVersion?:string;navigator?:{userAgent?:string}}=typeof window==='undefined'?{}:window):string{
 const platform=w.Capacitor?.getPlatform?.()??'web';
 const ua=w.navigator?.userAgent??'';
 const os=/Android\s([\d.]+)/.exec(ua)?.[0]??/(iPhone|iPad).*?OS\s([\d_]+)/.exec(ua)?.[0]?.replace(/_/g,'.')??'';
 return [platform==='web'?'ブラウザ版':platform==='ios'?'iOSアプリ':'Androidアプリ',w.diamondAppVersion??'',os].filter(Boolean).join(' / ').slice(0,120);
}
export const feedbackUrl=(label=deviceLabel())=>`${FEEDBACK_FORM}?usp=pp_url&${DEVICE_ENTRY}=${encodeURIComponent(label)}`;
