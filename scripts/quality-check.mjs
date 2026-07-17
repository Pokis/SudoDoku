import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countSolutions, createSeededRandom, generatePuzzle, isValidPlacement } from '../src/sudoku.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const load = (path) => readFile(resolve(root, path), 'utf8');
const checks = [];
const check = async (name, task) => { await task(); checks.push(name); };

const [html, css, sw, manifestText] = await Promise.all([
  load('index.html'), load('styles.css'), load('sw.js'), load('manifest.webmanifest'),
]);
const manifest = JSON.parse(manifestText);

await check('static document structure and accessibility', async () => {
  assert.match(html, /<html\s+lang="[^"]+"/i);
  assert.match(html, /name="viewport"/i);
  assert.match(html, /<main\b/i);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique');
  for (const [, attributes, contents] of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const visibleText = contents.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    assert.ok(visibleText || /aria-label=|title=|data-i18n=/i.test(attributes), `Unlabelled button: ${attributes.slice(0, 60)}`);
  }
  assert.match(css, /@media\(max-width:620px\)/, 'Mobile layout breakpoint is required');
  assert.match(css, /prefers-reduced-motion/, 'Reduced-motion support is required');
});

await check('manifest installability and shortcuts', async () => {
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  assert.ok(manifest.icons.some(({ sizes }) => sizes === '192x192'));
  assert.ok(manifest.icons.some(({ sizes }) => sizes === '512x512'));
  const shortcutUrls = new Set((manifest.shortcuts || []).map(({ url }) => url));
  for (const mode of ['daily', 'mini', 'killer']) assert.ok(shortcutUrls.has(`./?mode=${mode}`), `Missing ${mode} shortcut`);
  for (const icon of [...manifest.icons, ...manifest.shortcuts.flatMap(({ icons = [] }) => icons)]) await access(resolve(root, icon.src.replace(/^\.\//, '')));
});

await check('offline bundle integrity and safe updates', async () => {
  const coreMatch = sw.match(/const CORE = \[([\s\S]*?)\];/);
  assert.ok(coreMatch, 'Service worker CORE list is missing');
  const core = [...coreMatch[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const required = ['./index.html', './styles.css', './manifest.webmanifest', './src/app.js', './src/sudoku.js', './src/techniques.js', './src/academy.js', './src/backup.js', './src/i18n.js'];
  for (const asset of required) assert.ok(core.includes(asset), `${asset} is absent from the offline bundle`);
  for (const asset of core.filter((item) => item !== './')) await access(resolve(root, asset.replace(/^\.\//, '')));
  assert.match(sw, /GET_VERSION/);
  assert.match(sw, /REFRESH_CACHE/);
  assert.match(sw, /SKIP_WAITING/);
  const installHandler = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"));
  assert.doesNotMatch(installHandler, /skipWaiting/, 'Updates must wait for user confirmation');
});

await check('no hosted runtime dependencies', async () => {
  const supportUrl = 'https://buymeacoffee.com/djpokis';
  const externalReferences = [...html.matchAll(/(?:src|href)="(https?:\/\/[^\"]+)"/gi)].map((match) => match[1]);
  assert.deepEqual(externalReferences, [supportUrl, supportUrl], 'Only the approved support destination may be external');
  const supportAnchors = [...html.matchAll(/<a\b([^>]*)>/gi)].filter(([, attributes]) => attributes.includes(`href="${supportUrl}"`));
  assert.equal(supportAnchors.length, 2, 'Support must be available in the main menu and Settings');
  for (const [, attributes] of supportAnchors) {
    assert.match(attributes, /target="_blank"/i);
    assert.match(attributes, /rel="[^"]*noopener[^"]*noreferrer[^"]*"/i);
  }
  assert.doesNotMatch(css, /@import\s+url\(https?:/i);
});

await check('seeded puzzle stress suite', async () => {
  for (const variant of ['classic', 'mini', 'hyper']) {
    for (const difficulty of ['easy', 'medium', 'hard', 'expert']) {
      for (let run = 0; run < 2; run += 1) {
        const seed = `quality-${variant}-${difficulty}-${run}`;
        const { puzzle, solution } = generatePuzzle(difficulty, createSeededRandom(seed), variant);
        assert.equal(countSolutions([...puzzle], 2, variant), 1, `${seed} is not unique`);
        assert.ok(puzzle.some((value) => value === 0), `${seed} contains no empty cells`);
        assert.ok(solution.every((value, index) => isValidPlacement(solution, index, value, variant)), `${seed} solution is invalid`);
      }
    }
  }
});

console.log(`Quality gate passed: ${checks.length} checks, 24 generated puzzles stressed.`);
for (const name of checks) console.log(`  ✓ ${name}`);
