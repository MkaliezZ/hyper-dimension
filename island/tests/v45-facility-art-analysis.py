from PIL import Image
import numpy as np, json, hashlib
out={}; cups={}
def bounds(mask,x0=0,y0=0,pad=4):
 ys=np.where(mask.sum(axis=1)>6)[0]; xs=np.where(mask.sum(axis=0)>6)[0]
 assert len(xs) and len(ys)
 x=max(0,x0+int(xs.min())-pad); y=max(0,y0+int(ys.min())-pad)
 return {"x":x,"y":y,"w":int(xs.max())+x0+pad+1-x,"h":int(ys.max())+y0+pad+1-y}
for theme in ["pixel","origami"]:
 path="public/assets/facilities-"+theme+"-components-v45.png"
 im=Image.open(path); a=np.array(im.convert("RGBA"))[:,:,3]; rows=[]
 for ya,yb in [(0,480),(480,835),(835,im.height)]:
  hist=(a[ya:yb]>64).sum(axis=0); groups=[]; start=None
  for x,v in enumerate(hist):
   if v>8 and start is None: start=x
   elif v<=8 and start is not None: groups.append((start,x)); start=None
  if start is not None: groups.append((start,a.shape[1]))
  groups=[(x,z) for x,z in groups if z-x>100]; assert len(groups)==4,(theme,ya,groups)
  rects=[]
  for x,z in groups:
   r=bounds(a[ya:yb,x:z]>64,x,ya)
   r["w"]=min(r["w"],im.width-r["x"]);r["h"]=min(r["h"],im.height-r["y"])
   assert r["x"]+r["w"]<=im.width and r["y"]+r["h"]<=im.height
   rects.append(r)
  rows.append(rects)
 out[theme]={"width":im.width,"height":im.height,"file":path.split("/")[-1],"rows":rows}
 path="public/assets/facility-cup-"+theme+"-v45.png";im=Image.open(path);a=np.array(im.convert("RGBA"))[:,:,3]
 cups[theme]={"width":im.width,"height":im.height,"file":path.split("/")[-1],"frame":bounds(a>64)}
with open("src/facilityArtFrames.js","w",encoding="utf8",newline="\n") as f: f.write("// Measured transparent bounds. Tea bases contain no baked cups.\nexport const FACILITY_ART_FRAMES="+json.dumps(out)+";\nexport const FACILITY_CUP_ART="+json.dumps(cups)+";\n")
report={"frames":out,"cups":cups,"genuineAlpha":True,"views":24,"notes":"Numerical crop bounds only; physical model, three-cup composition and direction require actual rendered visual review.","hashes":{}}
for meta in list(out.values())+list(cups.values()):
 path="public/assets/"+meta["file"]; im=Image.open(path); a=np.array(im)[:,:,3]
 assert im.mode=="RGBA" and int((a==0).sum())>im.width*im.height*.15
 report["hashes"][meta["file"]]=hashlib.sha256(open(path,"rb").read()).hexdigest()
with open("qa/v45/asset-report.json","w",encoding="utf8") as f: json.dump(report,f,indent=2)
print(json.dumps(report))