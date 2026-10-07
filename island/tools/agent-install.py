"""Agent source deployment: recreate the runtime on the target OS; no provider calls."""
import json,sys,os,zipfile,stat,hashlib,subprocess,time
from pathlib import Path,PurePosixPath
root=Path(__file__).resolve().parents[1];runtime=root/'.runtime';vendor=root/'vendor'
offline='--offline' in sys.argv;verify_only='--verify-only' in sys.argv
if not (3,11)<=sys.version_info[:2]<(3,14):raise RuntimeError('Use Python 3.11-3.13')
python=runtime/'python'/('Scripts/python.exe' if os.name=='nt' else 'bin/python')
hermes=runtime/'hermes-agent';metadata=json.loads((vendor/'python-wheels.json').read_text(encoding='utf-8'))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def safe_dir(p):
    resolved=p.resolve()
    if runtime.resolve() not in resolved.parents:raise RuntimeError('Runtime escapes package')
    for q in (p,*p.parents):
        if q==root.parent:break
        if q.exists() and (q.is_symlink() or getattr(q.lstat(),'st_file_attributes',0)&getattr(stat,'FILE_ATTRIBUTE_REPARSE_POINT',0)):raise RuntimeError('Linked runtime directory')
    return resolved
def run(exe,args):subprocess.run([str(exe),*args],cwd=root,check=True)
archive=vendor/'hermes-agent.zip'
if digest(archive)!=metadata['hermes']['sha256']:raise RuntimeError('Hermes source changed')
if not verify_only:
    runtime.mkdir(exist_ok=True);safe_dir(hermes);safe_dir(runtime/'python')
    marker=runtime/'hermes-install.json'
    if hermes.exists():
        old=json.loads(marker.read_text(encoding='utf-8'))
        if old.get('sha256')!=metadata['hermes']['sha256']:raise RuntimeError('Existing Hermes differs; preserve it and choose a new source directory')
    else:
        staging=safe_dir(runtime/('hermes-stage-'+str(time.time_ns())));staging.mkdir()
        with zipfile.ZipFile(archive) as z:
            for info in z.infolist():
                s=info.filename;p=PurePosixPath(s)
                if p.is_absolute() or '..' in p.parts or '\\' in s or ':' in s or '.env' in p.parts or stat.S_ISLNK(info.external_attr>>16):raise RuntimeError('Unsafe Hermes archive')
                target=staging.joinpath(*p.parts);target.parent.mkdir(parents=True,exist_ok=True)
                if info.is_dir():target.mkdir(exist_ok=True)
                else:target.write_bytes(z.read(info))
        os.replace(staging,hermes);marker.write_text(json.dumps({'sha256':metadata['hermes']['sha256'],'commit':metadata['hermes']['commit']}),encoding='utf-8')
    if (runtime/'python').exists():
        if not python.exists():raise RuntimeError('Incomplete existing environment; preserve it and use a clean directory')
        result=json.loads(subprocess.check_output([str(python),'-c','import sys,json;print(json.dumps({"prefix":sys.prefix,"version":list(sys.version_info[:2])}))'],text=True))
        if Path(result['prefix']).resolve()!=(runtime/'python').resolve() or result['version']!=list(sys.version_info[:2]):raise RuntimeError('Existing environment differs; preserve it and use a clean directory')
    else:run(sys.executable,['-m','venv',str(runtime/'python')])
    args=['-m','pip','install','--require-hashes','--only-binary=:all:','--disable-pip-version-check','-r',str(vendor/'requirements-agent.lock'),'--find-links',str(vendor/'wheels')]
    if offline:args+=['--no-index']
    run(python,args)
if not python.exists() or not hermes.exists():raise RuntimeError('Runtime missing')
with zipfile.ZipFile(archive) as z:
    for info in z.infolist():
        if info.is_dir():continue
        target=hermes.joinpath(*PurePosixPath(info.filename).parts)
        if not target.is_file() or digest(target)!=hashlib.sha256(z.read(info)).hexdigest():raise RuntimeError('Installed Hermes source changed')
run(python,['-m','pip','check'])
code='import sys,json,importlib.metadata as m;sys.path.insert(0,'+repr(str(hermes))+');from run_agent import AIAgent;from hermes_state import SessionDB;import docx,openpyxl,pypdf;print(json.dumps({"nativeImports":True,"python":sys.version.split()[0],"hermes":"0.19.1","documents":[m.version(x) for x in ["python-docx","openpyxl","pypdf"]]}))'
check_env={**os.environ,'HERMES_HOME':str(runtime/'install-check-hermes'),'TERMINAL_CWD':str(root),'DEEPSEEK_API_KEY':'','OPENAI_API_KEY':''}
proof=json.loads(subprocess.check_output([str(python),'-c',code],text=True,env=check_env))
if not verify_only:(runtime/'installed-python.json').write_text(json.dumps(proof,indent=2),encoding='utf-8')
print(json.dumps({'runtimeReady':True,'platform':sys.platform,'offline':offline,'modelsCalled':False,**proof}))
