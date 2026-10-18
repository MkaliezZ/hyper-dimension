"""Symbolicate owned Chrome samples with matching official dSYMs; diagnosis only."""
from pathlib import Path
import argparse
import hashlib
import json
import platform
import re
import shutil
import subprocess
import tarfile
import urllib.request

FRAMEWORK = re.compile(r'^\s*(0x[0-9a-fA-F]+)\s*-\s*(0x[0-9a-fA-F]+).*?com\.google\.Chrome\.framework\s*\((\d+\.\d+\.\d+\.\d+)[^)]*\)\s*<([0-9a-fA-F-]{36})>', re.M)
ADDRESS = re.compile(r'\(in Google Chrome Framework\).*?\[(0x[0-9a-fA-F]+)\]')
MAX_ARCHIVE = 4_000_000_000
MAX_DWARF = 20_000_000_000
SOURCE = 'https://chromium.googlesource.com/chromium/src/+/main/tools/mac/download_symbols.py'


def inspect_sample(file):
    text = file.read_text(encoding='utf-8', errors='replace')
    images = FRAMEWORK.findall(text)
    if len(images) != 1:
        raise ValueError('Expected exactly one Chrome framework image in ' + file.name)
    base, end, version, uuid = images[0]
    addresses = list(dict.fromkeys(ADDRESS.findall(text)))
    if not addresses or not all(int(base, 16) <= int(a, 16) <= int(end, 16) for a in addresses):
        raise ValueError('Framework addresses are missing or outside their image')
    return {'file': str(file), 'version': version, 'uuid': uuid.upper(), 'base': base,
            'addresses': addresses, 'offsets': [hex(int(a, 16) - int(base, 16)) for a in addresses]}


def inspect_samples(files):
    rows = [inspect_sample(f) for f in files]
    if not rows or len({(r['version'], r['uuid']) for r in rows}) != 1:
        raise ValueError('Samples must have one matching Chrome version and framework UUID')
    return rows


def copy_framework(stream, target, free_bytes):
    """Read one member without trusting archive paths, links or executable files."""
    with tarfile.open(fileobj=stream, mode='r|bz2') as archive:
        for member in archive:
            if not member.name.endswith('.dSYM/Contents/Resources/DWARF/Google Chrome Framework'):
                continue
            if not member.isfile() or not 0 < member.size <= MAX_DWARF:
                raise ValueError('Invalid framework symbol member')
            if free_bytes < member.size + 1_000_000_000:
                raise ValueError('Insufficient free disk space for matching symbols')
            if target.exists():
                raise ValueError('Preserve existing symbol output; use a fresh directory')
            digest, copied = hashlib.sha256(), 0
            with archive.extractfile(member) as source, target.open('xb') as output:
                while chunk := source.read(1024 * 1024):
                    output.write(chunk)
                    digest.update(chunk)
                    copied += len(chunk)
            if copied != member.size:
                raise ValueError('Incomplete framework symbol member')
            return {'bytes': copied, 'sha256': digest.hexdigest(), 'member': member.name}
    raise ValueError('Archive did not contain the Chrome framework dSYM')


def symbolicate(row, dwarf, arch, execute=subprocess.check_output):
    args = ['atos', '-o', str(dwarf), '-arch', arch, '-l', row['base'], *row['addresses']]
    lines = execute(args, text=True, timeout=90).splitlines()
    if len(lines) != len(row['addresses']):
        raise ValueError('Symbol count does not match sampled addresses')
    if not any(line.strip() and not re.match(r'^(?:0x|ChromeMain\b|\?\?\?)', line.strip()) for line in lines):
        raise ValueError('Matching symbols did not resolve any framework functions')
    return dict(zip(row['addresses'], lines))


def run(args):
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    report = {'diagnosticOnly': True, 'productAcceptance': False, 'symbolicationComplete': False,
              'officialURLTemplateSource': SOURCE, 'wholeArchiveDigestVerified': False}
    try:
        files = sorted(args.input.resolve().rglob('owned-browser-*.sample.txt'))
        rows = inspect_samples(files)
        report['samples'] = rows
        if args.inspect_only:
            report['metadataParsed'] = True
            return report
        if platform.system() != 'Darwin' or args.arch not in ['arm64', 'x86_64']:
            raise ValueError('Actual symbolication requires macOS and an explicit supported architecture')
        version = rows[0]['version']
        url = f'https://dl.google.com/chrome/mac/stable/dsym/googlechrome-{version}-{args.arch}-dsym.tar.bz2'
        report['symbolURL'] = url
        dwarf = output.parent / 'chrome-framework.dwarf'
        with urllib.request.urlopen(url, timeout=90) as response:
            length = int(response.headers.get('Content-Length', '0'))
            if response.status != 200 or not 0 < length <= MAX_ARCHIVE:
                raise ValueError('Invalid or oversized official symbol response')
            report['selectedSymbolMember'] = copy_framework(response, dwarf, shutil.disk_usage(output).free)
        uuids = subprocess.check_output(['dwarfdump', '--uuid', str(dwarf)], text=True, timeout=60)
        matches = re.findall(r'UUID:\s*([0-9A-F-]{36})\s*\(([^)]+)\)', uuids.upper())
        if (rows[0]['uuid'], args.arch.upper()) not in matches:
            raise ValueError('Downloaded symbols do not match the sampled framework UUID and architecture')
        for row in rows:
            resolved = symbolicate(row, dwarf, args.arch)
            text = Path(row['file']).read_text(encoding='utf-8', errors='replace')
            annotated = ADDRESS.sub(lambda m: m.group(0) + ' => ' + resolved[m[1]], text)
            (output / (Path(row['file']).stem + '.symbolicated.txt')).write_text(annotated, encoding='utf-8')
        report['symbolicationComplete'] = True
        return report
    except Exception as error:
        report['error'] = str(error)
        raise
    finally:
        (output / 'report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--arch', choices=['arm64', 'x86_64'], default='arm64')
    parser.add_argument('--inspect-only', action='store_true')
    args = parser.parse_args()
    try:
        report = run(args)
        print(json.dumps({'diagnosticOnly': True, 'symbolicationComplete': report['symbolicationComplete'],
                          'sampleCount': len(report['samples'])}))
    except Exception as error:
        print(json.dumps({'diagnosticOnly': True, 'symbolicationComplete': False, 'error': str(error)}))
        raise SystemExit(1)


if __name__ == '__main__':
    main()
