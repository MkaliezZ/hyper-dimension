import {readFileSync} from 'node:fs';
const policy=JSON.parse(readFileSync(new URL('./model-policy.json',import.meta.url),'utf8'));
if(policy.apiModel!=='deepseek-flash'||policy.allowAutomaticModelFallback!==false)throw Error('岛屿 NPC 必须使用 DeepSeek V4.1 Flash，禁止自动切换模型');
export const DEEPSEEK_MODEL=policy.apiModel;
export const DEEPSEEK_MODEL_LABEL=policy.label;
export function islandWorkerEnvironment(base){return {...base,HD_NPC_MODEL:DEEPSEEK_MODEL,HD_STEWARD_MODEL:DEEPSEEK_MODEL}}
