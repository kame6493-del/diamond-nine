// セーブの文字列の形(11/6)。縮めた物は頭に D9Z1: が付く。前の素の JSON もそのまま読める。
import type {GameState} from './engine';
import {compressToUTF16,decompressFromUTF16} from './lz-utf16';

const PACKED='D9Z1:';
/** 保存する文字列にする(縮めた方が短い時だけ縮める)。 */
export function encodeSave(state:GameState):string{const json=JSON.stringify(state),packed=PACKED+compressToUTF16(json);return packed.length<json.length?packed:json;}
/** 保存した文字列を JSON に戻す(縮めた物も素の JSON も読む)。読めない時は null。 */
export function decodeSave(raw:string|null):string|null{if(raw===null)return null;if(!raw.startsWith(PACKED))return raw;const out=decompressFromUTF16(raw.slice(PACKED.length));return out||null;}
/** 保存した文字列から読む(JSON.parse まで)。 */
export const parseSave=(raw:string|null):unknown=>{const text=decodeSave(raw);return text===null?null:JSON.parse(text);};
