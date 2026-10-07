import {AVATAR_BY_ID} from './avatarCatalog.js';
export const recruitmentWorldKey=(state,theme)=>String(state?.saveSlot||'legacy-'+theme);
export const RECRUITMENT_RULES=Object.freeze({permanent:16,temporary:1,agents:2,depth:1,wage:8,termDays:2,renewalLimit:3});
export const RECRUIT_CANDIDATE=Object.freeze({id:'mai',name:'小麦',kind:'agent_recruited',job:'活动筹备伙伴',appearance:'female_4',color:'#b98b5e',personality:'细致、守时、喜欢把大计划拆成小步骤',backstory:'在群岛之间采风的手作人，愿意为一场庆典留下来，结束后继续旅程。',lifeGoal:'把分散的物资准备成一场大家都能参加的活动',speechStyle:'温和具体，先说明做到了哪一步，再说明还需要什么。',specialties:['forest','farm','mine','workshop'],relationships:[],dialogue:['我会先核对缺口，再一步步把东西准备齐。'],interest:['forest','mine','workshop'],version:1});
export const RECRUIT_STAGES=['awaiting_ferry','inbound','landing','working','leaving_room','returning','waiting_boat','boarding','outbound','departed'];
export const RECRUIT_STAGE_LABEL={awaiting_ferry:'等候来岛渡船',inbound:'乘船前来',landing:'经栈桥上岛',working:'岛上协作',leaving_room:'收好工具，交接工作',returning:'经栈桥返回码头',waiting_boat:'候船告别',boarding:'正在登船',outbound:'乘船离岛',departed:'已离岛，同步名册'};

export const RECRUIT_CANDIDATES=Object.freeze([RECRUIT_CANDIDATE,
 Object.freeze({...RECRUIT_CANDIDATE,id:'yan',name:'岩川',job:'矿石与木作匠',appearance:'male_1',color:'#897047',personality:'直率、耐心，做东西之前会先检查材料',backstory:'沿群岛修理木船的匠人，愿意在靠岸期间帮忙采矿与制作。',lifeGoal:'让每一件用品结实耐用',speechStyle:'简短务实，遇到缺料会说清楚原因。',specialties:['采矿','木作','陶艺'],fieldGoals:['forest','mine'],workBuildings:[0,15,18,20,23,24],interest:['mine','workshop']}),
 Object.freeze({...RECRUIT_CANDIDATE,id:'he',name:'禾青',job:'田园与花艺师',appearance:'female_1',color:'#8ca364',personality:'开朗、细心，会记住每块田地的生长情况',backstory:'带着种植手账走访群岛的花匠，喜欢帮朋友把一场聚会布置得生机盎然。',lifeGoal:'让每个停留过的小岛都有一角花园',speechStyle:'轻快亲切，先说明植物与食材还需要什么。',specialties:['耕种','花艺','温室'],fieldGoals:['farm','forest'],workBuildings:[3,14,22],interest:['farm','workshop']}),
 Object.freeze({...RECRUIT_CANDIDATE,id:'tang',name:'棠音',job:'茶点与布艺师',appearance:'female_5',color:'#bd825d',personality:'温和、讲究细节，喜欢在忙碌中照顾大家',backstory:'在岛间集市售卖手作茶点的旅人，愿意为一场主题相聚准备点心与服饰。',lifeGoal:'让大家记住相聚时的味道和颜色',speechStyle:'具体而温柔，做好一份才说完成一份。',specialties:['烘焙','茶点','服装'],fieldGoals:['farm','dock'],workBuildings:[1,2,4,9,17,19],interest:['tea','farm']})]);
export const RECRUIT_CANDIDATE_BY_ID=Object.fromEntries(RECRUIT_CANDIDATES.map(c=>[c.id,c]));
export function candidateStepAllowed(candidate,step){const command=step.command||step;if(!candidate.fieldGoals&&!candidate.workBuildings)return true;return command.buildingId!=null?(candidate.workBuildings||[]).includes(command.buildingId):(candidate.fieldGoals||[]).includes(command.goal);}
export function customRecruitCandidate(input,id){
 const role=RECRUIT_CANDIDATE_BY_ID[input?.roleId];if(!role||!AVATAR_BY_ID[input?.appearance])throw Error('请选择已有职业与角色形象');
 const lengths={name:16,personality:160,backstory:200},fields={};for(const[k,max]of Object.entries(lengths)){const v=input[k];if(typeof v!=='string'||!v.trim()||v.length>max)throw Error('请填写完整的姓名、性格与来历，并保持在字数限制内');fields[k]=v.trim();}
 const allowed=['roleId','appearance',...Object.keys(lengths)];if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('自建伙伴只能配置形象、职业、姓名、性格与来历');
 return {...structuredClone(role),...fields,id,appearance:input.appearance,custom:true,roleId:role.id,version:1};
}
