"""Filesystem integrity tests, not a physical Windows/macOS deployment claim."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import zipfile

TOOL = Path(__file__).resolve().parents[1] / "tools/source-parts.py"
spec = importlib.util.spec_from_file_location("source_parts", TOOL)
parts = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parts)


class SourcePartsTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="Hyper Dimension source parts ")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.archive = self.root / "Hyper-Dimension-Test.zip"
        with zipfile.ZipFile(self.archive, "x", zipfile.ZIP_STORED) as z:
            z.writestr("Hyper-Dimension/AGENTS.md", "Fictional deployment fixture only.\n")
            z.writestr("Hyper-Dimension/art.bin", bytes(range(256)) * 80)
        self.source = self.archive.read_bytes()
        self.release = self.root / "release with spaces"
        self.commit = "a" * 40

    def split(self):
        result = parts.split_archive(self.archive, self.release, self.commit, 8192)
        self.assertTrue(result["passed"])
        self.assertEqual(result["parts"], 3)
        self.manifest = self.release / "source-parts.json"
        return parts.load_manifest(self.manifest)

    def test_round_trip_repeated_split_and_existing_identical_output(self):
        d = self.split()
        original_manifest = self.manifest.read_bytes()
        original_parts = {r["name"]: (self.release / r["name"]).read_bytes() for r in d["parts"]}
        self.split()
        self.assertEqual(self.manifest.read_bytes(), original_manifest)
        output = self.root / "new output" / self.archive.name
        result = parts.assemble_archive(self.manifest, output)
        self.assertEqual(result["sha256"], parts.digest_file(self.archive)["sha256"])
        self.assertEqual(output.read_bytes(), self.source)
        self.assertTrue(parts.assemble_archive(self.manifest, output)["passed"])
        self.assertEqual(self.archive.read_bytes(), self.source)
        self.assertTrue(all((self.release / n).read_bytes() == b for n, b in original_parts.items()))
        self.assertEqual(list(self.release.glob("*.pending-*")), [])

    def test_missing_part_cannot_publish_output(self):
        d = self.split()
        (self.release / d["parts"][1]["name"]).unlink()
        output = self.root / "result.zip"
        with self.assertRaises(parts.PartsError):
            parts.assemble_archive(self.manifest, output)
        self.assertFalse(output.exists())

    def test_corrupt_part_is_preserved_and_cannot_publish(self):
        d = self.split()
        bad = self.release / d["parts"][0]["name"]
        content = bytearray(bad.read_bytes())
        content[123] ^= 1
        bad.write_bytes(content)
        with self.assertRaises(parts.PartsError):
            parts.assemble_archive(self.manifest, self.root / "result.zip")
        self.assertEqual(bad.read_bytes(), content)
        with self.assertRaises(parts.PartsError):
            self.split()
        self.assertEqual(bad.read_bytes(), content)
        self.assertEqual(self.archive.read_bytes(), self.source)

    def test_combined_checksum_rejects_valid_parts_from_wrong_manifest(self):
        d = self.split()
        d["archive"]["sha256"] = "0" * 64
        self.manifest.write_text(json.dumps(d), encoding="utf-8")
        output = self.root / "result.zip"
        with self.assertRaises(parts.PartsError) as caught:
            parts.assemble_archive(self.manifest, output)
        self.assertEqual(caught.exception.code, "archive_checksum")
        self.assertFalse(output.exists())
        self.assertEqual(list(self.root.glob("*.pending-*")), [])

    def test_existing_different_output_and_manifest_are_never_overwritten(self):
        self.split()
        output = self.root / "result.zip"
        output.write_bytes(b"existing user file")
        with self.assertRaises(parts.PartsError):
            parts.assemble_archive(self.manifest, output)
        self.assertEqual(output.read_bytes(), b"existing user file")
        original_manifest = self.manifest.read_bytes()
        with self.assertRaises(parts.PartsError):
            parts.split_archive(self.archive, self.release, "b" * 40, 8192)
        self.assertEqual(self.manifest.read_bytes(), original_manifest)

    def test_portable_names_order_and_traversal_are_rejected(self):
        d = self.split()
        for name in ["../outside", "sub/part", "sub\\part", "C:part", "CON.zip", ".hidden"]:
            with self.subTest(name=name), self.assertRaises(parts.PartsError):
                parts.safe_name(name)
        d["parts"].reverse()
        self.manifest.write_text(json.dumps(d), encoding="utf-8")
        with self.assertRaises(parts.PartsError):
            parts.assemble_archive(self.manifest, self.root / "result.zip")
        self.assertFalse((self.root / "result.zip").exists())

    def test_output_created_during_publication_is_not_overwritten(self):
        self.split()
        output = self.root / "result.zip"
        original = parts.publish_exclusive

        def race(temporary, target):
            target.write_bytes(b"another writer's file")
            return original(temporary, target)

        with patch.object(parts, "publish_exclusive", race), self.assertRaises(parts.PartsError):
            parts.assemble_archive(self.manifest, output)
        self.assertEqual(output.read_bytes(), b"another writer's file")

    def test_cli_uses_portable_paths_and_structured_results(self):
        env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
        result = subprocess.run([sys.executable, str(TOOL), "split", "--archive", str(self.archive),
                                 "--out-dir", str(self.release), "--source-commit", self.commit,
                                 "--part-bytes", "8192"], capture_output=True, env=env, check=True)
        self.assertTrue(json.loads(result.stdout)["passed"])
        output = self.root / "CLI output with spaces.zip"
        command = [sys.executable, str(TOOL), "assemble", "--manifest", str(self.release / "source-parts.json"), "--output", str(output)]
        result = subprocess.run(command, capture_output=True, env=env, check=True)
        self.assertTrue(json.loads(result.stdout)["passed"])
        self.assertEqual(output.read_bytes(), self.source)
        output.write_bytes(b"keep this existing file")
        result = subprocess.run(command, capture_output=True, env=env)
        self.assertEqual(result.returncode, 1)
        self.assertFalse(json.loads(result.stderr)["passed"])
        self.assertEqual(output.read_bytes(), b"keep this existing file")

    def test_posix_publication_path_is_exclusive(self):
        temporary, target = self.root / "temporary", self.root / "published"
        temporary.write_bytes(b"verified source bytes")
        # Exercise POSIX publication semantics over this host's filesystem.
        # This does not claim a physical macOS deployment.
        with patch.object(parts, "os", SimpleNamespace(name="posix", link=os.link)):
            parts.publish_exclusive(temporary, target)
            self.assertFalse(temporary.exists())
            self.assertEqual(target.read_bytes(), b"verified source bytes")
            temporary.write_bytes(b"different bytes")
            with self.assertRaises(FileExistsError):
                parts.publish_exclusive(temporary, target)
            self.assertEqual(target.read_bytes(), b"verified source bytes")


if __name__ == "__main__":
    unittest.main()
