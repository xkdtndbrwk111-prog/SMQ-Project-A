#!/usr/bin/env node
/**
 * Compose the ONE shared approved renderer used by every game mode:
 *   HOJA_APPROVED_RENDERER_BRIDGE.html (SHA-256 pinned below)
 *   + <script id="hoja-ext-media-v1"> HOJA_RENDERER_MEDIA_EXT.js </script> appended before </body>.
 * The bridge's A/C/D CSS and renderQuestion/measureAndFit/fitContent/selectComposition stay
 * byte-identical; only the adapter message protocol changed.
 *   node compose_renderer.mjs <out.html>
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
// Previous bridge SHA-256: 12b76fbbf667f3408f19059c0b0d3febd9bc471c038ddd004333ce135633b157.
// Adapter-only presentation IDs; approved visual rendering is unchanged.
const here = dirname(fileURLToPath(import.meta.url));
export const BRIDGE_SHA256 = 'd4c93c612dd6486ec0554da300b703f595e36830268527908c5cc5e0c7bab82c';
const sha = b => createHash('sha256').update(b).digest('hex');
export function composeRenderer() {
  const bridge = readFileSync(join(here, 'HOJA_APPROVED_RENDERER_BRIDGE.html'), 'utf8');
  if (sha(bridge) !== BRIDGE_SHA256) throw new Error('BRIDGE_SHA_CHANGED');
  const exts = [['hoja-ext-media-v1', 'HOJA_RENDERER_MEDIA_EXT.js'], ['hoja-ext-math-v1', 'HOJA_RENDERER_MATH_EXT.js'],
    ['hoja-ext-input-guard-v1', 'HOJA_RENDERER_INPUT_GUARD.js']] // guard last: stamps buttons after every re-render
    .map(([id, f]) => [id, readFileSync(join(here, f), 'utf8')]);
  const at = bridge.lastIndexOf('</body>');
  if (at < 0 || exts.some(([id, t]) => t.includes('</script') || bridge.includes(id))) throw new Error('BRIDGE_SHAPE_OR_EXT_UNSAFE');
  const html = bridge.slice(0, at) + exts.map(([id, t]) => '<script id="' + id + '">\n' + t + '</script>\n').join('') + bridge.slice(at);
  return {html, bridgeSha256: BRIDGE_SHA256, extSha256: sha(exts[0][1]), mathExtSha256: sha(exts[1][1]), inputGuardSha256: sha(exts[2][1]), composedSha256: sha(html)};
}
if (process.argv[1] && process.argv[1].endsWith('compose_renderer.mjs')) {
  const r = composeRenderer();
  writeFileSync(process.argv[2], r.html);
  console.log(JSON.stringify({bridgeSha256: r.bridgeSha256, extSha256: r.extSha256, mathExtSha256: r.mathExtSha256, inputGuardSha256: r.inputGuardSha256, composedSha256: r.composedSha256}));
}
