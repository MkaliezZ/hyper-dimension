"""Split and verify Agent source ZIPs with only Python 3.11+ standard libraries."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile
import zipfile

CHUNK = 1024 * 1024
MAX_PART_BYTES = 1_000_000_000


class PartsError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def require(condition, code, message):
    if not condition:
        raise PartsError(code, message)


def safe_name(value):
    require(isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,199}", value),
            "invalid_name", "Artifact names must be plain portable basenames.")
    stem = value.split(".")[0].upper()
    require(stem not in {"CON", "PRN", "AUX", "NUL", *[f"COM{i}" for i in range(1, 10)],
                         *[f"LPT{i}" for i in range(1, 10)]}, "invalid_name", "Reserved artifact basename.")
    return value


def regular_file(path):
    require(not path.is_symlink() and path.is_file(), "missing_file", "Required regular file missing or not allowed: " + path.name)


def digest_file(path):
    regular_file(path)
    h = hashlib.sha256()
    size = 0
    with path.open("rb") as f:
        while chunk := f.read(CHUNK):
            h.update(chunk)
            size += len(chunk)
    return {"bytes": size, "sha256": h.hexdigest()}


def same_file(path, expected):
    return digest_file(path) == {k: expected[k] for k in ("bytes", "sha256")}


def publish_exclusive(temporary, target):
    # Windows rename refuses an existing target; POSIX link is also exclusive.
    # Both names are in one directory. Never replace a user's existing file.
    if os.name == "nt":
        os.rename(temporary, target)
    else:
        os.link(temporary, target)
        temporary.unlink()


def write_verified(target, writer):
    require(not target.is_symlink(), "output_conflict", "Refusing a symbolic-link output.")
    fd, name = tempfile.mkstemp(prefix=target.name + ".pending-", dir=target.parent)
    temporary = Path(name)
    try:
        with os.fdopen(fd, "wb") as f:
            expected = writer(f)
            f.flush()
            os.fsync(f.fileno())
        require(temporary.stat().st_size == expected["bytes"], "write_size", "Incomplete artifact write.")
        if target.exists():
            require(same_file(target, expected), "output_conflict", "Existing output differs; it was preserved.")
        else:
            try:
                publish_exclusive(temporary, target)
            except FileExistsError:
                require(same_file(target, expected), "output_conflict", "Another writer created a different output; it was preserved.")
        return expected
    finally:
        # This is only the uniquely named file created by this call, never input.
        temporary.unlink(missing_ok=True)


def valid_digest(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value) is not None


def load_manifest(path):
    regular_file(path)
    require(path.stat().st_size <= CHUNK, "invalid_manifest", "Parts manifest is too large.")
    d = json.loads(path.read_text(encoding="utf-8"))
    require(isinstance(d, dict) and set(d) == {"schema", "algorithm", "sourceCommit", "archive", "parts"},
            "invalid_manifest", "Unsupported parts manifest fields.")
    require(type(d["schema"]) is int and d["schema"] == 1 and d["algorithm"] == "sha256",
            "invalid_manifest", "Unsupported parts manifest format.")
    require(isinstance(d["sourceCommit"], str) and re.fullmatch(r"[0-9a-f]{40}", d["sourceCommit"]),
            "invalid_manifest", "A complete source commit is required.")
    a = d["archive"]
    require(isinstance(a, dict) and set(a) == {"name", "bytes", "sha256"}, "invalid_manifest", "Invalid archive record.")
    safe_name(a["name"])
    require(a["name"].lower().endswith(".zip") and type(a["bytes"]) is int and a["bytes"] > 0 and valid_digest(a["sha256"]),
            "invalid_manifest", "Invalid archive checksum or size.")
    require(isinstance(d["parts"], list) and 0 < len(d["parts"]) <= 999, "invalid_manifest", "Invalid part count.")
    for number, part in enumerate(d["parts"], 1):
        require(isinstance(part, dict) and set(part) == {"name", "bytes", "sha256"}, "invalid_manifest", "Invalid part record.")
        safe_name(part["name"])
        require(part["name"] == f'{a["name"]}.part{number:03}' and type(part["bytes"]) is int
                and 0 < part["bytes"] <= MAX_PART_BYTES and valid_digest(part["sha256"]),
                "invalid_manifest", "Parts must be ordered, bounded, unique and checksummed.")
    require(sum(p["bytes"] for p in d["parts"]) == a["bytes"], "invalid_manifest", "Part sizes do not match archive size.")
    return d


def split_archive(archive, directory, source_commit, part_bytes=MAX_PART_BYTES):
    archive, directory = Path(archive), Path(directory)
    regular_file(archive)
    name = safe_name(archive.name)
    require(len(name) <= 180, "invalid_name", "Archive basename is too long for portable part names.")
    require(name.lower().endswith(".zip") and zipfile.is_zipfile(archive), "invalid_archive", "Input must be a ZIP archive.")
    require(type(part_bytes) is int and 0 < part_bytes <= MAX_PART_BYTES, "invalid_part_size", "Part size must be between one byte and one billion bytes.")
    require(re.fullmatch(r"[0-9a-f]{40}", source_commit or ""), "invalid_commit", "A complete source commit is required.")
    before = archive.stat()
    expected = digest_file(archive)
    require((expected["bytes"] + part_bytes - 1) // part_bytes <= 999, "too_many_parts", "More than 999 parts requested.")
    directory.mkdir(parents=True, exist_ok=True)
    index = directory / "source-parts.json"
    if index.exists():
        previous = load_manifest(index)
        require(previous["sourceCommit"] == source_commit and previous["archive"] == {"name": name, **expected},
                "output_conflict", "Existing manifest belongs to another archive; it was preserved.")
    parts, streamed_hash = [], hashlib.sha256()
    with archive.open("rb") as f:
        remaining = expected["bytes"]
        while remaining:
            size = min(part_bytes, remaining)
            target = directory / f"{name}.part{len(parts) + 1:03}"

            def write_part(out):
                h, left = hashlib.sha256(), size
                while left:
                    chunk = f.read(min(CHUNK, left))
                    require(chunk, "source_changed", "Source archive ended unexpectedly.")
                    out.write(chunk)
                    h.update(chunk)
                    streamed_hash.update(chunk)
                    left -= len(chunk)
                return {"bytes": size, "sha256": h.hexdigest()}

            parts.append({"name": target.name, **write_verified(target, write_part)})
            remaining -= size
        require(not f.read(1), "source_changed", "Source archive grew while splitting.")
    require(streamed_hash.hexdigest() == expected["sha256"], "source_changed", "Source archive bytes changed while splitting.")
    after = archive.stat()
    require((before.st_ino, before.st_size, before.st_mtime_ns) == (after.st_ino, after.st_size, after.st_mtime_ns),
            "source_changed", "Source archive changed while splitting.")
    manifest = {"schema": 1, "algorithm": "sha256", "sourceCommit": source_commit,
                "archive": {"name": name, **expected}, "parts": parts}
    blob = (json.dumps(manifest, indent=2) + "\n").encode()
    write_verified(index, lambda out: (out.write(blob), {"bytes": len(blob), "sha256": hashlib.sha256(blob).hexdigest()})[1])
    load_manifest(index)
    return {"passed": True, "operation": "split", "manifest": str(index), "sourceCommit": source_commit,
            "archive": manifest["archive"], "parts": len(parts), "inputsPreserved": True}


def assemble_archive(manifest_path, output):
    manifest_path, output = Path(manifest_path), Path(output)
    d = load_manifest(manifest_path)
    # Verify all inputs before creating any output. Recheck during streaming too.
    for part in d["parts"]:
        require(same_file(manifest_path.parent / part["name"], part), "part_checksum", "Part checksum or size does not match: " + part["name"])
    if output.exists() or output.is_symlink():
        require(not output.is_symlink() and same_file(output, d["archive"]), "output_conflict", "Existing output differs; it was preserved.")
    else:
        output.parent.mkdir(parents=True, exist_ok=True)

        def write_archive(out):
            archive_hash, size = hashlib.sha256(), 0
            for part in d["parts"]:
                part_hash, part_size = hashlib.sha256(), 0
                with (manifest_path.parent / part["name"]).open("rb") as f:
                    while chunk := f.read(CHUNK):
                        out.write(chunk)
                        archive_hash.update(chunk)
                        part_hash.update(chunk)
                        part_size += len(chunk)
                require({"bytes": part_size, "sha256": part_hash.hexdigest()} == {k: part[k] for k in ("bytes", "sha256")},
                        "source_changed", "A part changed after validation.")
                size += part_size
            result = {"bytes": size, "sha256": archive_hash.hexdigest()}
            require(result == {k: d["archive"][k] for k in ("bytes", "sha256")}, "archive_checksum", "Combined archive checksum does not match.")
            return result

        write_verified(output, write_archive)
    return {"passed": True, "operation": "assemble", "archive": str(output), "sourceCommit": d["sourceCommit"],
            "bytes": d["archive"]["bytes"], "sha256": d["archive"]["sha256"], "inputsPreserved": True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="operation", required=True)
    split = commands.add_parser("split")
    split.add_argument("--archive", required=True)
    split.add_argument("--out-dir", required=True)
    split.add_argument("--source-commit", required=True)
    split.add_argument("--part-bytes", type=int, default=MAX_PART_BYTES)
    assemble = commands.add_parser("assemble")
    assemble.add_argument("--manifest", required=True)
    assemble.add_argument("--output", required=True)
    args = parser.parse_args()
    try:
        if args.operation == "split":
            result = split_archive(args.archive, args.out_dir, args.source_commit, args.part_bytes)
        else:
            result = assemble_archive(args.manifest, args.output)
        print(json.dumps(result))
        return 0
    except (PartsError, OSError, ValueError, KeyError, TypeError) as error:
        print(json.dumps({"passed": False, "error": {"code": getattr(error, "code", "io_or_format"), "message": str(error)}}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
