"""Reject incompatible offline bootstraps before creating a partial runtime."""
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase, main
from unittest.mock import patch
import runpy


class OfflineBootstrapPrerequisites(TestCase):
    def reject(self, version=(3, 11), system='win32', machine='AMD64', pointer_bytes=8, macos=''):
        with TemporaryDirectory() as temporary:
            root = Path(temporary)
            tools = root / 'tools'
            tools.mkdir()
            script = tools / 'agent-install.py'
            script.write_bytes((Path(__file__).resolve().parents[1] / 'tools/agent-install.py').read_bytes())
            # There is deliberately no vendor folder. Compatibility must be
            # checked before dependencies are opened or any runtime is written.
            data = root / 'data'
            data.mkdir()
            sentinel = data / 'existing-save.json'
            sentinel.write_text('{"progress":"preserve"}', encoding='utf8')
            with patch('sys.argv', [str(script), '--offline']), patch('sys.version_info', version), patch('sys.platform', system), patch('platform.machine', return_value=machine), patch('platform.mac_ver', return_value=(macos, ('', '', ''), machine)), patch('struct.calcsize', return_value=pointer_bytes):
                with self.assertRaisesRegex(RuntimeError, 'Offline installation requires CPython 3.11'):
                    runpy.run_path(str(script), run_name='__main__')
            self.assertFalse((root / '.runtime').exists())
            self.assertEqual(sentinel.read_text(encoding='utf8'), '{"progress":"preserve"}')
            self.assertEqual({p.name for p in root.iterdir()}, {'tools', 'data'})

    def test_other_python_abis_leave_runtime_and_existing_data_untouched(self):
        for version in [(3, 12), (3, 13)]:
            with self.subTest(version=version):
                self.reject(version=version)

    def test_unsupported_binary_targets_fail_before_opening_vendor_files(self):
        for options in [dict(pointer_bytes=4), dict(system='linux', machine='x86_64'), dict(machine='ARM64'), dict(system='darwin', machine='arm64', macos='13.6')]:
            with self.subTest(options=options):
                self.reject(**options)


if __name__ == '__main__':
    main()
