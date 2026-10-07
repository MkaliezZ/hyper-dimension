from PIL import Image
from pathlib import Path
from collections import deque
import json, hashlib
root=Path(__file__).resolve().parents[1]
output={}
KINDS={0:['full','full','apron'],1:['hat','gloves','comb'],2:['shawl','cape','skirt'],3:['full','full','full']}
def component_bounds(alpha,kind):
    w,h=alpha.size
    values=bytearray(1 if a>64 else 0 for a in alpha.tobytes())
    components=[]
    for start in range(w*h):
        if not values[start]: continue
        values[start]=0; q=deque([start]); count=0; x0=w; y0=h; x1=-1; y1=-1
        while q:
            at=q.popleft(); x=at%w; y=at//w
            count+=1; x0=min(x0,x); x1=max(x1,x); y0=min(y0,y); y1=max(y1,y)
            for target in ([at-1] if x else [])+([at+1] if x+1<w else [])+([at-w] if y else [])+([at+w] if y+1<h else []):
                if values[target]: values[target]=0; q.append(target)
        components.append((count,x0,y0,x1+1,y1+1))
    assert components
    main=max(components,key=lambda c:c[0]); keep=[main]
    for c in components:
        if c is main: continue
        dx=max(main[1]-c[3],c[1]-main[3],0); dy=max(main[2]-c[4],c[2]-main[4],0)
        pair=kind=='gloves' and c[0]>=main[0]*.18 and abs((c[2]+c[4])-(main[2]+main[4]))<h*.35
        shoe=kind=='full' and c[0]>=max(60,main[0]*.003) and main[1]<=((c[1]+c[3])/2)<=main[3] and c[2]>=main[4]-4 and dy<=(main[4]-main[2])*.12
        if pair or shoe: keep.append(c)
    removed=sum(c[0] for c in components if c not in keep)
    return (min(c[1] for c in keep),min(c[2] for c in keep),max(c[3] for c in keep),max(c[4] for c in keep)),removed,len(keep)
for p in sorted(list((root/'public/assets').glob('garments-*-pack-*-v35.png'))+list((root/'public/assets').glob('avatar-heads-*-v35.png'))):
    image=Image.open(p); assert image.mode=='RGBA', p
    alpha=image.getchannel('A'); hist=alpha.histogram()
    ratio=sum(hist[:10])/(image.width*image.height)
    assert .4<ratio<.85, (p,ratio)
    assert all(alpha.getpixel(pt)<10 for pt in [(0,0),(image.width-1,0),(0,image.height-1),(image.width-1,image.height-1)]),p
    frames=[]; debris=0
    kinds=KINDS[int(p.stem.split('-pack-')[1].split('-')[0])] if '-pack-' in p.name else ['head']*3
    # Generated objects sometimes cross their nominal grid edge. Overscan recovers the
    # whole primary object; ownership excludes neighboring objects and detached debris.
    mx=round(image.width/5*.12); my=round(image.height/3*.08)
    for row in range(3):
        for col in range(5):
            left=max(0,round(col*image.width/5)-mx); right=min(image.width,round((col+1)*image.width/5)+mx)
            top=max(0,round(row*image.height/3)-my); bottom=min(image.height,round((row+1)*image.height/3)+my)
            bounds,removed,owned=component_bounds(alpha.crop((left,top,right,bottom)),kinds[row])
            x,y,x1,y1=bounds; debris+=removed
            assert x1>x and y1>y,(p,row,col)
            frames.append(dict(x=left+x,y=top+y,w=x1-x,h=y1-y,ownedComponents=owned))
    output[p.name]=dict(width=image.width,height=image.height,transparentRatio=round(ratio,4),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),excludedDetachedPixels=debris,frames=frames)
(root/'public/assets/garment-frames-v35.json').write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding='utf-8')
(root/'qa/v35/asset-report.json').write_text(json.dumps(dict(kind='read-only alpha ownership and overscan crop analysis; original PNG pixels unchanged',assets=output,passed=True),ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(dict(assets=len(output),cells=sum(len(v['frames']) for v in output.values()),passed=True)))
