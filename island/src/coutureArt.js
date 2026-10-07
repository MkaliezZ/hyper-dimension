const cache={};
export function coutureStageAsset(theme){return '/assets/couture-stage-'+theme+(theme==='pixel'?'-v89b.png':'-v89.png');}
export function coutureStageImage(theme){const file=coutureStageAsset(theme);if(!cache[file]){const im=new Image();im.src=file;cache[file]=im;}return cache[file];}
export function coutureStage(s){const g=s.coutureParty?.session;if(g?.phase!=='running')return[];const p=g.layout.buyers[3];return[{x:p.x,y:p.y+5}];}
export function drawCoutureStage(ctx,p,theme,now){const im=coutureStageImage(theme);if(!im.complete||!im.naturalWidth)return;const h=132,w=h*im.naturalWidth/im.naturalHeight;ctx.save();ctx.imageSmoothingEnabled=theme!=='pixel';ctx.drawImage(im,p.x-w/2,p.y-h,w,h);ctx.strokeStyle='rgba(255,234,168,'+(.25+.18*Math.sin(now*2))+')';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(p.x,p.y-5,21,6,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
