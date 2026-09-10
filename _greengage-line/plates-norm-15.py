from PIL import Image
import os
GROUND=(0xfc,0xf8,0xee)
SET=["grapes","green-grapes","pumpkin","pomegranate","prickly-pear","pear",
     "jerusalem-artichoke","fennel","plum","melon","fig","tomato"]

def mask(im):
    px=im.load(); w,h=im.size
    return [[ (px[x,y][3]>=8 and (abs(px[x,y][0]-GROUND[0])>22 or abs(px[x,y][1]-GROUND[1])>22 or abs(px[x,y][2]-GROUND[2])>22)) for x in range(w)] for y in range(h)]

def bbox_main(m,w,h,tag):
    """bbox of the dominant blob. Detached marks under 5% of total ink are ASSET DEFECTS,
       not content, and are excluded from the crop (still a crop, Law 4)."""
    colcount=[sum(1 for y in range(h) if m[y][x]) for x in range(w)]
    total=sum(colcount)
    xs=[x for x in range(w) if colcount[x]]
    runs=[]; s=xs[0]; p=xs[0]
    for x in xs[1:]:
        if x>p+3: runs.append((s,p)); s=x
        p=x
    runs.append((s,p))
    scored=[(sum(colcount[a:b+1]),a,b) for a,b in runs]
    scored.sort(reverse=True)
    keep=[(a,b) for n,a,b in scored if n/total>=0.05]
    dropped=[(a,b,n) for n,a,b in scored if n/total<0.05]
    if dropped: print(f"  ⚠ {tag}: DROPPED detached mark(s) {dropped} — asset defect, also live on the site")
    minx=min(a for a,b in keep); maxx=max(b for a,b in keep)
    ys=[y for y in range(h) if any(m[y][x] for x in range(minx,maxx+1))]
    return minx,min(ys),maxx,max(ys)

crops={}
for s in SET:
    im=Image.open(f"raw/{s}@3x.png").convert("RGBA")
    w,h=im.size; m=mask(im)
    x0,y0,x1,y1=bbox_main(m,w,h,s)
    c=im.crop((x0,y0,x1+1,y1+1)); crops[s]=c
    print(s,"->",c.size)
common=max(max(c.size) for c in crops.values()); side=int(round(common*1.06))
print("common longest edge",common,"square side",side)
os.makedirs("plates",exist_ok=True)
for s,c in crops.items():
    sc=common/max(c.size)
    nw,nh=max(1,int(round(c.width*sc))),max(1,int(round(c.height*sc)))
    r=c.resize((nw,nh),Image.LANCZOS)
    canvas=Image.new("RGBA",(side,side),(0,0,0,0))
    canvas.paste(r,((side-nw)//2,(side-nh)//2),r)
    canvas.save(f"plates/{s}.png")
print("done")
