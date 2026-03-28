/**
 * Records a demo GIF for the README.
 * Usage: node scripts/record-demo.js
 * Output: docs/demo.gif
 *
 * Requires: npx playwright, ffmpeg
 * Server must be running on http://localhost:8081
 *
 * Captures only the LFO panel (header + 3 widgets), excluding the
 * modulation matrix, live preview box, and target sliders below.
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { mkdirSync } from 'fs';

const WIDTH = 900;
const VIDEO_DIR = '/tmp/lfocomp-recording';

mkdirSync(VIDEO_DIR, { recursive: true });
mkdirSync('docs', { recursive: true });

// ── Pass 1: measure the LFO panel height at target width ──────────────────
const probe = await chromium.launch({ headless: true });
const probePage = await probe.newPage();
await probePage.setViewportSize({ width: WIDTH, height: 900 });
await probePage.goto('http://localhost:8081/demo.html', { waitUntil: 'networkidle' });
await probePage.waitForSelector('.lfo-connect-handle', { timeout: 10000 });

const cropHeight = await probePage.evaluate(() => {
  const section = document.querySelector('#lfo-container').closest('div');
  const rect = section.getBoundingClientRect();
  // bottom of the LFO section + a little breathing room
  return Math.ceil(rect.bottom) + 24;
});

await probe.close();

const HEIGHT = cropHeight;
console.log(`Capturing ${WIDTH}×${HEIGHT} (LFO panel only)`);

// ── Pass 2: record at the measured height ────────────────────────────────
const browser = await chromium.launch({ headless: true });

const ctx = await browser.newContext({
  viewport: { width: WIDTH, height: HEIGHT },
  recordVideo: {
    dir: VIDEO_DIR,
    size: { width: WIDTH, height: HEIGHT },
  },
});

const page = await ctx.newPage();

await page.goto('http://localhost:8081/demo.html', { waitUntil: 'networkidle' });
await page.waitForSelector('.lfo-connect-handle', { timeout: 10000 });

// Let LFOs breathe for a moment
await page.waitForTimeout(1500);

// ── Drag LFO 1's assign handle onto the Size slider ───────────────────────
const handle = page.locator('.lfo-connect-handle').first();
const sizeSlider = page.locator('#ctrl-size');

const handleBox = await handle.boundingBox();
const sliderBox = await sizeSlider.boundingBox();

const startX = handleBox.x + handleBox.width  / 2;
const startY = handleBox.y + handleBox.height / 2;
const endX   = sliderBox.x + sliderBox.width  / 2;
const endY   = sliderBox.y + sliderBox.height / 2;

// Slow drag so it's visible
await page.mouse.move(startX, startY);
await page.mouse.down();
for (let i = 1; i <= 30; i++) {
  await page.mouse.move(
    startX + (endX - startX) * (i / 30),
    startY + (endY - startY) * (i / 30),
  );
  await page.waitForTimeout(20);
}
await page.mouse.up();

// Watch modulation running
await page.waitForTimeout(3000);

// ── Drag LFO 2 onto Rotation slider ───────────────────────────────────────
const handle2   = page.locator('.lfo-connect-handle').nth(1);
const rotSlider = page.locator('#ctrl-rotation');

const h2Box  = await handle2.boundingBox();
const rotBox = await rotSlider.boundingBox();

await page.mouse.move(h2Box.x + h2Box.width / 2, h2Box.y + h2Box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 30; i++) {
  await page.mouse.move(
    h2Box.x + h2Box.width / 2 + (rotBox.x + rotBox.width / 2 - h2Box.x - h2Box.width / 2) * (i / 30),
    h2Box.y + h2Box.height / 2 + (rotBox.y + rotBox.height / 2 - h2Box.y - h2Box.height / 2) * (i / 30),
  );
  await page.waitForTimeout(20);
}
await page.mouse.up();

// Watch both modulations
await page.waitForTimeout(3500);

const videoPath = await page.video().path();
await ctx.close();
await browser.close();
console.log('Video:', videoPath);

// ── Convert to GIF via ffmpeg ──────────────────────────────────────────────
execSync(
  `ffmpeg -y -i "${videoPath}" -vf "fps=20,scale=800:-1:flags=lanczos,palettegen" -update 1 /tmp/lfocomp-palette.png`,
  { stdio: 'inherit' }
);
execSync(
  `ffmpeg -y -i "${videoPath}" -i /tmp/lfocomp-palette.png ` +
  `-filter_complex "fps=20,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse" docs/demo.gif`,
  { stdio: 'inherit' }
);

console.log('✓  docs/demo.gif written');
