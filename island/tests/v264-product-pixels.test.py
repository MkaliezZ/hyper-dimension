import importlib.util
import math
from pathlib import Path
import random
import tempfile
import unittest

from PIL import Image

spec = importlib.util.spec_from_file_location('product_pixels', Path(__file__).resolve().parents[1] / 'tools/verify-product-renders.py')
pixels = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pixels)


def original_loop(image, ox, oy):
    foreground, outside = 0, 0
    for y in range(image.height):
        for x in range(image.width):
            rgb = image.getpixel((x, y))
            difference = max(abs(rgb[i] - pixels.BACKGROUND[i]) for i in range(3))
            foreground += difference > 8
            if x < math.floor(ox) - 1 or x > math.ceil(image.width - ox) + 1 or y < math.floor(oy) - 1 or y > math.ceil(image.height - oy) + 1:
                outside = max(outside, difference)
    return foreground, outside


class PixelCheckTests(unittest.TestCase):
    def test_every_pixel_and_fractional_letterbox_bounds_match_original(self):
        rng = random.Random(264)
        margins = [-2, 0, .01, 1, 1.99, 2, 7.5, 19.01, 40]
        for index in range(72):
            width, height = rng.randint(25, 45), rng.randint(25, 45)
            image = Image.new('RGB', (width, height))
            image.putdata([tuple(rng.choice([0, 3, 4, 8, 9, 100, 219, 242, 248, 255]) for _ in range(3)) for _ in range(width * height)])
            ox, oy = margins[index % len(margins)], margins[(index // len(margins)) % len(margins)]
            with self.subTest(index=index, ox=ox, oy=oy):
                self.assertEqual(pixels.measure_rgb(image, ox, oy), original_loop(image, ox, oy))

    def test_original_foreground_letterbox_and_neighbor_thresholds_remain_strict(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'render.png'
            row = dict(theme='pixel', id='fictional', svgScreenshot=str(file), ox=4, oy=4,
                       probes=[dict(x=0, y=0, pixelX=0, pixelY=0)])
            image = Image.new('RGB', (40, 40), pixels.BACKGROUND)
            for y in range(5, 30):
                for x in range(5, 30):
                    image.putpixel((x, y), (239, 242, 219))
            image.putpixel((0, 0), (245, 242, 219))
            image.save(file)
            self.assertEqual(pixels.verify_render(row)['foregroundPixels'], 625)
            image.putpixel((0, 0), (244, 242, 219));image.save(file)
            with self.assertRaisesRegex(AssertionError, 'letterbox leak'):
                pixels.verify_render(row)
            image.putpixel((0, 0), pixels.BACKGROUND);image.putpixel((10, 10), (244, 242, 219));image.save(file)
            row['probes'][0].update(pixelX=10, pixelY=10)
            with self.assertRaisesRegex(AssertionError, 'SVG neighbor'):
                pixels.verify_render(row)
            image = Image.new('RGB', (40, 40), pixels.BACKGROUND)
            for index in range(500):image.putpixel((index % 25 + 5, index // 25 + 5), (239, 242, 219))
            image.save(file)
            with self.assertRaisesRegex(AssertionError, 'blank SVG'):
                pixels.verify_render(row)


if __name__ == '__main__':
    unittest.main()
