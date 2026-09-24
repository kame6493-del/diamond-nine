import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

const source=await readFile('public/assets/pro/share-kit.js','utf8');
const {introductions,gameUrl}=runInNewContext(source.slice(0,source.indexOf('for(const [index'))+';({introductions,gameUrl})',{location:{origin:'https://diamond-nine-baseball.mannchikann.chatgpt.site'}});
const dir='marketing/X投稿セット';await mkdir(dir,{recursive:true});
const posts=introductions.map((intro,index)=>{
 const body=index===0?intro.body.replace('見る無料ゲーム\n','見る無料ゲームを作りました。\n'):intro.body;
 const text=body+'\n'+gameUrl+'\n#野球ゲーム';
 // These drafts use plain Japanese, ASCII and single-code-point emoji only.
 const withoutUrls=text.replace(/https?:\/\/\S+/g,'');
 const weight=[...withoutUrls].reduce((total,c)=>total+(c.codePointAt(0)<=0x10ff?1:2),0)+23;
 if(weight>280)throw new Error('X post exceeds 280 weighted characters: '+intro.title);
 return {...intro,text,weight};
});
for(const [i,post] of posts.entries())await writeFile(`${dir}/${i+1}-${post.title}.txt`,post.text+'\n');
await copyFile('public/assets/pro/share-cover-v1.png',dir+'/DIAMOND-NINE-X.png');
await copyFile('public/assets/pro/social-poster-v1.png',dir+'/DIAMOND-NINE-vertical.png');
const alt='DIAMOND NINEの紹介画像。その一枚で、来季が変わる。青・緑・金のユニフォームカードと、集める・育てる・1年進めて成績を見るという遊び方。スマホとPCで遊べる無料の野球ゲーム。';
await writeFile(dir+'/画像の説明.txt',alt+'\n');
await writeFile(dir+'/最初にお読みください.txt',`1. 「1-成績表が好きな人へ.txt」をコピーしてXの投稿画面へ。\n2. 「DIAMOND-NINE-X.png」を1枚添付。縦長画像は別案です。\n3. 内容を確認して投稿。投稿後はプロフィールに固定すると、後から来た人にも見つけてもらえます。\n\n画像の説明（ALT）は「画像の説明.txt」を使用できます。\n\nスマホで取り出すページ：${gameUrl}share.html\nゲーム：${gameUrl}\n\n2026年9月24日時点で独自ドメインのHTTPSが準備中のため、動作確認済みのURLを使用しています。\n投稿は自動では送信されません。有料広告や自動予約は設定していません。\n`);
const old=await readFile('marketing/宣伝セット.md','utf8');
const plan=old.slice(old.indexOf('## 最初の7日間'));
await writeFile('marketing/宣伝セット.md',`# DIAMOND NINE 宣伝セット\n\n2026年9月24日更新。独自ドメインはHTTPS準備中のため、今回の投稿は動作確認済みURLを使用します。\n\nゲーム：${gameUrl}\n画像保存・投稿文コピー：${gameUrl}share.html\n\n## まず投稿する1本\n\n${posts[0].text}\n\n添付：X投稿セット/DIAMOND-NINE-X.png（1200×630）。投稿後にプロフィールへ固定。\n\n## 次の投稿：編成\n\n${posts[1].text}\n\n添付は自分が実際に遊んだ編成画面を使うと、遊び方が伝わります。\n\n## 次の投稿：育成\n\n${posts[2].text}\n\n添付はX投稿セット/DIAMOND-NINE-vertical.png（1080×1350）、または自分の育成画面。\n\n## 画像の説明\n\n${alt}\n\n通常ポストの280相当以内を確認済み（順に${posts.map(p=>p.weight).join('、')}）。URLは23として計算。実際の投稿画面でも確認します。\n参照：[Xの文字数・リンクの仕様](https://business.x.com/ja/help/campaign-setup/creative-ad-specifications)、[リンクは23文字として計算](https://help.x.com/ja/using-x/how-to-post-a-link)。\n\n${plan}`);
console.log(JSON.stringify({directory:dir,weights:posts.map(p=>p.weight),firstPost:posts[0].text,intent:'https://twitter.com/intent/tweet?'+new URLSearchParams({text:posts[0].text})},null,2));
