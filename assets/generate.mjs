// Source images for `npx capacitor-assets generate` (app icon + splash screens).
// The logo is drawn here in SVG (paw + heart, app palette) and rendered to PNG
// with sharp. Regenerate: node assets/generate.mjs && npx capacitor-assets generate
import sharp from 'sharp';

const CREAM = '#fff9f3';
const DARK = '#211a16';
const PEACH = '#f4a07a';
const PEACH_LIGHT = '#f8bc9c';
const BROWN = '#3e2e25';

/** Paw with a heart on its pad, drawn in a 1024 box, centred on (512, 512). */
function paw(fill, heart) {
  return `
    <g fill="${fill}">
      <ellipse cx="512" cy="620" rx="190" ry="160"/>
      <ellipse cx="300" cy="420" rx="78" ry="100" transform="rotate(-22 300 420)"/>
      <ellipse cx="430" cy="300" rx="80" ry="106" transform="rotate(-6 430 300)"/>
      <ellipse cx="594" cy="300" rx="80" ry="106" transform="rotate(6 594 300)"/>
      <ellipse cx="724" cy="420" rx="78" ry="100" transform="rotate(22 724 420)"/>
    </g>
    <path fill="${heart}" d="M512 720 C 400 650, 400 560, 455 548 C 485 541, 505 560, 512 580 C 519 560, 539 541, 569 548 C 624 560, 624 650, 512 720 Z"/>`;
}

const background = `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PEACH_LIGHT}"/>
      <stop offset="1" stop-color="${PEACH}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>`;

const svg = (size, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`);

/** Android adaptive icons crop the outer third: keep the paw inside the safe zone. */
const safe = (body, scale = 0.62) => `<g transform="translate(512 512) scale(${scale}) translate(-512 -512)">${body}</g>`;

/** Splash: logo in a peach circle on a cream (or warm dark) background. */
function splash(bg) {
  const logo = `<circle cx="512" cy="512" r="430" fill="${PEACH}"/>${safe(paw(CREAM, BROWN))}`;
  return svg(2732, `<rect width="2732" height="2732" fill="${bg}"/><g transform="translate(1366 1366) scale(0.6) translate(-512 -512)">${logo}</g>`);
}

const out = (name) => new URL(name, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

// Full icon (iOS, older Android): not cropped, the paw can be bigger.
await sharp(svg(1024, background + safe(paw(CREAM, BROWN), 0.8))).png().toFile(out('icon-only.png'));
await sharp(svg(1024, safe(paw(CREAM, BROWN)))).png().toFile(out('icon-foreground.png'));
await sharp(svg(1024, background)).png().toFile(out('icon-background.png'));
await sharp(splash(CREAM)).png().toFile(out('splash.png'));
await sharp(splash(DARK)).png().toFile(out('splash-dark.png'));
console.log('assets/*.png generated');
