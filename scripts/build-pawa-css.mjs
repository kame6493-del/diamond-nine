// src/pro/pawa/pawa.src.css に html[data-look=pawa] .nv-app を付けて src/pro/pawa/pawa.css を作る。
// 見た目「以前」では何も効かないようにするため。 Run: node scripts/build-pawa-css.mjs
import postcss from 'postcss';
import {readFile,writeFile} from 'node:fs/promises';
const P='html[data-look=pawa] .nv-app';
const root=postcss.parse(await readFile('src/pro/pawa/pawa.src.css','utf8'));
root.walkRules(r=>{
 if(r.parent.type==='atrule'&&/keyframes/.test(r.parent.name))return;
 r.selector=r.selector.split(/,(?![^()]*\))/).map(s=>{s=s.trim();
  if(s.startsWith('.look-switch'))return s;
  if(s.startsWith('.nv-app'))return P+s.slice(7);
  return P+' '+s;}).join(',');
});
const head=`/* generated from pawa.src.css by scripts/build-pawa-css.mjs — edit pawa.src.css */
.s-brand-wordmark,.s-nav-art,.s-coin{display:none}
html[data-look=pawa],html[data-look=pawa] body{background:#eaf4ff}
html[data-look=pawa] body::before{background:#1478ff!important}
html[data-look=pawa] .s-brand-wordmark,html[data-look=pawa] .s-nav-art,html[data-look=pawa] .s-coin{display:block}
`;
await writeFile('src/pro/pawa/pawa.css',head+root.toString());
console.log('pawa.css written');
