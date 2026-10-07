from pathlib import Path
from PIL import Image
import json
root=Path(__file__).resolve().parents[1]
rows=json.loads((root/'qa/v35/tool-art-source.json').read_text('utf-8'))
report=[]
for row in rows:
 im=Image.open(root/'public/assets'/row['file']);r=row['frame'];points={}
 for name in ['grip','tip']:
  v=row[name];x=round(r['x']+v[0]*r['w']);y=round(r['y']+v[1]*r['h']);a=im.getpixel((x,y))[3]
  best=min(((dx*dx+dy*dy,dx,dy) for dy in range(-12,13) for dx in range(-12,13) if 0<=x+dx<im.width and 0<=y+dy<im.height and im.getpixel((x+dx,y+dy))[3]>96),default=None)
  points[name]=dict(x=x,y=y,alpha=a,nearestOpaqueOffset=list(best[1:]) if best else None)
  assert a>96,(row['id'],row['theme'],name,points[name])
 report.append(dict(id=row['id'],theme=row['theme'],points=points))
(root/'qa/v35/tool-anchor-report.json').write_text(json.dumps(dict(kind='read-only actual source-alpha verification of grips and working ends',checks=report,passed=True),indent=2),encoding='utf-8')
print(json.dumps(dict(checkedPoints=len(report)*2,passed=True)))
