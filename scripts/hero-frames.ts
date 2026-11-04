import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Development illustration, intentionally replaceable with the final film.
// Fixed coordinates describe artwork, independent of component layout.
function scene(progress: number, width: number, height: number) {
  const mix = (a: string, b: string) =>
    '#' +
    [0, 2, 4]
      .map((i) =>
        Math.round(
          parseInt(a.slice(i, i + 2), 16) * (1 - progress) +
            parseInt(b.slice(i, i + 2), 16) * progress,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('');
  const top = mix('050a1f', 'b8cddd'),
    middle = mix('0b1330', 'eacdb2'),
    horizon = mix('273159', 'f5c47b');
  const buildings: string[] = [];
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 24; i++) {
      const x = i * 78 - 45 + layer * 21;
      const w = 48 + ((i * 31 + layer * 19) % 45);
      const h = 90 + ((i * 59 + layer * 23) % (layer === 0 ? 185 : 270));
      const y = 820 - h + layer * 60;
      const fill =
        layer === 0
          ? mix('1b2552', '747e8a')
          : layer === 1
            ? mix('101a35', '3a4c5d')
            : mix('080f24', '152b3b');
      buildings.push(
        `<g fill="${fill}"><path d="M${x} ${y + 12}h${w}V950h-${w}Z"/><path d="M${x + 8} ${y}h${w - 16}v15h-${w - 16}Z"/></g>`,
      );
      if (i % 4 === 0)
        buildings.push(`<path d="M${x + w / 2} ${y}v-32" stroke="${fill}" stroke-width="2"/>`);
      for (let row = 0; row < Math.floor(h / 27) - 1; row++)
        for (let col = 0; col < 3; col++) {
          const on =
            (i * 7 + row * 3 + col + layer) % 5 !== 0 &&
            ((i + row + col) % 10) / 10 > progress * 0.8;
          buildings.push(
            `<rect x="${x + 9 + (col * (w - 14)) / 3}" y="${y + 25 + row * 26}" width="7" height="11" rx="1" fill="${on ? '#ffc857' : fill}" opacity="${on ? 0.75 : 1}"/>`,
          );
        }
      if (layer === 2 && i % 3 === 0)
        buildings.push(
          `<g opacity="${progress}"><path d="M${x + 2} ${y + 3}l8 -18h${w - 15}l-8 18Z" fill="#164d68" stroke="#92b0b8" stroke-width="1"/><path d="M${x + 12} ${y - 7}h${w - 15}M${x + w / 2} ${y - 15}l-8 18" stroke="#92b0b8" opacity=".65"/></g>`,
        );
    }
  }
  const stars = Array.from(
    { length: 55 },
    (_, i) =>
      `<circle cx="${(i * 157 + 31) % 1800}" cy="${(i * 83 + 32) % 470}" r="${i % 3 === 0 ? 1.4 : 0.7}" fill="#fff8ec" opacity="${(1 - progress) * 0.6}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1800 1000" preserveAspectRatio="xMidYMax slice"><defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="${top}"/><stop offset=".6" stop-color="${middle}"/><stop offset="1" stop-color="${horizon}"/></linearGradient><radialGradient id="glow"><stop stop-color="#f5a524" stop-opacity=".5"/><stop offset="1" stop-color="#f5a524" stop-opacity="0"/></radialGradient></defs><path fill="url(#sky)" d="M0 0h1800v1000H0Z"/>${stars}<circle cx="1240" cy="${940 - progress * 420}" r="290" fill="url(#glow)" opacity="${progress}"/><circle cx="1240" cy="${950 - progress * 440}" r="85" fill="#ffd391" opacity="${Math.min(1, progress * 2)}"/>${buildings.join('')}<path d="M0 945h1800v55H0Z" fill="#080f24"/></svg>`;
}
const directory = 'apps/web/public/hero';
await mkdir(directory, { recursive: true });
const desktop: string[] = [],
  mobile: string[] = [],
  frameCount = 40;
for (let i = 0; i < frameCount; i++) {
  const name = `hero-d-${String(i + 1).padStart(4, '0')}.webp`,
    mobileName = `hero-m-${String(i + 1).padStart(4, '0')}.webp`;
  await sharp(Buffer.from(scene(i / (frameCount - 1), 1600, 900)))
    .webp({ quality: 72 })
    .toFile(`${directory}/${name}`);
  await sharp(Buffer.from(scene(i / (frameCount - 1), 600, 1000)))
    .webp({ quality: 72 })
    .toFile(`${directory}/${mobileName}`);
  desktop.push('/hero/' + name);
  mobile.push('/hero/' + mobileName);
}
await writeFile(
  `${directory}/hero-manifest.json`,
  JSON.stringify(
    {
      placeholder: true,
      desktop: { width: 1600, height: 900, frames: desktop },
      mobile: { width: 600, height: 1000, frames: mobile },
      poster: desktop[0],
      dawnPoster: desktop[28],
    },
    null,
    2,
  ),
);
console.info(
  '40 optimised development WebP frames per aspect ratio generated. Replace manifest paths with the final film frames when available.',
);
