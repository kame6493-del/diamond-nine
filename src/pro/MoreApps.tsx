import {ChevronRight} from 'lucide-react';
import {MORE_APPS,playUrl,promoSource} from './more-apps';
import {track} from './analytics';
import {iosEdition} from './platform-economy';

// Same card as the other settings links (s-guide-entry), with the app icon on the left.
export function MoreApps(){
 if(iosEdition)return null; // iOS 1.5.0: no links to other apps or to Google Play
 const source=promoSource(typeof window!=='undefined'&&!!window.diamondNativeFiles);
 return <section className="more-apps" aria-label="作者のほかのゲーム"><h3>作者のほかのゲーム</h3>{MORE_APPS.map(a=><a key={a.id} className="s-guide-entry more-app" href={playUrl(a.id,source)} target="_blank" rel="noopener noreferrer" onClick={()=>track('crosspromo_open',{to:a.key,from:'settings'})}><img src={a.icon} alt="" width={44} height={44} loading="lazy"/><span>{a.line}<strong>{a.name}</strong></span><ChevronRight size={18}/></a>)}</section>;
}
