import {Sparkles} from 'lucide-react';

export const scoutDuration=()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?180:1600;
export function ScoutCharge(){
 return <div className="scout-charge neon-scout" role="status" aria-label="スカウト演出中">
  <div className="neon-orbit animate__animated animate__rotateIn" aria-hidden="true"/>
  <div className="scout-energy animate__animated animate__zoomIn" aria-hidden="true"/>
  <div className="neon-pack animate__animated animate__tada" aria-hidden="true"><Sparkles size={42}/><b>9</b><span>DIAMOND NINE</span></div>
  <div className="scout-flash animate__animated animate__zoomIn" aria-hidden="true"/>
  <strong>SCOUT</strong>
 </div>;
}
