'use strict';
const introUrl='https://diamond-nine-baseball.mannchikann.chatgpt.site/welcome.html';
const copyButton=document.getElementById('welcome-copy');
copyButton?.addEventListener('click',async()=>{
 const status=document.getElementById('welcome-status');
 try{await navigator.clipboard.writeText(introUrl);status.textContent='紹介URLをコピーしました。';}
 catch{const field=document.getElementById('welcome-url');field.hidden=false;field.focus();field.select();status.textContent='下のURLを長押し、または選択してコピーしてください。';}
});
