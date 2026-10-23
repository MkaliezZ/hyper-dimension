"""Maintainer release helper. Explicit allowlist excludes data and credentials."""
import argparse
from pathlib import Path
import zipfile

repo = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('output', type=Path)
args = parser.parse_args()
args.output.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.output, 'w', zipfile.ZIP_DEFLATED) as archive:
    for directory, target in [(repo/'src/base', 'src/base'), (repo/'base-starter', '')]:
        for file in directory.rglob('*'):
            relative = file.relative_to(directory)
            if directory.name == 'base-starter' and relative.parts[0] not in {'README.md', 'AGENTS.md', '00-学员使用说明.txt', '.gitignore', 'requirements.lock', 'requirements-mcp.lock', 'scripts', 'docs', 'examples'}:
                continue
            if any(part in {'data', '.venv', '.git', '.pytest_cache', '__pycache__'} for part in relative.parts):
                continue
            if not file.is_file() or '__pycache__' in file.parts or file.suffix == '.bak' or file.name == 'build_distribution.py':
                continue
            archive.write(file, str(Path(target)/file.relative_to(directory)))
    archive.write(repo/'LICENSE', 'LICENSE')
    archive.write(repo/'tests/test_base.py', 'tests/test_base.py')
    archive.write(repo/'tests/test_base_teaching.py', 'tests/test_base_teaching.py')
print(args.output)
