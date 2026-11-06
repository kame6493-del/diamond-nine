// 文字列を縮める(LZ-String の compressToUTF16 / decompressFromUTF16 と同じ方式。MIT, pieroxy)。
// 1字に 15 ビットずつ詰めるので、localStorage にそのまま入れられる。セーブの JSON は 1/8〜1/12 ほどになる。
type Dict=Map<string,number>;
function compress(uncompressed:string,bitsPerChar:number,getCharFromInt:(a:number)=>string):string{
 const dictionary:Dict=new Map(),toCreate=new Set<string>();
 let w='',enlargeIn=2,dictSize=3,numBits=2,value=0,position=0;const data:string[]=[];
 const writeBit=(bit:number)=>{value=(value<<1)|bit;if(position===bitsPerChar-1){position=0;data.push(getCharFromInt(value));value=0;}else position++;};
 const writeBits=(n:number,v:number)=>{for(let i=0;i<n;i++){writeBit(v&1);v>>=1;}};
 const emit=(s:string)=>{
  if(toCreate.has(s)){
   const code=s.charCodeAt(0);
   if(code<256){writeBits(numBits,0);writeBits(8,code);}else{writeBits(numBits,1);writeBits(16,code);}
   enlargeIn--;if(enlargeIn===0){enlargeIn=Math.pow(2,numBits);numBits++;}
   toCreate.delete(s);
  }else writeBits(numBits,dictionary.get(s)!);
  enlargeIn--;if(enlargeIn===0){enlargeIn=Math.pow(2,numBits);numBits++;}
 };
 for(let ii=0;ii<uncompressed.length;ii++){
  const c=uncompressed.charAt(ii);
  if(!dictionary.has(c)){dictionary.set(c,dictSize++);toCreate.add(c);}
  const wc=w+c;
  if(dictionary.has(wc))w=wc;
  else{emit(w);dictionary.set(wc,dictSize++);w=c;}
 }
 if(w!=='')emit(w);
 writeBits(numBits,2);
 for(;;){value=value<<1;if(position===bitsPerChar-1){data.push(getCharFromInt(value));break;}else position++;}
 return data.join('');
}
function decompress(length:number,resetValue:number,getNextValue:(i:number)=>number):string|null{
 const dictionary:string[]=[];let enlargeIn=4,dictSize=4,numBits=3,entry='',w:string,c:string|number;const result:string[]=[];
 const data={val:getNextValue(0),position:resetValue,index:1};
 const readBits=(n:number)=>{let bits=0,power=1;const max=Math.pow(2,n);while(power!==max){const resb=data.val&data.position;data.position>>=1;if(data.position===0){data.position=resetValue;data.val=getNextValue(data.index++);}bits|=(resb>0?1:0)*power;power<<=1;}return bits;};
 for(let i=0;i<3;i++)dictionary[i]=String(i);
 const next=readBits(2);
 switch(next){case 0:c=String.fromCharCode(readBits(8));break;case 1:c=String.fromCharCode(readBits(16));break;case 2:return '';default:return null;}
 dictionary[3]=c;w=c;result.push(c);
 for(;;){
  if(data.index>length)return '';
  let cc=readBits(numBits);
  switch(cc){
   case 0:dictionary[dictSize++]=String.fromCharCode(readBits(8));cc=dictSize-1;enlargeIn--;break;
   case 1:dictionary[dictSize++]=String.fromCharCode(readBits(16));cc=dictSize-1;enlargeIn--;break;
   case 2:return result.join('');
  }
  if(enlargeIn===0){enlargeIn=Math.pow(2,numBits);numBits++;}
  if(dictionary[cc])entry=dictionary[cc];
  else if(cc===dictSize)entry=w+w.charAt(0);
  else return null;
  result.push(entry);
  dictionary[dictSize++]=w+entry.charAt(0);enlargeIn--;
  w=entry;
  if(enlargeIn===0){enlargeIn=Math.pow(2,numBits);numBits++;}
 }
}
export const compressToUTF16=(input:string)=>compress(input,15,a=>String.fromCharCode(a+32))+' ';
export const decompressFromUTF16=(compressed:string)=>compressed===''?'':decompress(compressed.length,16384,i=>compressed.charCodeAt(i)-32);
