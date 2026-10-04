import type {GameState} from './engine';

// "Autumn showdown week" follows the draft week around the real championship series.
// Each season finished while it runs pays a one-time bonus; the claim id is kept with
// the club's other reward claims so reloads and imports never pay twice.
// Dates are the player's local calendar days, inclusive.
export const AUTUMN_EVENT={id:'autumn-2026',start:'2026-11-04',end:'2026-11-16',name:'秋の頂上決戦ウィーク',bonus:2000} as const;

const localDay=(now:Date)=>`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
export function autumnEventActive(now:Date|null=new Date()):boolean{
 if(!now||Number.isNaN(now.getTime()))return false;
 const day=localDay(now);
 return day>=AUTUMN_EVENT.start&&day<=AUTUMN_EVENT.end;
}
export const autumnEventEndLabel=()=>{const [,m,d]=AUTUMN_EVENT.end.split('-').map(Number);return `${m}/${d}`;};
const claimId=(state:GameState)=>`${AUTUMN_EVENT.id}-season-${state.season.number}`;

// Pays the bonus for a just-finished season while the event runs; otherwise returns the state unchanged.
export function claimAutumnBonus(state:GameState,now:Date|null):[GameState,number]{
 if(!autumnEventActive(now)||!state.season.completed||state.franchise.claimed.includes(claimId(state)))return [state,0];
 return [{...state,gems:state.gems+AUTUMN_EVENT.bonus,franchise:{...state.franchise,claimed:[...state.franchise.claimed,claimId(state)]}},AUTUMN_EVENT.bonus];
}
