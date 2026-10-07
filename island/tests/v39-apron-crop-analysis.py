from PIL import Image
import json, os
meta=json.load(open('public/assets/art-frames-v8.json',encoding='utf-8'))
before=json.load(open('qa/v39/baseline/public/assets/art-frames-v8.json',encoding='utf-8'))
file='items-pixel-products-0-v8.png'; im=Image.open('public/assets/'+file).convert('RGBA'); f=before[file]['frames'][50]; current=meta[file]['frames'][50]
main=neighbor=0; main_lost=neighbor_left=0
for y in range(f['y'],f['y']+f['h']):
 for x in range(f['x'],f['x']+f['w']):
  if im.getpixel((x,y))[3]<32:continue
  inside=current['x']<=x<current['x']+current['w'] and current['y']<=y<current['y']+current['h']
  if x<=465:main+=1;main_lost+=not inside
  if x>=479:neighbor+=1;neighbor_left+=inside
assert main==12026 and neighbor==152 and main_lost==0 and neighbor_left==0
report={'alphaThreshold':32,'mainPixels':main,'mainPixelsLost':main_lost,'neighborPixels':neighbor,'neighborPixelsRetained':neighbor_left,'passed':True}
os.makedirs('qa/v39',exist_ok=True)
json.dump(report,open('qa/v39/apron-crop-report.json','w',encoding='utf-8'),indent=2)
print(json.dumps(report))
