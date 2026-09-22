import {initialState,initialSandboxState,migrateState,saveKeyFor,type GameState} from './engine';
import type {Profile} from './progression';

type SaveStore=Pick<Storage,'getItem'|'setItem'>;
type ResetStore=SaveStore&Pick<Storage,'removeItem'|'key'|'length'>;
const backupPointer=(profile:Profile)=>`${saveKeyFor(profile)}-reset-backup`;
export function readResetBackup(profile:Profile,store:SaveStore):GameState|null {
 try{const key=store.getItem(backupPointer(profile)),raw=key?store.getItem(key):null;const state=raw?migrateState(JSON.parse(raw)):null;return state&&(state.mode==='career')===(profile==='career')?state:null;}catch{return null;}
}
function archive(state:GameState,profile:Profile,store:SaveStore){
 const key=`${saveKeyFor(profile)}-snapshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 store.setItem(key,JSON.stringify(state));return key;
}
export function resetTeam(state:GameState,profile:Profile,store:SaveStore):GameState {
 const fresh=profile==='career'?initialState():initialSandboxState();fresh.name=state.name;fresh.club=state.club;
 const backup=archive(state,profile,store);
 store.setItem(backupPointer(profile),backup);
 // Never change the active save until its recoverable snapshot exists.
 store.setItem(saveKeyFor(profile),JSON.stringify(fresh));return fresh;
}
export function restoreResetBackup(current:GameState,profile:Profile,store:SaveStore):GameState {
 const backup=readResetBackup(profile,store);if(!backup)return current;
 archive(current,profile,store);store.setItem(saveKeyFor(profile),JSON.stringify(backup));return backup;
}

// Complete restart of this club, including every recoverable reset snapshot.
// Only the game's current profile namespace is touched, never unrelated storage.
export function completeResetTeam(profile:Profile,store:ResetStore):GameState {
 const fresh=initialState();fresh.mode=profile;
 const key=saveKeyFor(profile),keys:string[]=[];
 for(let i=0;i<store.length;i++){const candidate=store.key(i);if(candidate&&(candidate===backupPointer(profile)||candidate.startsWith(`${key}-snapshot-`)))keys.push(candidate);}
 // Check that the new playable save can be written before deleting old snapshots.
 store.setItem(key,JSON.stringify(fresh));
 for(const old of keys)store.removeItem(old);
 return fresh;
}
