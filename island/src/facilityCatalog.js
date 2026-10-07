export const FUNCTIONAL_FACILITIES=Object.freeze({
 c14_6:{kind:'irrigation',name:'滴灌管',tag:'农田灌溉',seconds:3,capacity:8,cost:{c6_5:1},output:null,shape:{rx:25,ry:15,h:61},description:'水族馆的过滤器接入竹制储水罐，可灌溉八次。连接至多四块田；只给已播种的田浇水，不会播种、收获或缩短成熟时间。',range:330},
 c6_8:{kind:'nursery',name:'海虾育养盒',tag:'水产育养',seconds:240,capacity:3,cost:{shrimp:1,c6_0:1},output:'shrimp',shape:{rx:28,ry:17,h:65},description:'投放一只海虾与一份海藻饲料，照料四分钟后收取三只海虾。每批需重新投料，成品可用于食堂、鱼饵及后续水产制作。'},
 c1_9:{kind:'tea',name:'暖手茶炉',tag:'居民茶歇',seconds:12,capacity:3,cost:{tea:3,wood:1},output:null,shape:{rx:25,ry:15,h:59},description:'投入三份花茶和一份木材，温热十二秒后供应三杯。饥饿居民会走到炉前逐杯饮用，实际恢复饱足与体力；不凭空增加茶或岛币。'}
});
export const functionalDefinition=id=>FUNCTIONAL_FACILITIES[id]||null;
