import {resolve} from 'node:path';
import {createDataBackup,verifyDataBackup,restoreDataBackup,recoverDataRestore} from '../server/dataBackup.mjs';
const args=process.argv.slice(2),command=args.shift(),values=new Map();for(const arg of args){const i=arg.indexOf('=');if(i<3||!arg.startsWith('--'))throw Error('参数格式为 --名称=路径');const key=arg.slice(2,i),value=arg.slice(i+1);if(!['data','out','backup','documents-root'].includes(key)||!value)throw Error('不支持的参数');if(values.has(key)&&key!=='documents-root')throw Error('参数重复');values.set(key,[...(values.get(key)||[]),value]);}
const value=key=>values.get(key)?.[0],directory=resolve(value('data')||resolve(import.meta.dirname,'../data'));
try{let result;
 if(command==='create'){if(!value('out'))throw Error('请指定 --out=备份目录');result=await createDataBackup({directory,output:resolve(value('out')),documentRoots:values.get('documents-root')||[]});}
 else if(command==='verify'){if(!value('backup'))throw Error('请指定 --backup=备份目录');const v=await verifyDataBackup(resolve(value('backup')));result={verified:true,id:v.manifest.id,files:v.manifest.files.length,components:v.components,warnings:v.manifest.warnings};}
 else if(command==='restore'){if(!value('backup'))throw Error('请指定 --backup=备份目录');result=await restoreDataBackup({directory,backup:resolve(value('backup'))});}
 else if(command==='recover')result=await recoverDataRestore({directory});
 else throw Error('用法：node tools/data-backup.mjs create --out=目录 | verify --backup=目录 | restore --backup=目录 [--data=目录] | recover [--data=目录]。外部成果文件用 --documents-root=允许目录，可重复。');
 console.log(JSON.stringify({ok:true,...result},null,2));
}catch(e){console.error(JSON.stringify({ok:false,code:e.code||'backup_command',message:e.message}));process.exitCode=1;}
