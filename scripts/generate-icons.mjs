import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'icons', 'icon.svg');
const TARGET_SIZES = [180, 192, 512];

const svg = await readFile(SOURCE, 'utf8');

for (const size of TARGET_SIZES) {
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });

  const png = resvg.render().asPng();
  const target = path.join(ROOT, 'icons', `icon-${size}.png`);
  await writeFile(target, png);
}

console.log(`Generated ${TARGET_SIZES.length} icon PNGs from ${path.relative(ROOT, SOURCE)}.`);
