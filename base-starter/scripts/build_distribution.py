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
            if not file.is_file() or '__pycache__' in file.parts or file.name == 'build_distribution.py':
                continue
            archive.write(file, str(Path(target)/file.relative_to(directory)))
    archive.write(repo/'LICENSE', 'LICENSE')
    archive.write(repo/'tests/test_base.py', 'tests/test_base.py')
print(args.output)
