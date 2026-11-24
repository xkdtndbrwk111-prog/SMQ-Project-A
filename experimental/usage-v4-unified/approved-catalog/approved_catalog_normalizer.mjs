/**
 * HOJA approved-source index builder. BUILD-TIME ONLY (never at GAS runtime).
 *
 * Revised from candidate 969cdec (work/usage-v4-approved-catalog-index-20261123).
 * No cartridge name, ID, unit title or unit list is embedded here. Every unit is
 * discovered by walking approved/catalog.json -> manifests -> approved archives,
 * and each source is interpreted by its SHAPE (fields present), never by name.
 *
 *   unit-effective-zip    manifest{id,archive}         ZIP effective/cartridge.json
 *   bundle-source-zips    manifest{units[],archive}    ZIP release/approval.json +
 *                                                      nested source ZIPs + media overlay
 *   bundle-unit-questions manifest{unitCounts,...}     approved questions/tags/images +
 *                                                      approved presentation UNIT_META
 *   aggregate-units       manifest{units[{id,archive,sha256,questions}]} -> unit-effective-zip
 *
 * Anything else fails closed with a diagnostic (no silent skipping, no guessing).
 * An APPROVED source index is NOT a deployed/playable catalog: every entry is
 * deploymentStatus NOT_DEPLOYED here; see activeApprovedCatalog().
 */
import {readZip, sha256} from './zip_reader.mjs';

export const INDEX_SCHEMA = 'hoja-approved-source-index-v2';
export const ACTIVE_SCHEMA = 'hoja-active-cartridge-catalog-v1';
export const DEPLOYMENT_SCHEMA = 'hoja-approved-deployment-v1';
const KNOWN_ROOT_KEYS = new Set(['schemaVersion', 'updatedAt', 'policy', 'summary',
  'englishByPublisher', 'subjects', 'gameDeployment']);
// Subject KEY -> display label fallback, used only when approved metadata
// carries no subject label (recorded as subjectLabelSource=CATALOG_KEY).
const SUBJECT_KEY_LABEL = {english: '영어', social: '사회', math: '수학', science: '과학',
  korean: '국어', music: '음악', art: '미술', pe: '체육', ethics: '도덕', practical: '실과'};

const fatal = code => { throw new Error('HOJA_APPROVED_INDEX_' + code); };
const isApproved = x => !!x && (x.teacherApproval === 'APPROVED' ||
  /^TEACHER_APPROVED(_|$)/.test(String(x.status || '')));
const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
const join = (...parts) => parts.join('/').replace(/\/+/g, '/');
const cleanTitle = s => {
  const t = String(s == null ? '' : s).normalize('NFC').replace(/\s+/g, ' ').trim();
  return t && t.length <= 200 && !/[<>\u0000-\u001f\u007f]/.test(t) ? t : null;
};
const digestOf = list => sha256(Buffer.from(list.map(([n, h]) => n + '\t' + h + '\n').sort().join('')));

/* Unit-ID convention is used ONLY as a classification fallback/cross-check
 * (e.g. xyz5-s2-u3-1-common -> grade 5, semester 2, unit 3, subunit 1). */
export function parseUnitIdConvention(id) {
  const m = /^([a-z]+)([1-6])-(?:[a-z0-9]+-)*?(?:s([12])-)?u([0-9]{1,2})(?:-([0-9]{1,2}))?(?:-[a-z]+)?$/.exec(String(id));
  if (!m) return null;
  return {subjectCode: m[1], grade: Number(m[2]), semester: m[3] ? Number(m[3]) : null,
    unit: Number(m[4]), subunit: m[5] ? Number(m[5]) : null};
}

