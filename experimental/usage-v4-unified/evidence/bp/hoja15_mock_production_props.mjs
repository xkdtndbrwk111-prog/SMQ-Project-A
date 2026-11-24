// 40-6BP: HOJA 1.5 production bundle on the mock GAS with PRODUCTION-LIKE properties (no isolation props).
import {loadProject, MockSpreadsheet} from '../../mock_gas.mjs';
import {readdirSync} from 'node:fs';
const dir = process.argv[2];
const files = readdirSync(dir).filter(f => f.endsWith('.gs')).sort();
const out = {};
function world(props) {
  const stats = new MockSpreadsheet('stats');
  const p = loadProject({spreadsheets: new Map([['stats', stats]]), props, now: '2026-11-25T01:00:00Z', gasDir: dir, gasFiles: files});
  const ev = stats.insertSheet('EVENT_LOG'); ev.appendRow(p.call('SMQ_USAGE_HEADERS_U1'));
  return {p, ev};
}
const base = {SMQ_USAGE_SPREADSHEET_ID: 'stats'};
const tryRpc = (p, ...a) => { try { return {ok: true, v: p.rpc(...a)}; } catch (e) { return {ok: false, e: String(e.message).slice(0, 60)}; } };
// A) no start date -> the approved catalog is refused (documents why the property must be set at cutover)
{ const {p} = world(base); const r = tryRpc(p, 'hojaListPublicCartridges'); out.noStartDate = r.ok ? 'LIST_OK(' + r.v.length + ')' : r.e; }
// B) start date set (cutover) -> 23 approved rows with pinned packages; approved start recorded via the U1 path
{ const {p, ev} = world({...base, HOJA_USAGE_APPROVED_ERA_START: '2026-11-25'});
  const rows = p.rpc('hojaListPublicCartridges');
  out.list = {rows: rows.length, withPkg: rows.filter(r => r.pkg).length, commit: [...new Set(rows.map(r => r.pkg && r.pkg.commit.slice(0, 7)))]};
  out.v4Enabled = p.call("hojaV4uEnabled_(PropertiesService.getScriptProperties())");
  const before = ev.getLastRow();
  const s = tryRpc(p, 'recordUsageStartU1', {eventId: '0'.repeat(31) + '1', mode: 'SOLO', repositoryKind: 'PUBLIC', cartridgeIds: ['math5-s2-u4'], cartridgeCount: 1, teamCount: 1});
  const row = ev.rows[ev.getLastRow() - 1];
  out.approvedStart = {ok: s.ok, err: s.e, rowsAdded: ev.getLastRow() - before, schema: row[13], ids: row[11], ns: String(row[12]).split(':')[0]};
  const again = tryRpc(p, 'recordUsageStartU1', {eventId: '0'.repeat(31) + '1', mode: 'SOLO', repositoryKind: 'PUBLIC', cartridgeIds: ['math5-s2-u4'], cartridgeCount: 1, teamCount: 1});
  out.sameEventIdAgain = {ok: again.ok, err: again.e, rowsNow: ev.getLastRow() - before};
  const legacy = tryRpc(p, 'recordUsageStartU1', {eventId: '0'.repeat(31) + '2', mode: 'SOLO', repositoryKind: 'PUBLIC', cartridgeIds: ['101'], cartridgeCount: 1, teamCount: 1});
  out.legacyStartOnNewDeployment = legacy.ok ? 'RECORDED' : legacy.e;
  const ops = tryRpc(p, 'hojaV4OpsStatus'); out.anonymousOps = ops.ok ? 'NOT_DENIED' : ops.e;
}
console.log(JSON.stringify(out, null, 1));
