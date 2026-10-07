"""Manual Hermes proposals preserve the selected template; the game owns consent and costs."""
TEMPLATES={'fishing','night','market','couture','fireworks'}
def validate_party(args,world,manual):
 if not manual:return {'ok':False,'reason':'自动巡查不创建活动，请由岛主发起'}
 if not isinstance(args,dict) or not isinstance(world,dict):return {'ok':False,'reason':'活动方案无效'}
 legacy=world.get('party')
 template=args.get('template',(legacy or {}).get('template','fishing') if isinstance(legacy,dict) else 'fishing')
 if not isinstance(template,str) or template not in TEMPLATES:return {'ok':False,'reason':'当前只支持钓鱼、星灯夜集、集市、穿搭和烟花大会'}
 contexts=world.get('partyTemplates')
 party=contexts.get(template) if isinstance(contexts,dict) else None
 if party is None and isinstance(legacy,dict) and legacy.get('template','fishing')==template:party=legacy
 if not isinstance(party,dict) or party.get('template',template)!=template:return {'ok':False,'reason':'缺少对应活动手账，请重新观察'}
 all_parties=list(contexts.values()) if isinstance(contexts,dict) else [party]
 if any(isinstance(p,dict) and isinstance(p.get('session'),dict) and p['session'].get('phase') in ['running','checkin'] for p in all_parties) or party.get('session'):
  return {'ok':False,'reason':'先完成当前活动'}
 name=args.get('name');description=args.get('description','');tags=args.get('tags',[]);difficulty=args.get('difficulty','normal');guest=args.get('guestId')
 if not isinstance(name,str) or not name.strip() or len(name)>24:return {'ok':False,'reason':'活动名称需为 1–24 字'}
 if not isinstance(description,str) or len(description)>200:return {'ok':False,'reason':'主题描述最多 200 字'}
 allowed={t['id'] for t in party.get('tags',[]) if isinstance(t,dict) and isinstance(t.get('id'),str)}
 if not isinstance(tags,list) or len(tags)>2 or any(not isinstance(t,str) or t not in allowed for t in tags) or len(set(tags))!=len(tags):return {'ok':False,'reason':'主题标签无效'}
 if difficulty not in ['normal','easy']:return {'ok':False,'reason':'难度无效'}
 candidates=party.get('candidates',[])
 fixed={p.get('id') for p in party.get('fixedRoles',[]) if isinstance(p,dict)}
 if guest is not None and (not isinstance(guest,int) or isinstance(guest,bool) or guest in fixed or not any(isinstance(g,dict) and g.get('id')==guest and any(t in tags for t in g.get('tags',[])) for g in candidates)):return {'ok':False,'reason':'嘉宾必须是符合主题的现有居民，不能重复固定岗位'}
 reason=args.get('guestReason','')
 if not isinstance(reason,str) or len(reason)>180:return {'ok':False,'reason':'推荐理由最多 180 字'}
 if 'fireworks' in args and not isinstance(args['fireworks'],bool):return {'ok':False,'reason':'烟花选项必须是布尔值'}
 if template!='night' and args.get('fireworks') not in [None,False]:return {'ok':False,'reason':'此活动不支持夜集烟花助兴'}
 if 'autoHost' in args and not isinstance(args['autoHost'],bool):return {'ok':False,'reason':'主持委托必须是布尔值'}
 d=party.get('draft') or {}
 proposal={'template':template,'name':name.strip(),'description':description.strip(),'tags':sorted(tags),'difficulty':difficulty,'guestId':guest,'guestReason':reason,'expectedId':d.get('id'),'expectedVersion':d.get('version'),'expectedStamp':d.get('stamp')}
 if args.get('autoHost') is True:proposal['autoHost']=True
 if template=='night':proposal['fireworks']=args.get('fireworks',False)
 return {'ok':True,'proposal':proposal}
