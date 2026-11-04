# 試合の人形の動きのコマ(scripts/motion-frames/*.png、ChatGPT イメージで今の絵柄に合わせて描いた青のチーム)を
# 1枚の絵(atlas_blue.webp)にまとめ、青を赤に塗り替えた atlas_red.webp も作る。場所は src/pro/sprite-atlas.ts に書く。
# 使い方: python -I scripts/build-motion-atlas.py (リポジトリの一番上で)
import colorsys,os,sys
from PIL import Image
root=os.getcwd();src=os.path.join(root,'scripts','motion-frames');out=os.path.join(root,'public','assets','pro','watch','m')
base={'run_run1':'runner','run_lead':'runner','field_ready':'fielder'}
names=sorted(f[:-4] for f in os.listdir(src) if f.endswith('.png'))
ims={n:Image.open(os.path.join(src,n+'.png')).convert('RGBA') for n in names}
for n,b in base.items():ims[n]=Image.open(os.path.join(root,'public','assets','pro','watch',b+'_blue.webp')).convert('RGBA')
order=sorted(ims)
W=1024;x=y=rowh=0;rects={}
for n in order:
 im=ims[n]
 if x+im.width+2>W:x=0;y+=rowh+2;rowh=0
 rects[n]=(x,y,im.width,im.height);x+=im.width+2;rowh=max(rowh,im.height)
H=y+rowh
sheet=Image.new('RGBA',(W,H),(0,0,0,0))
for n,(a,b,w,h) in rects.items():sheet.alpha_composite(ims[n],(a,b))
os.makedirs(out,exist_ok=True)
sheet.save(os.path.join(out,'atlas_blue.webp'),quality=90,alpha_quality=100,method=6)
# 青 → 赤(帽子・シャツ。紺の線は暗いので残す。今の赤の人形と同じ色味)
red=sheet.copy();px=red.load()
for j in range(H):
 for i in range(W):
  r,g,b,a=px[i,j]
  if a==0:continue
  h,s,v=colorsys.rgb_to_hsv(r/255,g/255,b/255)
  if .52<h<.72 and s>.35 and v>.38:
   nr,ng,nb=colorsys.hsv_to_rgb(.995,min(1,s*1.05),min(1,v*1.08))
   px[i,j]=(round(nr*255),round(ng*255),round(nb*255),a)
red.save(os.path.join(out,'atlas_red.webp'),quality=90,alpha_quality=100,method=6)
# 大きさの倍率: 立ち姿の高さ(128)を1。横になったコマは低い。
lines=[]
for n,(a,b,w,h) in rects.items():
 k=round(h/128,3)
 lines.append(f" {n}:[{a},{b},{w},{h}{','+str(k) if k!=1 else ''}],")
ts=open(os.path.join(root,'src','pro','sprite-atlas.ts'),encoding='utf8').read()
head=ts[:ts.index('export const ATLAS')]
open(os.path.join(root,'src','pro','sprite-atlas.ts'),'w',encoding='utf8',newline='\n').write(head+'export const ATLAS:{frames:Partial<Record<FrameName,[number,number,number,number,number?]>>}={frames:{\n'+'\n'.join(lines)+'\n}};\n')
print(W,H,len(rects))
