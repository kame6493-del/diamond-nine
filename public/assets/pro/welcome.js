'use strict';
const introUrl='https://diamond-nine-baseball.com/welcome.html';
const shareLink=document.getElementById('welcome-x');
if(shareLink){const share=new URL(shareLink.href);share.searchParams.set('url',introUrl);shareLink.href=share.href;}
document.getElementById('welcome-url').value=introUrl;
const copyButton=document.getElementById('welcome-copy');
copyButton?.addEventListener('click',async()=>{
 const status=document.getElementById('welcome-status');
 try{await navigator.clipboard.writeText(introUrl);status.textContent='紹介URLをコピーしました。';}
 catch{const field=document.getElementById('welcome-url');field.hidden=false;field.focus();field.select();status.textContent='下のURLを長押し、または選択してコピーしてください。';}
});