function imageRefs(questions) {
  const out = new Set();
  const walk = v => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') {
      if (v.kind === 'image' && typeof v.src === 'string') out.add(v.src);
      Object.values(v).forEach(walk);
    }
  };
  walk(questions);
  return [...out].sort();
}
function typeCounts(questions) {
  const t = {};
  for (const q of questions) t[q.type] = (t[q.type] || 0) + 1;
  return Object.fromEntries(Object.entries(t).sort());
}
function checkQuestions(id, questions, expected, where) {
  if (!Array.isArray(questions)) fatal('QUESTIONS_NOT_ARRAY:' + where);
  if (questions.length !== expected) fatal('QUESTION_COUNT:' + where + ':' + questions.length + '!=' + expected);
  const seen = new Set();
  for (const q of questions) {
    const qid = String(q && q.questionId || '');
    if (!qid.startsWith(id + ':')) fatal('QUESTION_ID_PREFIX:' + where);
    if (seen.has(qid)) fatal('QUESTION_ID_DUPLICATE:' + where);
    seen.add(qid);
  }
}
function verifyFileTable(zip, where) {
  // release/file-manifest.json {files:{path:{sha256}}} or release/FILES_SHA256.json {path:sha}
  // or SHA256SUMS.json {path:sha}. Every listed file must exist and match.
  const tables = ['release/file-manifest.json', 'release/FILES_SHA256.json', 'SHA256SUMS.json'].filter(zip.has);
  if (!tables.length) fatal('NO_FILE_TABLE:' + where);
  let checked = 0;
  for (const t of tables) {
    const raw = zip.json(t), files = raw && raw.files && typeof raw.files === 'object' ? raw.files : raw;
    for (const [name, v] of Object.entries(files)) {
      const want = typeof v === 'string' ? v : v && v.sha256;
      if (!/^[a-f0-9]{64}$/.test(String(want))) continue; // non-hash metadata keys
      if (!zip.has(name)) fatal('FILE_TABLE_MISSING:' + where + ':' + name);
      if (sha256(zip.read(name)) !== want) fatal('FILE_TABLE_SHA:' + where + ':' + name);
      checked++;
    }
  }
  if (!checked) fatal('FILE_TABLE_EMPTY:' + where);
  return {tables, filesVerified: checked};
}
function mediaRightsOf(...sources) {
  const flags = [];
  for (const s of sources) {
    if (!s || typeof s !== 'object') continue;
    for (const k of ['publicMediaRights']) if (s[k]) flags.push(String(s[k]));
    if (s.qaBoundary && s.qaBoundary.publicMediaRights) flags.push(String(s.qaBoundary.publicMediaRights));
    if (s.mediaExceptions) for (const [q, v] of Object.entries(s.mediaExceptions))
      flags.push(q + ':' + String(v && v.status || 'UNKNOWN'));
  }
  const uniq = [...new Set(flags)].sort();
  const cleared = uniq.length > 0 && uniq.every(f => /(^|:)(CLEARED|VERIFIED|PUBLIC_OK)$/.test(f));
  return {status: cleared ? 'CLEARED' : 'HOLD', flags: uniq.length ? uniq : ['UNSTATED']};
}

