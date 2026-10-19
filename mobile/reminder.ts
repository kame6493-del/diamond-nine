import {LocalNotifications} from '@capacitor/local-notifications';
import {STAMINA_FULL_TEXT,nextReminders} from '../src/pro/reminder';
import type {} from '../src/pro/reminder';

// Device-only daily reminders. Every launch or resume pushes the next ones out, so a
// player who opens the game each day never sees one; nothing leaves the device.
const IDS=[9101,9102],STAMINA_ID=9103;
async function reschedule(){
 try{
  const perm=await LocalNotifications.checkPermissions();
  if(perm.display!=='granted')return;
  await LocalNotifications.cancel({notifications:IDS.map(id=>({id}))});
  await LocalNotifications.schedule({notifications:nextReminders(new Date()).map((r,i)=>({id:IDS[i],title:r.title,body:r.body,schedule:{at:r.at,allowWhileIdle:false}}))});
 }catch{/* reminders are optional; the game never depends on them */}
}
export function installReminders(){
 window.diamondReminder={
  async ask(){try{const p=await LocalNotifications.requestPermissions();if(p.display==='granted'){await reschedule();return true;}}catch{}return false;},
  async status(){try{return (await LocalNotifications.checkPermissions()).display;}catch{return 'denied';}},
  async off(){try{await LocalNotifications.cancel({notifications:[...IDS,STAMINA_ID].map(id=>({id}))});}catch{}},
  // 行動力が満タンになる時刻に1件。許可が無ければ何もしない(ここから許可は求めない)。
  async staminaFull(at){
   try{
    if((await LocalNotifications.checkPermissions()).display!=='granted')return;
    await LocalNotifications.cancel({notifications:[{id:STAMINA_ID}]});
    if(at&&at>Date.now()+60000)await LocalNotifications.schedule({notifications:[{id:STAMINA_ID,...STAMINA_FULL_TEXT,schedule:{at:new Date(at),allowWhileIdle:false}}]});
   }catch{/* optional */}
  },
 };
 void reschedule();
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void reschedule();});
}
