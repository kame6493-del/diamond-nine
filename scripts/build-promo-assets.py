"""Original typography and vector-style graphics; no player faces or club logos."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/pro'
FONT = Path('C:/Windows/Fonts/meiryob.ttc')
REGULAR = Path('C:/Windows/Fonts/meiryo.ttc')
S = 2

def render(width, height, portrait=False):
    image = Image.new('RGB', (width*S, height*S), '#0c1b34')
    draw = ImageDraw.Draw(image)
    def xy(v): return tuple(round(n*S) for n in v)
    def text(x,y,value,size,fill='#ffffff',bold=True):
        font=ImageFont.truetype(str(FONT if bold else REGULAR),size*S)
        draw.text((x*S,y*S),value,font=font,fill=fill,stroke_width=0)
    def rect(box,fill,radius=0,outline=None):
        draw.rounded_rectangle(xy(box),radius=radius*S,fill=fill,outline=outline,width=2*S)
    def line(points,fill,width=2):draw.line(xy(points),fill=fill,width=width*S)
    def polygon(points,fill):draw.polygon([(int(x*S),int(y*S)) for x,y in points],fill=fill)
    polygon([(width*.68,0),(width,0),(width,height),(width*.29,height)],'#142b53')
    polygon([(width*.86,0),(width,0),(width*.45,height),(width*.34,height)],'#183d78')
    for off in [0,140,290]:
        draw.ellipse(xy((width-430-off,90-off,width+100+off,620+off)),outline='#27456c',width=S)
    def card(x,y,w,h,color,label,number):
        rect((x+8,y+12,x+w+8,y+h+12),'#08162b',20)
        rect((x,y,x+w,y+h),'#f5f8ff',20)
        rect((x+12,y+12,x+w-12,y+48),color,10)
        text(x+23,y+18,label,15)
        cx=x+w/2;top=y+76;u=w/210
        shirt=[(-40,0),(-17,-9),(0,5),(17,-9),(40,0),(78,33),(55,68),(33,53),(41,137),(-41,137),(-33,53),(-55,68),(-78,33)]
        polygon([(cx+a*u,top+b*u) for a,b in shirt],color)
        line((cx,top+6*u,cx,top+137*u),'#ffffff',3)
        text(cx-9*u,top+70*u,str(number),30*u,'#fff')
        text(x+20,y+h-73,'DIAMOND NINE',11,'#637997')
        text(x+20,y+h-47,'YOUR TEAM',19,'#183258')
        line((x+20,y+h-91,x+w-20,y+h-91),'#dce4f0',1)
    if not portrait:
        rect((54,41,92,85),'#316dff',9);text(65,41,'9',28)
        text(108,47,'DIAMOND NINE',23)
        rect((54,121,396,157),'#1e3b62',18);text(71,125,'スマホ・PCで遊べる無料野球ゲーム',14,'#cce4ff')
        text(49,186,'その一枚で、',60)
        text(49,269,'来季が変わる。',60,'#9dcdff')
        text(54,377,'集める。育てる。1年進めて、成績を見る。',23,'#dbe6f8')
        rect((54,474,571,544),'#ffffff',13);text(79,489,'DIAMOND NINE を無料で遊ぶ',23,'#123774')
        text(55,564,'アプリのインストール不要',16,'#c2d1e7',False)
        card(807,96,213,307,'#5272c6','SCOUT',9)
        card(944,225,204,299,'#9c7430','DEVELOP',7)
        card(729,279,213,307,'#217b83','BUILD',1)
    else:
        rect((64,59,106,106),'#316dff',9);text(77,60,'9',29)
        text(125,65,'DIAMOND NINE',29)
        text(62,172,'その一枚で、',86)
        text(62,294,'来季が変わる。',86,'#9dcdff')
        text(64,445,'集める。育てる。',35,'#e2eaf8')
        text(64,503,'1年進めて、成績を見る。',35,'#e2eaf8')
        card(133,669,250,350,'#5272c6','SCOUT',9)
        card(416,627,250,350,'#217b83','BUILD',1)
        card(698,669,250,350,'#9c7430','DEVELOP',7)
        rect((64,1113,1016,1212),'#fff',16);text(110,1135,'スマホ・PCで、無料プレイ。',42,'#123774')
        text(64,1250,'アプリのインストール不要｜紹介URLは投稿文へ',24,'#c2d1e7',False)
    return image.resize((width,height),Image.Resampling.LANCZOS)

OUT.mkdir(parents=True,exist_ok=True)
render(1200,630).save(OUT/'share-cover-v1.png',optimize=True)
render(1080,1350,True).save(OUT/'social-poster-v1.png',optimize=True)
print('Created 1200 x 630 cover and 1080 x 1350 poster')