export function buildApprovedIndex(src, {sourceRepo, sourceCommit}) {
  if (!src || typeof src.readBytes !== 'function' || typeof src.exists !== 'function') fatal('SOURCE_FN_REQUIRED');
  if (!/^[a-f0-9]{40}$/.test(String(sourceCommit))) fatal('SOURCE_COMMIT_REQUIRED');
  const files = new Map();               // path -> sha256 of every source file read
  const bytes = p => {
    if (!src.exists(p)) fatal('MISSING_FILE:' + p);
    const b = src.readBytes(p);
    files.set(p, sha256(b));
    return b;
  };
  const json = p => { try { return JSON.parse(bytes(p).toString('utf8')); } catch (e) {
    if (String(e.message).startsWith('HOJA_')) throw e; fatal('BAD_JSON:' + p); } };
  const catalogPath = 'approved/catalog.json', root = json(catalogPath);
  if (!root || root.schemaVersion !== 'approved-catalog-v1') fatal('SCHEMA');
  for (const k of Object.keys(root)) if (!KNOWN_ROOT_KEYS.has(k)) fatal('UNKNOWN_ROOT_SECTION:' + k);
  const entries = [], ids = new Set(), diagnostics = [];
  const diag = (id, code) => diagnostics.push({id, code});

  function classify(id, subjectKey, meta, where) {
    const conv = parseUnitIdConvention(id);
    const m = meta && typeof meta === 'object' ? meta : null;
    if (m && Number.isInteger(m.grade)) {
      if (conv && (conv.grade !== m.grade || (m.unitNumber != null && conv.unit !== Number(m.unitNumber)) ||
          (conv.semester != null && m.semester != null && conv.semester !== Number(m.semester))))
        fatal('CLASSIFICATION_DISAGREES:' + where);
      return {grade: m.grade, semester: m.semester != null ? Number(m.semester) : (conv ? conv.semester : null),
        unit: m.unitNumber != null ? Number(m.unitNumber) : (conv ? conv.unit : null),
        subunit: conv ? conv.subunit : null, classificationSource: 'EFFECTIVE_METADATA'};
    }
    if (!conv) fatal('UNCLASSIFIABLE_UNIT:' + where);
    return {grade: conv.grade, semester: conv.semester, unit: conv.unit, subunit: conv.subunit,
      classificationSource: 'UNIT_ID_CONVENTION'};
  }
  function addEntry(e) {
    if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(e.cartridgeId)) fatal('BAD_ID:' + e.cartridgeId);
    if (ids.has(e.cartridgeId)) fatal('DUPLICATE_ID:' + e.cartridgeId);
    ids.add(e.cartridgeId);
    if (!e.approvedTitle) fatal('NO_APPROVED_TITLE:' + e.cartridgeId);
    if (e.semester == null) diag(e.cartridgeId, 'SEMESTER_UNSTATED');
    if (e.mediaRights.status !== 'CLEARED') diag(e.cartridgeId, 'MEDIA_RIGHTS_HOLD');
    entries.push({...e, sourceRepo, sourceCommit, approvalStatus: 'APPROVED', deploymentStatus: 'NOT_DEPLOYED'});
  }

  /* ---- shape: unit manifest + archive with effective/cartridge.json ---- */
  function unitEffectiveZip(subjectKey, manifestPath, m, pinned) {
    if (!isApproved(m)) fatal('UNAPPROVED:' + manifestPath);
    const id = String(m.id || ''), archive = String(m.archive || '');
    if (!id || !archive) fatal('UNIT_SHAPE:' + manifestPath);
    const archivePath = dirOf(manifestPath) + archive;
    const zbytes = bytes(archivePath), zsha = sha256(zbytes);
    const claimed = m.archiveSha256 || m.sha256;
    if (!/^[a-f0-9]{64}$/.test(String(claimed)) || claimed !== zsha) fatal('ARCHIVE_SHA:' + archivePath);
    if (pinned && pinned.sha256 !== zsha) fatal('AGGREGATE_SHA:' + archivePath);
    const size = m.archiveBytes != null ? m.archiveBytes : m.bytes;
    if (size != null && Number(size) !== zbytes.length) fatal('ARCHIVE_BYTES:' + archivePath);
    const zip = readZip(zbytes);
    const table = verifyFileTable(zip, archivePath);
    const cartPath = m.effectiveCartridge || 'effective/cartridge.json';
    if (!cartPath.startsWith('effective/') || !zip.has(cartPath)) fatal('NO_EFFECTIVE_CARTRIDGE:' + archivePath);
    const approval = zip.has('release/approval.json') ? zip.json('release/approval.json') : null;
    if (!approval || !isApproved(approval)) fatal('ZIP_APPROVAL:' + archivePath);
    if (approval.cartridgeId && approval.cartridgeId !== id) fatal('ZIP_APPROVAL_ID:' + archivePath);
    const cart = zip.json(cartPath);
    if (cart.cartridgeId !== id) fatal('EFFECTIVE_ID:' + archivePath);
    const expected = Number(m.questions);
    checkQuestions(id, cart.questions, expected, archivePath);
    if (pinned && pinned.questions !== expected) fatal('AGGREGATE_COUNT:' + id);
    const effectiveFiles = zip.names().filter(n => n.startsWith('effective/'));
    for (const ref of imageRefs(cart.questions))
      if (!zip.has('effective/' + ref)) fatal('EFFECTIVE_ASSET_MISSING:' + id + ':' + ref);
    const presentation = zip.names().filter(n => /^(display|presentation)\//.test(n) || n === 'release/media-overlay.json');
    const meta = cart.metadata || {};
    const cls = classify(id, subjectKey, meta, archivePath);
    addEntry({cartridgeId: id, subject: subjectKey,
      subjectLabel: cleanTitle(meta.subject) || SUBJECT_KEY_LABEL[subjectKey] || null,
      subjectLabelSource: cleanTitle(meta.subject) ? 'EFFECTIVE_METADATA' : 'CATALOG_KEY',
      ...cls, publisher: cleanTitle(meta.publisher), author: cleanTitle(meta.leadAuthor || meta.author),
      unitTitle: cleanTitle(meta.unitTitle), approvedTitle: cleanTitle(cart.title),
      titleSource: 'EFFECTIVE_CARTRIDGE_TITLE', approvalRecordTitle: cleanTitle(approval.title),
      questionCount: expected, types: typeCounts(cart.questions), releaseId: m.releaseId || approval.releaseId || null,
      effectiveRevision: cart.revision != null ? cart.revision : null,
      sourceShape: pinned ? 'aggregate-units/unit-effective-zip' : 'unit-effective-zip',
      sourceManifest: manifestPath, archivePath, archiveSha256: zsha,
      archiveFilesVerified: table.filesVerified,
      effectiveSha256: digestOf(effectiveFiles.map(n => [n, sha256(zip.read(n))])),
      effectiveFiles: effectiveFiles.length,
      presentationSha256: presentation.length ? digestOf(presentation.map(n => [n, sha256(zip.read(n))])) : null,
      mediaOverlay: null, mediaRights: mediaRightsOf(m, approval)});
    return {count: 1, questions: expected};
  }

  /* ---- shape: bundle manifest {units[], archive} with nested source ZIPs ---- */
  function bundleSourceZips(subjectKey, manifestPath, m, family) {
    const archivePath = dirOf(manifestPath) + m.archive;
    const zbytes = bytes(archivePath), zsha = sha256(zbytes);
    if (m.archiveSha256 !== zsha) fatal('ARCHIVE_SHA:' + archivePath);
    if (m.archiveBytes != null && Number(m.archiveBytes) !== zbytes.length) fatal('ARCHIVE_BYTES:' + archivePath);
    const zip = readZip(zbytes);
    const table = verifyFileTable(zip, archivePath);
    const approval = zip.json('release/approval.json');
    if (!isApproved(approval) || !Array.isArray(approval.units)) fatal('ZIP_APPROVAL:' + archivePath);
    const listed = new Map(approval.units.map(u => [u.cartridgeId, u]));
    if (listed.size !== m.units.length || m.units.some(id => !listed.has(id))) fatal('BUNDLE_UNITS_DISAGREE:' + archivePath);
    const overlays = [];
    if (zip.has('release/media-overlay.json')) {
      const raw = zip.json('release/media-overlay.json');
      for (const o of Array.isArray(raw.overlays) ? raw.overlays : [raw]) overlays.push(o);
    }
    for (const o of overlays) if (!listed.has(o.unit)) fatal('OVERLAY_UNKNOWN_UNIT:' + archivePath);
    let questions = 0;
    for (const id of m.units) {
      const u = listed.get(id);
      const nestedName = zip.names().find(n => n.endsWith('/' + u.archive) || n === u.archive);
      if (!nestedName) fatal('NESTED_ARCHIVE_MISSING:' + id);
      const nbytes = zip.read(nestedName);
      if (sha256(nbytes) !== u.archiveSHA256) fatal('NESTED_ARCHIVE_SHA:' + id);
      const nzip = readZip(nbytes), cart = nzip.json('cartridge.json');
      if (cart.cartridgeId !== id) fatal('NESTED_ID:' + id);
      checkQuestions(id, cart.questions, Number(u.questionCount), nestedName);
      for (const ref of imageRefs(cart.questions)) if (!nzip.has(ref)) fatal('NESTED_ASSET_MISSING:' + id + ':' + ref);
      if (cleanTitle(cart.title) !== cleanTitle(u.title)) fatal('TITLE_DISAGREES:' + id);
      const effList = nzip.names().map(n => ['source/' + n, sha256(nzip.read(n))]);
      let overlayInfo = null;
      for (const o of overlays.filter(x => x.unit === id)) {
        const q = cart.questions.find(x => x.questionId === o.questionId);
        if (!q) fatal('OVERLAY_QUESTION_MISSING:' + id);
        if (o.answerId && (!q.answer || q.answer.choiceId !== o.answerId)) fatal('OVERLAY_ANSWER_DISAGREES:' + id);
        const srcName = o.sourceCartridge && o.sourceCartridge.split('/').pop();
        if (srcName && srcName !== u.archive) fatal('OVERLAY_SOURCE_DISAGREES:' + id);
        const refs = imageRefs([q]);
        for (const r of o.replace || []) {
          if (!refs.includes(r.source) || !nzip.has(r.source)) fatal('OVERLAY_SOURCE_ASSET:' + id + ':' + r.source);
          if (!zip.has(r.presentation)) fatal('OVERLAY_PRESENTATION_ASSET:' + id + ':' + r.presentation);
          effList.push(['overlay/' + r.source, sha256(zip.read(r.presentation))]);
        }
        effList.push(['overlay/release/media-overlay.json', sha256(zip.read('release/media-overlay.json'))]);
        overlayInfo = {questionId: o.questionId, replacedAssets: (o.replace || []).length,
          overlaySha256: sha256(zip.read('release/media-overlay.json')), applied: true};
      }
      const meta = cart.metadata || {};
      addEntry({cartridgeId: id, subject: subjectKey,
        subjectLabel: cleanTitle(meta.subject) || SUBJECT_KEY_LABEL[subjectKey] || null,
        subjectLabelSource: cleanTitle(meta.subject) ? 'EFFECTIVE_METADATA' : 'CATALOG_KEY',
        ...classify(id, subjectKey, meta, nestedName),
        publisher: family.publisher || cleanTitle(meta.publisher), author: family.author || cleanTitle(meta.leadAuthor),
        unitTitle: cleanTitle(meta.unitTitle), approvedTitle: cleanTitle(cart.title),
        titleSource: 'APPROVED_SOURCE_CARTRIDGE_TITLE+RELEASE_APPROVAL', approvalRecordTitle: cleanTitle(u.title),
        questionCount: Number(u.questionCount), types: typeCounts(cart.questions),
        releaseId: m.releaseId || approval.releaseId || null, effectiveRevision: u.revision != null ? u.revision : null,
        sourceShape: 'bundle-source-zips', sourceManifest: manifestPath, archivePath, archiveSha256: zsha,
        archiveFilesVerified: table.filesVerified, nestedArchive: nestedName, nestedArchiveSha256: u.archiveSHA256,
        effectiveSha256: digestOf(effList), effectiveFiles: effList.length, presentationSha256: null,
        mediaOverlay: overlayInfo, mediaRights: mediaRightsOf(m, approval)});
      questions += Number(u.questionCount);
    }
    return {count: m.units.length, questions};
  }

  /* ---- shape: bundle manifest {unitCounts} with approved question tables ---- */
  function bundleUnitQuestions(subjectKey, manifestPath, m, family) {
    const base = dirOf(manifestPath);
    const qs = json(base + (m.approvedData || fatal('NO_APPROVED_DATA:' + manifestPath)));
    const tags = json(base + (m.approvedTags || fatal('NO_APPROVED_TAGS:' + manifestPath)));
    const images = json(base + (m.approvedImages || fatal('NO_APPROVED_IMAGES:' + manifestPath)));
    if (!m.approvedPresentation) fatal('NO_APPROVED_PRESENTATION:' + manifestPath);
    const html = bytes(base + m.approvedPresentation).toString('utf8');
    const mm = /const\s+UNIT_META\s*=\s*(\{[^;]*\});/.exec(html);
    if (!mm) fatal('PRESENTATION_UNIT_META_MISSING:' + manifestPath);
    let unitMeta; try { unitMeta = JSON.parse(mm[1]); } catch { fatal('PRESENTATION_UNIT_META_JSON:' + manifestPath); }
    if (!Array.isArray(qs)) fatal('APPROVED_DATA_SHAPE:' + manifestPath);
    for (const k of ['rawQuestionsSHA256', 'rawImagesTableSHA256'])
      if (m[k]) diag(null, 'UNVERIFIABLE_RAW_HASH:' + manifestPath.split('/').slice(-4, -1).join('/') + ':' + k);
    let questions = 0, units = 0;
    for (const [folder, count] of Object.entries(m.unitCounts)) {
      const per = json(base + folder + '/questions.json');
      const sub = qs.filter(q => q.unit === folder);
      if (!Array.isArray(per) || per.length !== count || sub.length !== count) fatal('UNIT_QUESTION_COUNT:' + folder);
      if (JSON.stringify(per) !== JSON.stringify(sub)) fatal('UNIT_FILE_DISAGREES_WITH_APPROVED_DATA:' + folder);
      const unitIds = new Set(per.map(q => String(q.questionId || '').split(':')[0]));
      if (unitIds.size !== 1) fatal('UNIT_ID_AMBIGUOUS:' + folder);
      const id = [...unitIds][0];
      checkQuestions(id, per, count, folder);
      const used = [];
      for (const q of per) {
        if (!tags[q.id]) fatal('TAG_MISSING:' + q.id);
        for (const img of [q.image, ...(q.choices || []).map(c => c && c.image)].filter(Boolean)) {
          if (typeof images[img] !== 'string' || !images[img].startsWith('data:image/')) fatal('IMAGE_MISSING:' + img);
          used.push(img);
        }
      }
      const um = unitMeta[folder];
      if (!um || Number(um.count) !== count) fatal('PRESENTATION_UNIT_META_DISAGREES:' + folder);
      const effList = per.map(q => ['questions/' + q.questionId, sha256(Buffer.from(JSON.stringify(q)))])
        .concat(per.map(q => ['tags/' + q.id, sha256(Buffer.from(JSON.stringify(tags[q.id])))]))
        .concat([...new Set(used)].map(img => ['images/' + img, sha256(Buffer.from(images[img]))]));
      const cls = classify(id, subjectKey, null, folder);
      const title = cleanTitle(um.title);
      addEntry({cartridgeId: id, subject: subjectKey,
        subjectLabel: SUBJECT_KEY_LABEL[subjectKey] || null, subjectLabelSource: 'CATALOG_KEY', ...cls,
        semester: m.semester != null ? Number(m.semester) : cls.semester,
        publisher: family.publisher || cleanTitle(m.publisher), author: family.author || cleanTitle(m.author),
        unitTitle: title, approvedTitle: title, titleSource: 'APPROVED_PRESENTATION_UNIT_META',
        approvalRecordTitle: null, questionCount: count, types: typeCounts(per),
        releaseId: m.releaseId || null, effectiveRevision: null,
        sourceShape: 'bundle-unit-questions', sourceManifest: manifestPath, archivePath: null, archiveSha256: null,
        archiveFilesVerified: 0, effectiveSha256: digestOf(effList), effectiveFiles: effList.length,
        presentationSha256: files.get(base + m.approvedPresentation), mediaOverlay: null,
        mediaRights: mediaRightsOf(m)});
      questions += count; units++;
    }
    return {count: units, questions};
  }

  /* ---- English (publisher/author families) ---- */
  const subjectTotals = {};
  const bump = (k, r) => { subjectTotals[k] = subjectTotals[k] || {units: 0, questions: 0};
    subjectTotals[k].units += r.count; subjectTotals[k].questions += r.questions; };
  for (const [familyKey, family] of Object.entries(root.englishByPublisher || {})) {
    const mp = join('approved', family.path, 'manifest.json'), m = json(mp);
    if (!isApproved(m)) fatal('UNAPPROVED:' + mp);
    let r;
    if (Array.isArray(m.units) && m.archive) r = bundleSourceZips('english', mp, m, family);
    else if (m.unitCounts && typeof m.unitCounts === 'object') r = bundleUnitQuestions('english', mp, m, family);
    else fatal('UNKNOWN_SOURCE_SHAPE:' + mp);
    const total = Number(m.totalQuestions != null ? m.totalQuestions : r.questions);
    if (r.count !== family.units || r.questions !== family.questions || total !== r.questions)
      fatal('FAMILY_COUNTS:' + familyKey);
    bump('english', r);
  }
  /* ---- other subjects (subject-only registration) ---- */
  for (const [subjectKey, s] of Object.entries(root.subjects || {})) {
    let r = {count: 0, questions: 0};
    const add = x => { r.count += x.count; r.questions += x.questions; };
    if (s.manifest) {
      const mp = join('approved', s.manifest), agg = json(mp);
      if (!isApproved(agg) || !Array.isArray(agg.units)) fatal('AGGREGATE_SHAPE:' + mp);
      const dirs = [];
      for (const u of agg.units) {
        const unitDir = dirOf(mp) + dirOf(String(u.archive));
        dirs.push(unitDir);
        const ump = unitDir + 'manifest.json', um = json(ump);
        if (um.id !== u.id || dirOf(mp) + u.archive !== unitDir + um.archive) fatal('AGGREGATE_UNIT_DISAGREES:' + u.id);
        add(unitEffectiveZip(subjectKey, ump, um, {sha256: u.sha256, questions: Number(u.questions)}));
      }
      if (Array.isArray(s.paths)) {
        const a = s.paths.map(p => join('approved', p, '/')).sort(), b = dirs.slice().sort();
        if (JSON.stringify(a) !== JSON.stringify(b)) fatal('PATHS_MANIFEST_DISAGREE:' + subjectKey);
      }
    } else if (Array.isArray(s.paths)) {
      for (const p of s.paths) {
        const mp = join('approved', p, 'manifest.json'), m = json(mp);
        if (m.id && m.archive) add(unitEffectiveZip(subjectKey, mp, m, null));
        else fatal('UNKNOWN_SOURCE_SHAPE:' + mp);
      }
    } else fatal('SUBJECT_SOURCE_UNSUPPORTED:' + subjectKey);
    if (r.count !== s.units || r.questions !== s.questions) fatal('SUBJECT_COUNTS:' + subjectKey);
    bump(subjectKey, r);
  }
  const units = entries.length, questions = entries.reduce((n, e) => n + e.questionCount, 0);
  const sum = root.summary || {};
  if (units !== sum.approvedUnits || questions !== sum.approvedQuestions) fatal('INDEX_TOTALS');
  for (const [k, v] of Object.entries(subjectTotals))
    if (sum[k] != null && sum[k] !== v.questions) fatal('SUMMARY_SUBJECT:' + k);
  entries.sort((a, b) => a.subject.localeCompare(b.subject) || a.grade - b.grade ||
    String(a.publisher || '').localeCompare(String(b.publisher || '')) ||
    (a.semester || 0) - (b.semester || 0) || a.unit - b.unit || (a.subunit || 0) - (b.subunit || 0) ||
    a.cartridgeId.localeCompare(b.cartridgeId));
  const index = {schemaVersion: INDEX_SCHEMA, sourceRepo, sourceCommit,
    catalogUpdatedAt: root.updatedAt || null, approvalUnits: units, approvalQuestions: questions,
    subjects: subjectTotals, gameDeployment: 'NOT_DEPLOYED', entries,
    diagnostics: diagnostics.sort((a, b) => String(a.id).localeCompare(String(b.id)) || a.code.localeCompare(b.code))};
  const indexDigest = sha256(Buffer.from(JSON.stringify(index)));
  const lock = {schemaVersion: 'hoja-approved-source-lock-v1', sourceRepo, sourceCommit,
    catalogSha256: files.get(catalogPath), indexDigest,
    sourceFiles: Object.fromEntries([...files].sort((a, b) => a[0].localeCompare(b[0])))};
  return {index, lock};
}

