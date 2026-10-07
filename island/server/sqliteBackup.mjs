import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,copyFile,unlink,rmdir} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
const fail=(message,code='backup_sqlite')=>Object.assign(Error(message),{code});
function inspect(db){
 if(db.prepare('PRAGMA quick_check').all().some(r=>Object.values(r)[0]!=='ok'))throw fail('会话数据库完整性校验失败，原数据保留');
 if(db.prepare('PRAGMA foreign_key_check').all().length)throw fail('会话数据库存在失效关联，原数据保留');
 const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
 if(!tables.has('sessions')||!tables.has('messages'))return {canonical:false};
 if(db.prepare('SELECT m.id FROM messages m LEFT JOIN sessions s ON s.id=m.session_id WHERE s.id IS NULL LIMIT 1').get())throw fail('会话消息缺少所属会话');
 if(db.prepare('SELECT s.id FROM sessions s LEFT JOIN sessions p ON p.id=s.parent_session_id WHERE s.parent_session_id IS NOT NULL AND p.id IS NULL LIMIT 1').get())throw fail('会话缺少父运行');
 for(const table of ['hd_session_scopes','hd_session_runs'])if(tables.has(table)&&db.prepare('SELECT x.session_id FROM '+table+' x LEFT JOIN sessions s ON s.id=x.session_id WHERE s.id IS NULL LIMIT 1').get())throw fail('小岛会话索引缺少原生会话');
 return {canonical:true,sessions:db.prepare('SELECT COUNT(*) AS n FROM sessions').get().n,messages:db.prepare('SELECT COUNT(*) AS n FROM messages').get().n,tools:db.prepare("SELECT COUNT(*) AS n FROM messages WHERE role='tool'").get().n};
}
export async function inspectSqliteBackup(file){
 // Read a disposable copy: opening a WAL database can touch its shared-memory file.
 const scratch=await mkdtemp(join(dirname(resolve(file)),'.hd-sqlite-check-'));
 const target=join(scratch,'state.db');let db;
 try{
  await copyFile(file,target);for(const suffix of ['-wal','-shm']){try{await copyFile(file+suffix,target+suffix)}catch(e){if(e.code!=='ENOENT')throw e;}}
  db=new DatabaseSync(target,{readOnly:true});return inspect(db);
 }catch(e){throw e.code?.startsWith('backup_')?e:fail('会话数据库无法核对，未修改原文件');}
 finally{db?.close();for(const suffix of ['', '-wal','-shm','-journal'])await unlink(target+suffix).catch(e=>{if(e.code!=='ENOENT')throw e;});await rmdir(scratch);}
}
export function relocateSqliteBackup(file,mapPath){
 const db=new DatabaseSync(file);let changed=0;
 try{
  const status=inspect(db);if(!status.canonical)return 0;
  const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name));
  db.exec('BEGIN IMMEDIATE');
  for(const row of db.prepare('SELECT id,cwd FROM sessions WHERE cwd IS NOT NULL').all()){const next=mapPath(row.cwd);if(next!==row.cwd){db.prepare('UPDATE sessions SET cwd=? WHERE id=?').run(next,row.id);changed++;}}
  if(tables.has('hd_session_scopes'))for(const row of db.prepare('SELECT session_id,workdir FROM hd_session_scopes').all()){const next=mapPath(row.workdir);if(next!==row.workdir){db.prepare('UPDATE hd_session_scopes SET workdir=? WHERE session_id=?').run(next,row.session_id);changed++;}}
  db.exec('COMMIT');db.exec('PRAGMA wal_checkpoint(TRUNCATE)');inspect(db);return changed;
 }catch(e){try{db.exec('ROLLBACK')}catch{}throw e.code?.startsWith('backup_')?e:fail('恢复后的会话工作区无法核对');}
 finally{db.close();}
}
