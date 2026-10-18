from pathlib import Path
import importlib.util
import io
import tarfile
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('mac_symbols', Path(__file__).resolve().parents[1] / 'tools/symbolicate-mac-samples.py')
symbols = importlib.util.module_from_spec(spec)
spec.loader.exec_module(symbols)
UUID = '4C4C44B4-5555-3144-A1EA-21B8F5C3F87A'


class MatchingSymbols(unittest.TestCase):
    def sample(self, directory, name, base=0x1000, uuid=UUID, version='152.0.7977.65'):
        file = directory / name
        file.write_text(f'+ 1 ChromeMain (in Google Chrome Framework) + 16 [0x{base+16:x}]\n'
                        f'0x{base:x} - 0x{base+4096:x} +com.google.Chrome.framework ({version} - 7977.65) <{uuid}> /fixture/framework\n')
        return file

    def test_aslr_bases_preserve_the_same_relative_offset(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            rows = symbols.inspect_samples([self.sample(root, 'a', 0x1000), self.sample(root, 'b', 0x4000)])
            self.assertEqual([r['offsets'] for r in rows], [['0x10'], ['0x10']])

    def test_mismatched_uuid_or_version_cannot_be_symbolicated_together(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            original = self.sample(root, 'a')
            for different in [self.sample(root, 'b', uuid='00000000-0000-0000-0000-000000000000'),
                              self.sample(root, 'c', version='153.0.1.1')]:
                with self.assertRaises(ValueError):
                    symbols.inspect_samples([original, different])

    def test_outside_image_addresses_are_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            file = self.sample(Path(d), 'a')
            file.write_text(file.read_text().replace('[0x1010]', '[0x9000]'))
            with self.assertRaises(ValueError):
                symbols.inspect_sample(file)

    def test_archive_uses_a_fixed_destination_and_never_extracts_other_paths(self):
        data = io.BytesIO()
        with tarfile.open(fileobj=data, mode='w:bz2') as archive:
            for name, body in [('../../foreign', b'bad'), ('symbols.dSYM/Contents/Resources/DWARF/Google Chrome Framework', b'debug data')]:
                row = tarfile.TarInfo(name);row.size = len(body);archive.addfile(row, io.BytesIO(body))
        data.seek(0)
        with tempfile.TemporaryDirectory() as d:
            target = Path(d) / 'fixed.dwarf'
            result = symbols.copy_framework(data, target, 2_000_000_000)
            self.assertEqual(target.read_bytes(), b'debug data')
            self.assertEqual(result['bytes'], 10)
            self.assertEqual([f.name for f in Path(d).iterdir()], ['fixed.dwarf'])

    def test_symbol_command_is_an_argument_array_with_the_exact_load_address(self):
        row = {'base': '0x1000', 'addresses': ['0x1010']}
        def execute(args, **kwargs):
            self.assertEqual(args, ['atos', '-o', 'a b.dwarf', '-arch', 'arm64', '-l', '0x1000', '0x1010'])
            self.assertEqual(kwargs['timeout'], 90)
            return 'gpu::example()\n'
        self.assertEqual(symbols.symbolicate(row, Path('a b.dwarf'), 'arm64', execute), {'0x1010': 'gpu::example()'})

    def test_unresolved_symbols_cannot_be_reported_as_completed(self):
        for result in ['ChromeMain + 16\n', '   \n', '0x1010\n']:
            with self.assertRaises(ValueError):
                symbols.symbolicate({'base': '0x1000', 'addresses': ['0x1010']}, Path('fixture'), 'arm64', lambda *a, **k: result)


if __name__ == '__main__':
    unittest.main()
