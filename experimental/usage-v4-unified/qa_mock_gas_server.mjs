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
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
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
for (const f of readdirSync(qa).filter(x=>x.endsWith('.gs')).sort()) runInContext(readFileSync(qa + '/' + f, 'utf8'), p.ctx, {filename: f});
if (pkgDir) {
  const root = resolve(pkgDir);
  p.setFetch(r => {
    const m = /^https:\/\/raw\.githubusercontent\.com\/xkdtndbrwk111-prog\/HOJA-QUESTION-BANK\/[a-f0-9]{40}\/(game-runtime\/approved-packages\/v1\/[a-z0-9-]+\.json)$/.exec(r.url);
    const f = m ? join(root, m[1]) : null;
    fetched.push(m ? m[1].split('/').pop() : 'REJECTED_URL');
    return f && f.startsWith(root + '/') && existsSync(f) ? {code: 200, body: readFileSync(f, 'utf8')} : {code: 404, body: ''};
  });
}
// Optional isolated remote catalog fixture: exact production reader, fake
// GitHub pointer and immutable body. Never touches actual network or Sheets.
const remoteFixture=process.env.HOJA_REMOTE_TEST_CATALOG;
if(remoteFixture){
  const text=readFileSync(remoteFixture,'utf8'), c=JSON.parse(text);
  if(!String(c.deploymentId).includes('TEST_ONLY'))throw Error('REMOTE_TEST_FIXTURE_REQUIRED');
  p.props.set('HOJA_REMOTE_CATALOG_ENABLED','1');
  p.ctx.__testEmbedded={...c,entries:c.entries.slice(0,1)};
  runInContext('HOJA_APPROVED_ACTIVE_CATALOG_=__testEmbedded',p.ctx);
  runInContext(readFileSync(new URL('./gas/RemoteActiveCatalog.gs',import.meta.url),'utf8'),p.ctx);
  p.ctx.Utilities.newBlob=x=>({getBytes:()=>Buffer.from(x),getDataAsString:()=>Buffer.from(x).toString('utf8')});
  p.ctx.Utilities.gzip=b=>({getBytes:()=>gzipSync(b.getBytes())});
  p.ctx.Utilities.ungzip=b=>({getDataAsString:()=>gunzipSync(b.getBytes()).toString('utf8')});
  p.ctx.Utilities.base64Encode=b=>Buffer.from(b).toString('base64');
  p.ctx.Utilities.base64Decode=s=>Buffer.from(s,'base64');
  const pin='d'.repeat(40),prefix='https://raw.githubusercontent.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/';
  p.ctx.UrlFetchApp.fetch=url=>{
    let body;
    if(url===prefix+'main/game-runtime/active/v1/current.json')body=JSON.stringify({schemaVersion:'hoja-active-catalog-pointer-v1',generation:1,catalogCommit:pin,catalogSha256:createHash('sha256').update(text).digest('hex')});
    else if(url===prefix+pin+'/game-runtime/active/v1/catalog.json')body=text;
    else throw Error('UNEXPECTED_REMOTE_TEST_FETCH');
    return {getResponseCode:()=>200,getContentText:()=>body};
  };
}
const ALLOWED = new Set(['hojaListPublicCartridges', 'hojaGetPublicQuestions', 'recordUsageStartU1', 'hojaRankList', 'hojaRankSave',
  'hojaJoinCreate', 'hojaJoinResolve', 'hojaJoinRevoke']);
// 40-6CF: optional fake /exec URL so the join QR can be drawn in the offline E2E (never a real deployment)
if (process.env.HOJA_JOIN_TEST_URL) p.ctx.__serviceUrl = process.env.HOJA_JOIN_TEST_URL;
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
      if(remoteFixture)runInContext('hojaRemoteCatalogMemo_=undefined',p.ctx);
      res.end(JSON.stringify({ok: true, v: p.rpc(fn, ...(args || []))}));
    } catch (e) { res.end(JSON.stringify({ok: false, e: String(e && e.message || e)})); }
  });
}).listen(Number(port), '127.0.0.1', () => console.log('READY ' + port));
