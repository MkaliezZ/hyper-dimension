// V176 appends content after the original 50 materials / 300 recipes. Never insert
// these rows into the original atlas ordering or the V1 achievement universe.
export const SEASONAL_CROPS={
 cabbage:{name:'甘蓝',seconds:480,item:'cabbage',yield:2,color:'#a3bd7d',seasons:['spring','autumn'],art:'round green cabbage with layered tightly folded leaves'},
 pea:{name:'豌豆',seconds:420,item:'pea',yield:2,color:'#91bd6c',seasons:['spring','autumn'],art:'two green pea pods with round peas visible in one open pod'},
 cucumber:{name:'黄瓜',seconds:600,item:'cucumber',yield:3,color:'#739957',seasons:['summer'],art:'two dark green cucumbers with small bumps and one cut round'},
 eggplant:{name:'茄子',seconds:720,item:'eggplant',yield:2,color:'#9373aa',seasons:['summer','autumn'],art:'two glossy purple eggplants with green calyxes'},
 blueberry:{name:'蓝莓',seconds:900,item:'blueberry',yield:3,color:'#738caf',seasons:['summer'],art:'small cluster of dusty blue berries with five pointed blossom scars'},
 sweet_potato:{name:'红薯',seconds:780,item:'sweet_potato',yield:2,color:'#bd8272',seasons:['autumn'],art:'reddish purple sweet potatoes with an orange cut face'},
 daikon:{name:'白萝卜',seconds:540,item:'daikon',yield:2,color:'#dae0c1',seasons:['autumn','winter'],art:'one long tapered white daikon radish with leafy green top'},
 kale:{name:'羽衣甘蓝',seconds:480,item:'kale',yield:2,color:'#688a65',seasons:['autumn','winter'],art:'curly deep green kale leaves with pale central veins'}
};
export const SEASONAL_RAW_ROWS=Object.entries(SEASONAL_CROPS).map(([id,c])=>[id,c.name,c.art,'farm']);
const foods=[
 ['season_cabbage_wrap','甘蓝饭卷',2,0,8,{cabbage:2,rice:1,herb:1},'two green cabbage rice rolls with rice filling visible at cut ends','甘蓝叶包入煮熟稻米与切碎草药，卷紧后切成饭卷；炉灶提供清水与热源。'],
 ['season_pea_soup','豌豆浓汤',2,0,9,{pea:2,potato:1,seasalt:1},'bowl of pale green pea soup with peas and potato pieces','豌豆与土豆煮软后压成浓汤，以少量海盐调味；不消耗背包中的餐具。'],
 ['season_cucumber_cooler','黄瓜薄荷饮',1,0,9,{cucumber:2,mint:1,honey:1},'one glass of pale cucumber drink with cucumber rounds and mint','黄瓜切片与薄荷浸泡，用蜂蜜调和成清凉饮；茶台提供饮用水与杯具。'],
 ['season_roasted_eggplant','番茄焗茄',2,1,12,{eggplant:2,tomato:1,herb:1},'baked purple eggplant halves topped with tomato and green herbs','茄子剖开后铺上番茄与草药，先煨软再焗香；使用馆内共用炉具烹调。'],
 ['season_blueberry_tart','蓝莓小挞',17,1,12,{blueberry:2,wheat:2,honey:1},'one golden small blueberry tart filled with blue berries','小麦磨粉和成挞壳，加入蜂蜜蓝莓馅烘焙成一份小挞；烤炉提供热源。'],
 ['season_sweet_potato_bread','红薯面包',17,1,12,{sweet_potato:2,wheat:1,honey:1},'one golden bread loaf with orange sweet potato filling visible in a cut','红薯蒸软压泥，与小麦粉和蜂蜜揉成面团，烘烤为一份带馅面包。'],
 ['season_daikon_soup','萝卜海鱼汤',2,0,10,{daikon:2,fish:1,seaweed:1},'bowl of clear fish soup with white daikon rounds and green seaweed','白萝卜切块，与处理好的海鱼和海藻温煮成汤；清水与锅具由食堂提供。'],
 ['season_kale_salad','冬叶沙拉',2,0,9,{kale:2,carrot:1,seasalt:1},'plate of curly dark green kale salad with orange carrot ribbons','羽衣甘蓝嫩叶与胡萝卜切丝后略焯，撒上海盐温拌成一份冬叶沙拉。']
];
// Per-building indices continue at 12; the original twelve rows stay untouched.
const nextIndex={1:12,2:12,17:12};
export const SEASONAL_RECIPES=foods.map(([item,name,building,tier,price,cost,art,construction])=>({id:'recipe_'+item,item,name,building,index:nextIndex[building]++,tier,price,category:'food',art,seasonal:true}));
export const SEASONAL_CRAFT_SPECIFICATIONS=Object.fromEntries(foods.map(([item,name,building,tier,price,cost,art,construction])=>[item,[cost,construction]]));
export const SEASONAL_ITEM_IDS=Object.freeze([...Object.keys(SEASONAL_CROPS),...SEASONAL_RECIPES.map(r=>r.item)]);
