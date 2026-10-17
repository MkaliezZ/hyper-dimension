"""Check every rendered pixel using Pillow's C operations, with original thresholds."""
import json
import math
from pathlib import Path
import shutil
import sys

from PIL import Image, ImageChops

BACKGROUND = (248, 242, 219)


def measure_rgb(image, ox, oy):
    """Equivalent to the former per-pixel foreground and letterbox loops."""
    difference = ImageChops.difference(image, Image.new('RGB', image.size, BACKGROUND))
    red, green, blue = difference.split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    foreground = sum(maximum.histogram()[9:])  # Original difference > 8.
    width, height = image.size
    clamp = lambda value, limit: max(0, min(limit, value))
    # x < floor(ox)-1 or x > ceil(width-ox)+1; same for y.
    # Pillow crop bounds are exclusive, hence +2 for the right/bottom start.
    left = clamp(math.floor(ox) - 1, width)
    right = clamp(math.ceil(width - ox) + 2, width)
    top = clamp(math.floor(oy) - 1, height)
    bottom = clamp(math.ceil(height - oy) + 2, height)
    rectangles = [(0, 0, left, height), (right, 0, width, height),
                  (0, 0, width, top), (0, bottom, width, height)]
    outside = max((maximum.crop(box).getextrema()[1] for box in rectangles
                   if box[0] < box[2] and box[1] < box[3]), default=0)
    return foreground, outside


def verify_render(row):
    with Image.open(row['svgScreenshot']) as source:
        image = source.convert('RGB')
    foreground, outside = measure_rgb(image, row['ox'], row['oy'])
    assert foreground > 500, (row['theme'], row['id'], 'blank SVG')
    assert outside <= 3, (row['theme'], row['id'], 'letterbox leak', outside)
    probes = []
    for probe in row['probes']:
        rgb = image.getpixel((probe['pixelX'], probe['pixelY']))
        difference = max(abs(rgb[i] - BACKGROUND[i]) for i in range(3))
        assert difference <= 3, (probe, 'SVG neighbor', difference)
        probes.append({'sourceX': probe['x'], 'sourceY': probe['y'], 'difference': difference})
    return {'theme': row['theme'], 'id': row['id'], 'foregroundPixels': foreground,
            'letterboxMaxDifference': outside, 'knownForeignProbes': probes}


def main(input_path, output_path):
    rows = json.loads(Path(input_path).read_text(encoding='utf-8'))
    output = Path(output_path)
    checks = []
    for row in rows:
        try:
            checks.append(verify_render(row))
        except Exception as error:
            # Keep the precise failing product and screenshot in the existing artifact.
            retained = output.with_name('failure-product-svg.png')
            if Path(row['svgScreenshot']).is_file():
                shutil.copyfile(row['svgScreenshot'], retained)
            output.write_text(json.dumps({'passed': False, 'count': len(checks), 'checks': checks,
                              'failure': {'theme': row['theme'], 'id': row['id'], 'error': str(error),
                                          'screenshot': retained.name}}, indent=2), encoding='utf-8')
            raise
    output.write_text(json.dumps({'passed': True, 'count': len(checks), 'checks': checks}, indent=2), encoding='utf-8')
    print('Native SVG and canvas product checks passed:', len(checks))


if __name__ == '__main__':
    main(*sys.argv[1:])
