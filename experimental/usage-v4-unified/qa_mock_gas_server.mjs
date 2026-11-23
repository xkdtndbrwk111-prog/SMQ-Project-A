#!/usr/bin/env node
// F3-2 local E2E backend: the REAL single-GAS sources (Code.gs, V4, QA catalog + content files)
// running in the in-memory GAS mock, exposed on 127.0.0.1 so a browser page's google.script.run
// stub can call them. Isolated synthetic copy + mock ranking sheet; no Google access.
// Usage: node qa_mock_gas_server.mjs <qaBundleDir> <port> [<packagesDir>]   (prints READY <port>)
// F4: with <packagesDir> (from build_content_packages.mjs --packages-out) the GAS UrlFetchApp.fetchAll
// of a pinned raw.githubusercontent.com URL is answered from <packagesDir>/<path> — no real network.
// The URL must be exactly https://raw.githubusercontent.com/<repo>/<40-hex>/<path>; anything else = 404.
import {createServer} from 'node:http';
import {readFileSync, readdirSync, existsSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {runInContext} from 'node:vm';
import {loadProject, MockSpreadsheet} from './mock_gas.mjs';
import {buildCopy, standardHistory, ISOLATED_PROPS} from './fixture.mjs';

const [qa, port, pkgDir] = process.argv.slice(2);
const fetched = [];
const {ss} = buildCopy({history: standardHistory()});
const rank = new MockSpreadsheet('rank');
rank.add('HOJA_RANKING', [['cartridge', 'name', 'score', 'correct', 'found', 'remainingSeconds', 'createdAt', 'runId', 'finish', 'deviceId']]);
const p = loadProject({spreadsheets: new Map([['copy40', ss], ['prod', new MockSpreadsheet('prod')], ['cert', new MockSpreadsheet('cert')], ['rank', rank]]),
  props: {...ISOLATED_PROPS, HOJA_USAGE_APPROVED_ERA_START: '2026-11-23', HOJA_PROD_RANKING_SPREADSHEET_ID: 'rank'}});
ss.trace = p.trace;
for (const f of readdirSync(qa).sort()) runInContext(readFileSync(qa + '/' + f, 'utf8'), p.ctx, {filename: f});
if (pkgDir) {
  const root = resolve(pkgDir);
  p.setFetch(r => {
    const m = /^https:\/\/raw\.githubusercontent\.com\/xkdtndbrwk111-prog\/HOJA-QUESTION-BANK\/[a-f0-9]{40}\/(game-runtime\/approved-packages\/v1\/[a-z0-9-]+\.json)$/.exec(r.url);
    const f = m ? join(root, m[1]) : null;
    fetched.push(m ? m[1].split('/').pop() : 'REJECTED_URL');
    return f && f.startsWith(root + '/') && existsSync(f) ? {code: 200, body: readFileSync(f, 'utf8')} : {code: 404, body: ''};
  });
}
const ALLOWED = new Set(['hojaListPublicCartridges', 'hojaGetPublicQuestions', 'recordUsageStartU1', 'hojaRankList', 'hojaRankSave']);
const calls = [];
const ev = ss.getSheetByName('EVENT_LOG');
const startRows = ev.getLastRow();
createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    res.setHeader('access-control-allow-origin', '*');
    if (req.method === 'OPTIONS') { res.setHeader('access-control-allow-headers', 'content-type'); return res.end(); }
    if (req.url === '/state') {
      const rows = ev.rows.slice(startRows).map(r => ({schema: r[13], ids: r[11], ns: r[12].split(':')[0], mode: r[3], teams: r[10]}));
      return res.end(JSON.stringify({calls, fetched, usageRows: rows, rankRows: rank.getSheetByName('HOJA_RANKING').rows.length - 1,
        watermarkMinusLastRow: JSON.parse(p.props.get('HOJA_V4_COMMIT_WATERMARK') || '{"row":0}').row - ev.getLastRow()}));
    }
    try {
      const {fn, args} = JSON.parse(body || '{}');
      if (!ALLOWED.has(fn)) throw new Error('RPC_NOT_ALLOWED_IN_E2E_SHIM');
      calls.push(fn);
      res.end(JSON.stringify({ok: true, v: p.rpc(fn, ...(args || []))}));
    } catch (e) { res.end(JSON.stringify({ok: false, e: String(e && e.message || e)})); }
  });
}).listen(Number(port), '127.0.0.1', () => console.log('READY ' + port));
