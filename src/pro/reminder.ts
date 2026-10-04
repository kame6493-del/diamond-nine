// Daily reminder schedule and the one-time ask. The native bridge (mobile/reminder.ts)
// sets window.diamondReminder; the browser build never has it.
declare global {interface Window {diamondReminder?:{ask():Promise<boolean>;status():Promise<string>;off():Promise<void>}}}

export const REMINDER_HOUR=19;
const ASKED_KEY='diamond-nine-reminder-asked';

// Tomorrow and three days out, at 19:00 local time.
export function nextReminders(now:Date){
 const at=(days:number)=>{const d=new Date(now);d.setDate(d.getDate()+days);d.setHours(REMINDER_HOUR,0,0,0);return d;};
 return [
  {at:at(1),title:'DIAMOND NINE',body:'今日のログインボーナス 500pt が受け取れます。今日の目標もそろっています。'},
  {at:at(3),title:'DIAMOND NINE',body:'チームが次の試合を待っています。スカウトで補強して、まずは勝ち越しを目指そう。'},
 ];
}
const read=()=>{try{return localStorage.getItem(ASKED_KEY);}catch{return '1';}};
// Ask once, after the player has finished a season (they know what the bonus is by then).
export const reminderAskDue=(seasonsPlayed:number)=>typeof window!=='undefined'&&!!window.diamondReminder&&seasonsPlayed>=1&&read()!=='1';
export function markReminderAsked(){try{localStorage.setItem(ASKED_KEY,'1');}catch{/* asks again next time */}}
