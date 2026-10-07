export const AVATAR_SPECS=[
 ['male_0','男','海风旅人','navy short-haired adult man, teal explorer coat, cream shirt, brown boots, small satchel','沉稳的蓝绿外套与旅人挎包'],
 ['male_1','男','木作青年','golden curly-haired adult man, tan craft vest, rolled white sleeves, dark trousers, goggles on forehead','金色卷发、护目镜与木作马甲'],
 ['male_2','男','月光学者','silver straight-haired adult man, violet scholarly long coat, round glasses, cream waistcoat','银发、眼镜与紫色长外套'],
 ['male_3','男','田野岛主','brown short-haired adult man, straw hat, sage green overalls, yellow scarf','草帽、黄围巾与绿色背带裤'],
 ['male_4','男','夜潮乐手','long black-haired adult man in low ponytail, burgundy scarf, slate blue jacket, headphones at neck','黑色低马尾、红围巾与耳机'],
 ['male_5','男','远航船长','mature red-haired adult man with neat short beard, navy captain coat, white cap, brass buttons','短须、白色船帽与深蓝船长服'],
 ['female_0','女','月白漫游者','black bob-haired adult woman, ivory coatdress, pale blue scarf, brown ankle boots','黑色短发、月白裙装与浅蓝围巾'],
 ['female_1','女','晴日花匠','pink high-ponytail adult woman, sunflower yellow overalls, white shirt, green apron pocket','粉色马尾、向日葵色背带裤'],
 ['female_2','女','紫藤画师','lavender braided-haired adult woman, mauve artist apron, cream blouse, purple beret','紫色长辫、贝雷帽与画师围裙'],
 ['female_3','女','星火工匠','silver pixie-haired adult woman, burgundy mechanic coveralls, brass belt, work boots','银色短发、酒红工装与金属腰带'],
 ['female_4','女','珊瑚航海家','red curly-haired adult woman, ocean blue coat, striped blouse, tan trousers','红色卷发、海蓝外套与条纹内衫'],
 ['female_5','女','麦香烘焙师','warm brown-skinned curly brown-haired adult woman, orange dress, cream baking apron, cloth hairband','卷发发带、麦色围裙与橙色裙装']
];
export const AVATARS=AVATAR_SPECS.map(([id,gender,name,art,description],index)=>({id,gender,name,art,description,index}));
export const AVATAR_BY_ID=Object.fromEntries(AVATARS.map(a=>[a.id,a]));
