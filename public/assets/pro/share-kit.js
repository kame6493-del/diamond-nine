'use strict';
const gameUrl='https://diamond-nine-baseball.com/';
const introductions=[
 {title:'成績表が好きな人へ',body:'野球の成績表、ずっと見ていられる人へ。\n\n選手を集める→打線を組む→1年進める。\n育てた選手の打率・本塁打・打点・OPSを見る無料ゲーム\n「DIAMOND NINE」⚾\n\nスマホ・PC対応／インストール不要\n'},
 {title:'自分だけの打線を組みたい人へ',body:'俊足を1番に置く？ 強打者を並べる？\n\n選手を集め、打順と守備位置を決めて1シーズン。\n自分の編成がどんな成績になるか楽しめる\n「DIAMOND NINE」⚾\n\n無料・スマホとPCのブラウザで遊べます。\n'},
 {title:'選手を育てるのが好きな人へ',body:'弱小チームから、好きな選手を育てて優勝へ。\n\n試合でポイントを貯める→スカウト→編成・覚醒。\n育てた選手の1年分の成績を楽しむ野球ゲーム\n「DIAMOND NINE」⚾\n\n無料・スマホ対応・インストール不要\n'}
];
for(const [index,intro] of introductions.entries()){
 const article=document.createElement('article');article.className='post';
 const title=document.createElement('h3');title.textContent=intro.title;
 const field=document.createElement('textarea');field.readOnly=true;field.setAttribute('aria-label',intro.title+'の投稿文');field.value=intro.body+'\n'+gameUrl+'\n#野球ゲーム';field.rows=10;
 const actions=document.createElement('div');actions.className='actions';
 const open=document.createElement('a');open.className='primary';open.textContent='この文章でXを開く ↗';open.href='https://twitter.com/intent/tweet?'+new URLSearchParams({text:field.value});open.target='_blank';open.rel='noopener noreferrer';
 const copy=document.createElement('button');copy.className='secondary';copy.type='button';copy.textContent='文章をコピー';
 const status=document.createElement('p');status.className='copy-status';status.setAttribute('role','status');
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(field.value);status.textContent='コピーしました。';}catch{field.focus();field.select();status.textContent='文章を選択しました。コピーしてください。';}});
 actions.append(open,copy);article.append(title,field,actions,status);document.getElementById('posts').append(article);
 const fitText=()=>{field.style.height='auto';field.style.height=field.scrollHeight+'px';};
 field.style.overflow='hidden';fitText();window.addEventListener('resize',fitText);
}