/* Approval is not deployment. Only ids explicitly pinned by a teacher
 * DEPLOYMENT approval with the exact effective digest become active. */
export function activeApprovedCatalog(index, deployment) {
  if (!index || index.schemaVersion !== INDEX_SCHEMA) fatal('INDEX_REQUIRED');
  if (!deployment || deployment.schemaVersion !== DEPLOYMENT_SCHEMA || !Array.isArray(deployment.entries))
    fatal('DEPLOYMENT_MANIFEST_REQUIRED');
  if (deployment.sourceCommit !== index.sourceCommit) fatal('DEPLOYMENT_SOURCE_COMMIT_MISMATCH');
  const refs = new Map(index.entries.map(e => [e.cartridgeId, e])), seen = new Set(), out = [];
  for (const pin of deployment.entries) {
    const id = pin && pin.cartridgeId;
    if (!id || seen.has(id)) fatal('DUPLICATE_PIN');
    seen.add(id);
    const entry = refs.get(id);
    if (!entry) fatal('PIN_NOT_IN_APPROVED_INDEX:' + id);
    if (pin.teacherDeploymentApproval !== 'APPROVED' || !/^\d{4}-\d{2}-\d{2}$/.test(String(pin.approvedOn || '')))
      fatal('NO_TEACHER_DEPLOYMENT_APPROVAL:' + id);
    if (pin.effectiveSha256 !== entry.effectiveSha256) fatal('EFFECTIVE_SHA_PIN_MISMATCH:' + id);
    if (entry.mediaRights.status !== 'CLEARED' && pin.mediaRightsAcknowledged !== true)
      fatal('MEDIA_RIGHTS_HOLD:' + id);
    for (const gate of ['rendererGate', 'questionValidationGate'])
      if (pin[gate] !== 'PASS') fatal('GATE_NOT_PASSED:' + gate + ':' + id);
    out.push({cartridgeId: id, title: entry.approvedTitle, subject: entry.subject, subjectLabel: entry.subjectLabel,
      grade: entry.grade, semester: entry.semester, publisher: entry.publisher, author: entry.author,
      unit: entry.unit, subunit: entry.subunit, questionCount: entry.questionCount,
      effectiveSha256: entry.effectiveSha256, releaseId: entry.releaseId, deploymentStatus: 'DEPLOYED'});
  }
  out.sort((a, b) => a.cartridgeId.localeCompare(b.cartridgeId));
  return {schemaVersion: ACTIVE_SCHEMA, sourceRepo: index.sourceRepo, sourceCommit: index.sourceCommit,
    deploymentId: String(deployment.deploymentId || ''), entries: out};
}
