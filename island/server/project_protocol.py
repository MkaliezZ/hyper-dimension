"""Validate Hermes preparation proposals before the world accepts them."""
def validate_preparation(args, world, manual):
 if not manual:return {'ok':False,'reason':'自动巡查不创建新的筹备计划，请由岛主发起'}
 if not isinstance(args,dict):return {'ok':False,'reason':'invalid request'}
 title=args.get('title');targets=args.get('targets')
 if not isinstance(title,str) or not title.strip() or len(title)>50:return {'ok':False,'reason':'计划名称应为 1–50 字'}
 if not isinstance(targets,list) or not 1<=len(targets)<=8:return {'ok':False,'reason':'每份清单 1–8 种物品'}
 allowed={r['id'] for r in world.get('materials',[])}|{r['item'] for r in world.get('recipes',[])}
 output={}
 for row in targets:
  if not isinstance(row,dict):return {'ok':False,'reason':'物资条目无效'}
  item=row.get('item');quantity=row.get('quantity')
  if not isinstance(item,str) or item not in allowed:return {'ok':False,'reason':'未知或尚未解锁的物品'}
  if not isinstance(quantity,int) or isinstance(quantity,bool) or not 1<=quantity<=50:return {'ok':False,'reason':'每种物品需要 1–50 份'}
  if item in output:return {'ok':False,'reason':'物品重复，请合并数量'}
  output[item]=quantity
 if any(p.get('status') in ['preparing','ready','paused'] and p.get('title')==title.strip() and p.get('targets')==output for p in world.get('projects',[])):return {'ok':False,'reason':'已有同名物资清单，请查看当前筹备进度'}
 if len([p for p in world.get('projects',[]) if p.get('status') in ['preparing','ready','paused']])>=3:return {'ok':False,'reason':'已有三份计划，请先完成或取消'}
 return {'ok':True,'title':title.strip(),'targets':output}
