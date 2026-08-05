const fs = require('fs');
const path = require('path');

const icons = [
  'home',
  'bell',
  'user',
  'user-circle',
  'users',
  'user-group',
  'calendar-days',
  'trophy',
  'shield-check',
  'clipboard-document-list',
  'academic-cap',
  'arrow-right-on-rectangle',
  'bars-3',
  'x-mark',
  'eye',
  'heart',
  'link',
  'building-library',
  'puzzle-piece',
  'hand-raised',
  'squares-2x2',
  'cog-6-tooth',
  'megaphone',
  'speaker-wave',
  'identification'
];

const dir = path.join(__dirname, '..', 'node_modules', 'heroicons', '24', 'outline');
const outDir = path.join(__dirname, '..', 'src', 'app', 'shared', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const entries = icons.map((name) => {
  const svg = fs.readFileSync(path.join(dir, `${name}.svg`), 'utf8');
  const paths = [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  if (!paths.length) {
    throw new Error(`No paths found for ${name}`);
  }
  const arr = paths.map((p) => JSON.stringify(p)).join(', ');
  return `  ${JSON.stringify(name)}: [${arr}]`;
});

const typeLines = icons.map((n, i) => `  | '${n}'${i === icons.length - 1 ? ';' : ''}`);

const content = [
  '/** Heroicons v2 outline (MIT) - paths from the heroicons npm package. */',
  'export type HeroIconName =',
  ...typeLines,
  '',
  'export const HEROICON_OUTLINE_PATHS: Record<HeroIconName, readonly string[]> = {',
  entries.join(',\n'),
  '};',
  ''
].join('\n');

fs.writeFileSync(path.join(outDir, 'heroicons-outline.ts'), content, 'utf8');
console.log(`Wrote ${icons.length} icons to src/app/shared/icons/heroicons-outline.ts`);
