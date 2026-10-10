// 見た目の切り替え(新しい=明るいパワプロ風 / 以前=これまでの白地)。セーブデータとは別に端末へ覚える。
export type Look='pawa'|'classic';
const KEY='diamond-nine-look';

export function readLook():Look{
 try{return localStorage.getItem(KEY)==='classic'?'classic':'pawa';}catch{return 'pawa';}
}
export function applyLook(look:Look){
 if(typeof document==='undefined')return;
 document.documentElement.dataset.look=look;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',look==='pawa'?'#e8f3ff':'#ffffff');
}
export function saveLook(look:Look){
 try{localStorage.setItem(KEY,look);}catch{/* 保存できなくても今の表示は切り替える */}
 applyLook(look);
}
