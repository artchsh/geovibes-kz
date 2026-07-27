// Optimizes the design-exported images in assets/images/ in place.
// Resizes to sensible display resolutions (~3x) and re-encodes PNG with quantization.
// Keeps filenames + PNG format (so the require() registry is unaffected) and preserves alpha.
// Usage: node scripts/optimize-images.mjs
import sharp from "sharp";
import { readdir, stat, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../assets/images"
);

// max longest-side (px) per file; anything not listed is left untouched
const MAX = {
  "logo-heart.png": 256,
  "onboarding-phone.png": 1200,
  "venue-operacionnaya.png": 1100,
  "place-cooperative.png": 900,
  "category-cocktails.png": 420,
  "category-burgers.png": 420,
  "category-disco.png": 420,
  "category-clothing.png": 420,
  "category-jewelry.png": 420,
  "pin.png": 128,
  "image-5.png": 128,
};

const kb = (n) => Math.round(n / 1024) + "KB";

const files = (await readdir(DIR)).filter((f) => f in MAX);
let before = 0;
let after = 0;

for (const f of files) {
  const p = path.join(DIR, f);
  const orig = (await stat(p)).size;
  before += orig;
  const buf = await sharp(p)
    .resize({
      width: MAX[f],
      height: MAX[f],
      fit: "inside",
      withoutEnlargement: true,
    })
    .png({ palette: true, quality: 72, effort: 9, compressionLevel: 9 })
    .toBuffer();
  await writeFile(p, buf); // buffer already carries the optimized PNG encoding
  const now = (await stat(p)).size;
  after += now;
  console.log(`${f.padEnd(28)} ${kb(orig).padStart(8)} -> ${kb(now)}`);
}

console.log(`\nTOTAL ${kb(before)} -> ${kb(after)} (${files.length} files)`);
