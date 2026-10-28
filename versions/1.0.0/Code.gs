/**
* 🎮 마리오 퀴즈 게임 - 웹 앱 백엔드
* v1.06
* - 기존 게임 백엔드 유지
* - SOLO 공용 랭킹을 Google Sheet에 저장
* - 문제(카트리지)별 TOP 25 보관 / 화면 높이에 따라 TOP 10~25 표시
* - 스프레드시트 교사용 랭킹 관리 메뉴
* - 잠긴 게임은 학생용 카트리지 목록에서 자동 제외
* - v1.04: Index / Styles / Game 분리용 include() 추가
* - v1.06: 공개배포 대비 읽기 캐시 + A:G 범위 읽기 + TEAM 불필요 서버상태 읽기 제거
*/

const QUIZ_SPREADSHEET_ID = '1AFp2aikwyHqx7SG-lh-581VGwm7yp1Dc5Mp0m1CVQjs';

const SOLO_RANKING_SHEET = 'SOLO_RANKING';
// Legacy system-sheet compatibility: an existing 의견 tab must never become a cartridge.
const LEGACY_OPINION_SHEET = '의견';
const SOLO_RANKING_MAX_KEEP = 25;
const SOLO_RANKING_VISIBLE = 25;
const SOLO_RANKING_FORBIDDEN = new Set(['SEX', 'XES', 'EXS', 'SXE']);

const GAME_LOCK_PREFIX = '🔒 ';
const GAME_LOCK_STATE_KEY = 'MARIO_GAME_LOCK_STATE_V1';
const GAME_LOCK_COLOR_KEY = 'MARIO_GAME_LOCK_ORIGINAL_TAB_COLORS_V1';


/* =========================================================
   v1.06 — public web-app read cache
   - short shared cache for cartridge list / question payload / SOLO rankings
   - cache is only a speed layer; current visibility is still validated before
     a cached question payload is served.
   ========================================================= */
const GAME_SHEETS_CACHE_KEY_V106 = 'SMQ_GAME_SHEETS_V106';
const GAME_SHEETS_CACHE_TTL_V106 = 30;
const GAME_DATA_CACHE_TTL_V106 = 60;
const SOLO_RANK_CACHE_TTL_V106 = 15;

function cacheKeyHashV106_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    String(text || ''),
    Utilities.Charset.UTF_8
  );
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function gameDataCacheKeyV106_(sheetName) {
  return 'SMQ_GAME_DATA_V106_' + cacheKeyHashV106_(canonicalRankingProblemName_(sheetName));
}

function soloRankCacheKeyV106_(sheetName) {
  return 'SMQ_SOLO_RANK_V106_' + cacheKeyHashV106_(canonicalRankingProblemName_(sheetName));
}

function safeCacheGetJsonV106_(key) {
  try {
    const raw = CacheService.getScriptCache().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function safeCachePutJsonV106_(key, value, ttlSeconds) {
  try {
    const raw = JSON.stringify(value);
    // Apps Script cache entries have a size ceiling. Korean text can occupy
    // multiple UTF-8 bytes, so check the byte length rather than JS characters.
    if (Utilities.newBlob(raw).getBytes().length > 90000) return false;
    CacheService.getScriptCache().put(key, raw, ttlSeconds);
    return true;
  } catch (e) {
    return false;
  }
}

function safeCacheRemoveV106_(key) {
  try { CacheService.getScriptCache().remove(key); } catch (e) {}
}

function invalidateGameListCacheV106_() {
  safeCacheRemoveV106_(GAME_SHEETS_CACHE_KEY_V106);
}

function invalidateGameDataCacheV106_(sheetName) {
  safeCacheRemoveV106_(gameDataCacheKeyV106_(sheetName));
}

function invalidateSoloRankCacheV106_(sheetName) {
  safeCacheRemoveV106_(soloRankCacheKeyV106_(sheetName));
}

/**
* 웹앱 실행
*/
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('SUPER MARIO QUIZ GAME')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
* HTML 부분 파일 포함
* Index.html의 <?!= include('파일명'); ?> 에서 사용
*/
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
* 스프레드시트 안전하게 가져오기
*/
function getQuizSpreadsheet_() {
  let ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.openById(QUIZ_SPREADSHEET_ID);
  }
  return ss;
}

/**
* 🧹 풀었던 문제 이력 및 점수 리셋
*/
function resetSolvedQuestions() {
  const userProps = PropertiesService.getUserProperties();
  userProps.deleteProperty('SOLVED_QUESTIONS');
  userProps.deleteProperty('TILE_OWNERS');
}

/**
* 게임 잠금 상태 저장소
* sheetId를 키로 사용하므로 탭 이름이 바뀌어도 잠금 상태는 유지됨
*/
function getGameLockState_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(GAME_LOCK_STATE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function saveGameLockState_(state) {
  PropertiesService.getScriptProperties()
    .setProperty(GAME_LOCK_STATE_KEY, JSON.stringify(state || {}));
}

function getGameOriginalTabColors_() {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(GAME_LOCK_COLOR_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
}

function saveGameOriginalTabColors_(colors) {
  PropertiesService.getScriptProperties()
    .setProperty(GAME_LOCK_COLOR_KEY, JSON.stringify(colors || {}));
}

function stripGameLockPrefix_(name) {
  let clean = String(name || '').trim();
  while (clean.indexOf(GAME_LOCK_PREFIX) === 0) {
    clean = clean.slice(GAME_LOCK_PREFIX.length).trim();
  }
  return clean;
}

function isSystemSheetName_(name) {
  const normalized = String(name || '').trim().toUpperCase();
  return [
    '모둠점수',
    'ASSET',
    'ASSETS',
    'SETTINGS',
    'CONFIG',
    SOLO_RANKING_SHEET.toUpperCase(),
    LEGACY_OPINION_SHEET.toUpperCase()
  ].includes(normalized);
}

function isGameSheetLocked_(sheet) {
  if (!sheet) return false;
  const state = getGameLockState_();
  const id = String(sheet.getSheetId());
  return state[id] === true ||
    String(sheet.getName() || '').trim().indexOf(GAME_LOCK_PREFIX) === 0;
}

function canonicalRankingProblemName_(problemSheet) {
  return stripGameLockPrefix_(problemSheet);
}

function getActiveGameSheet_() {
  const ss = getQuizSpreadsheet_();
  const sheet = ss.getActiveSheet();
  if (!sheet || isSystemSheetName_(stripGameLockPrefix_(sheet.getName()))) {
    return null;
  }
  return sheet;
}

/**
* Player catalog eligibility:
* Manager/public cartridge sheets use row 1 as the header and question rows from row 2.
* A header-only sheet is an empty cartridge and should not be exposed to students.
* Keep this intentionally cheap: do not parse every cartridge during catalog loading.
*/
function hasGameQuestionRowsForCatalog_(sheet) {
  return !!sheet && sheet.getLastRow() > 1;
}

/**
* 게임용 문제 시트(탭) 목록만 반환 (설정/시스템용 시트 자동 제외)
*/
function getGameSheetsList() {
  try {
    const cached = safeCacheGetJsonV106_(GAME_SHEETS_CACHE_KEY_V106);
    if (Array.isArray(cached)) return cached;

    const ss = getQuizSpreadsheet_();
    // IMPORTANT: read the lock map only once. The former implementation called
    // PropertiesService once per sheet through isGameSheetLocked_().
    const lockState = getGameLockState_();

    const result = ss.getSheets()
      .filter(sheet => {
        const rawName = String(sheet.getName() || '').trim();
        const visibleName = stripGameLockPrefix_(rawName);
        if (isSystemSheetName_(visibleName)) return false;

        const id = String(sheet.getSheetId());
        const locked =
          lockState[id] === true ||
          rawName.indexOf(GAME_LOCK_PREFIX) === 0;
        if (locked) return false;
        return hasGameQuestionRowsForCatalog_(sheet);
      })
      .map(sheet => stripGameLockPrefix_(sheet.getName()));

    safeCachePutJsonV106_(
      GAME_SHEETS_CACHE_KEY_V106,
      result,
      GAME_SHEETS_CACHE_TTL_V106
    );
    return result;
  } catch (e) {
    Logger.log('Error: ' + e.toString());
    return ['마리오게임 테스트'];
  }
}

/**
* 특정 시트(탭)의 게임 초기 데이터 로드
*/
function getGameDataBySheet(sheetName) {
  const ss = getQuizSpreadsheet_();
  const requestedName = stripGameLockPrefix_(sheetName);
  const sheet = ss.getSheetByName(requestedName);

  if (!sheet || isSystemSheetName_(requestedName) || isGameSheetLocked_(sheet)) {
    throw new Error('이 게임은 현재 공개되어 있지 않습니다.');
  }

  const cacheKey = gameDataCacheKeyV106_(requestedName);
  const cached = safeCacheGetJsonV106_(cacheKey);
  if (
    cached &&
    Array.isArray(cached.questions) &&
    cached.questionSchemaVersion === 2 &&
    String(cached.cartridgeId || '').trim()
  ) {
    return cached;
  }

  const parsed = readGameQuestionRowsV2_(sheet);
  const allQuestions = parsed.questions.map((srcQ, idx) => ({
    num: idx + 1,
    sourceNum: idx + 1,
    familyId: srcQ.familyId,
    familyOrder: srcQ.familyOrder,
    variantType: srcQ.variantType,
    type: srcQ.type,
    question: srcQ.question,
    answer: srcQ.answer,
    options: srcQ.options,
    explanation: srcQ.explanation,
    isNull: false
  }));

  // TEAM scores / solved tiles are browser-session-local since v1.00.184.
  const payload = {
    questionSchemaVersion: 2,
    sourceSheetVersion: parsed.sheetVersion,
    /* U3: stable PUBLIC cartridge identity for server-verified telemetry. */
    cartridgeId: String(sheet.getSheetId()),
    questions: allQuestions,
    teams: [],
    solvedList: [],
    tileOwners: {}
  };

  safeCachePutJsonV106_(cacheKey, payload, GAME_DATA_CACHE_TTL_V106);
  return payload;
}


/**
 * Multi-cartridge Player batch read.
 * One RPC, all-or-nothing: any invalid/locked cartridge aborts the whole request.
 * Project B/public repository is never mutated.
 */
function getGameDataBySheets(sheetNames) {
  const names = Array.isArray(sheetNames)
    ? sheetNames.map(v => String(v || '').trim()).filter(Boolean)
    : [];
  const uniqueNames = [...new Set(names)];
  if (!uniqueNames.length) throw new Error('선택된 카트리지가 없습니다.');
  if (uniqueNames.length > 5) throw new Error('카트리지는 최대 5개까지 선택할 수 있습니다.');

  return uniqueNames.map(sheetName => ({
    sheetName: sheetName,
    data: getGameDataBySheet(sheetName)
  }));
}

/**
 * Spreadsheet question compatibility reader.
 *
 * v1 header:
 *   유형 | 문제 | 정답 | 보기1 | 보기2 | 보기3 | 보기4
 *
 * v2 header:
 *   묶음ID | 유형 | 문제 | 정답 | 보기1 | 보기2 | 보기3 | 보기4
 *
 * Step 3 deliberately keeps the existing game-facing flat question array.
 * v2 rows receive familyId/familyOrder/variantType metadata so the next step
 * can select at bundle level without changing today's TEAM/SOLO UI yet.
 */
function readGameQuestionRowsV2_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return { sheetVersion: 1, questions: [] };

  const headerWidth = Math.min(8, Math.max(7, sheet.getLastColumn()));
  const header = sheet.getRange(1, 1, 1, headerWidth).getDisplayValues()[0]
    .map(v => String(v || '').trim());

  const isV2 = header[0] === '묶음ID' &&
    header[1] === '유형' &&
    header[2] === '문제' &&
    header[3] === '정답';

  if (!isV2) {
    return {
      sheetVersion: 1,
      questions: readGameQuestionRowsV1_(sheet, lastRow)
    };
  }

  return {
    sheetVersion: 2,
    questions: readGameQuestionRowsV2Data_(sheet, lastRow)
  };
}

function readGameQuestionRowsV1_(sheet, lastRow) {
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getDisplayValues();
  const result = [];
  let familyOrder = 0;

  rows.forEach((row, index) => {
    if (!row.some(v => String(v || '').trim() !== '')) return;

    const parsed = parseGameQuestionVariantRow_(
      row[0], row[1], row[2], row.slice(3, 7)
    );
    if (!parsed) return;

    familyOrder++;
    parsed.familyId = 'legacy_row_' + (index + 2);
    parsed.familyOrder = familyOrder;
    result.push(parsed);
  });

  return result;
}

function readGameQuestionRowsV2Data_(sheet, lastRow) {
  if (lastRow < 2) return [];
  const rows = sheet.getRange(2, 1, lastRow - 1, 8).getDisplayValues();
  const result = [];
  const familyOrderMap = Object.create(null);
  const seenVariantMap = Object.create(null);
  let familyCount = 0;
  let temporaryCount = 0;

  rows.forEach((row, index) => {
    if (!row.some(v => String(v || '').trim() !== '')) return;

    const sheetRow = index + 2;
    let familyId = String(row[0] || '').trim();
    const parsed = parseGameQuestionVariantRow_(
      row[1], row[2], row[3], row.slice(4, 8)
    );

    // Keep the old behavior for a row with no actual question text.
    if (!parsed) return;

    // A manually-added v2 row with a blank ID is treated as an independent
    // temporary single bundle. It is never guessed to belong to a neighbour.
    if (!familyId) {
      temporaryCount++;
      familyId = 'temp_row_' + sheetRow + '_' + temporaryCount;
    }

    if (!Object.prototype.hasOwnProperty.call(familyOrderMap, familyId)) {
      familyCount++;
      familyOrderMap[familyId] = familyCount;
      seenVariantMap[familyId] = Object.create(null);
    }

    if (seenVariantMap[familyId][parsed.variantType]) {
      throw new Error(
        '묶음문제 연결 오류: ' + sheet.getName() + ' 시트의 ' +
        sheetRow + '행에서 묶음ID "' + familyId + '"에 ' +
        gameVariantLabel_(parsed.variantType) + ' 문제가 두 번 있습니다.'
      );
    }

    seenVariantMap[familyId][parsed.variantType] = true;
    parsed.familyId = familyId;
    parsed.familyOrder = familyOrderMap[familyId];
    result.push(parsed);
  });

  return result;
}

function parseGameQuestionVariantRow_(rawType, rawQuestion, rawAnswer, rawChoices) {
  const type = String(rawType || '').trim();
  const question = String(rawQuestion || '').trim();
  const answer = String(rawAnswer || '').trim();
  const choices = (rawChoices || []).slice(0, 4).map(v => String(v || '').trim());

  if (!question) return null;

  if (type === 'OX퀴즈' || type === 'OX') {
    return {
      variantType: 'ox',
      type: 'OX',
      question: question,
      answer: answer.toUpperCase(),
      options: ['O', 'X'],
      explanation: '정답: ' + answer.toUpperCase()
    };
  }

  if (type === '주관식') {
    return {
      variantType: 'subjective',
      type: 'SUBJECTIVE',
      question: question,
      answer: answer,
      options: [],
      explanation: '정답: ' + answer
    };
  }

  if (type === '객관식') {
    return {
      variantType: 'multiple',
      type: 'MULTIPLE',
      question: question,
      answer: answer,
      options: choices.filter(v => v !== ''),
      explanation: '정답: ' + answer + '번'
    };
  }

  return null;
}

function gameVariantLabel_(variantType) {
  if (variantType === 'ox') return 'OX';
  if (variantType === 'multiple') return '객관식';
  if (variantType === 'subjective') return '주관식';
  return String(variantType || '알 수 없는 유형');
}

/**
* 팀 수 설정 및 리셋
*/
function setTeamCount(count) {
  const ss = getQuizSpreadsheet_();
  let teamSheet = ss.getSheetByName('모둠점수');
  if (!teamSheet) {
    teamSheet = ss.insertSheet('모둠점수');
  } else {
    teamSheet.clearContents();
  }
  teamSheet.getRange('A1:B1').setValues([['팀명', '현재 코인/점수']]);
  teamSheet.getRange('A1:B1').setBackground('#fbd000').setFontWeight('bold');

  // 시스템용 점수 시트는 자동 숨김
  try {
    teamSheet.hideSheet();
  } catch (e) {
    Logger.log('모둠점수 시트 숨김 실패: ' + e.toString());
  }
  const teamData = [];
  for (let i = 1; i <= count; i++) {
    teamData.push([`${i}팀`, 0]);
  }
  teamSheet.getRange(2, 1, count, 2).setValues(teamData);
  resetSolvedQuestions();
  return teamData.map(row => ({ name: row[0], score: row[1] }));
}

/**
* 아이템 효과 적용 및 점수 계산 전체 업데이트
*/
function applyItemEffect(qNum, currentTeamIdx, itemData, targetTeamIdx) {
  const ss = getQuizSpreadsheet_();
  const teamSheet = ss.getSheetByName('모둠점수');
  if (!teamSheet) return { teams: [], tileOwners: {} };

  const rowCount = teamSheet.getLastRow() - 1;
  const range = teamSheet.getRange(2, 1, rowCount, 2);
  const values = range.getValues();
  const scores = values.map(v => parseInt(v[1]) || 0);

  const itemType = itemData.type;
  const value = itemData.value || 0;

  if (itemType === 'COIN' || itemType === 'BONUS') {
    scores[currentTeamIdx] += value;
  } else if (itemType === 'GOOMBA') {
    scores[currentTeamIdx] = Math.max(0, scores[currentTeamIdx] - value);
  } else if (itemType === 'BOMB') {
    scores[currentTeamIdx] = 0;
  } else if (itemType === 'SHELL') {
    if (targetTeamIdx >= 0 && targetTeamIdx < scores.length) {
      const steal = Math.min(value, scores[targetTeamIdx]);
      scores[targetTeamIdx] -= steal;
      scores[currentTeamIdx] += steal;
    }
  } else if (itemType === 'HAMMER' || itemType === 'BOWSER' || itemType === 'STAR') {
    if (targetTeamIdx >= 0 && targetTeamIdx < scores.length && targetTeamIdx !== currentTeamIdx) {
      const temp = scores[currentTeamIdx];
      scores[currentTeamIdx] = scores[targetTeamIdx];
      scores[targetTeamIdx] = temp;
    }
  }

  for (let i = 0; i < scores.length; i++) {
    teamSheet.getRange(i + 2, 2).setValue(scores[i]);
  }

  const userProps = PropertiesService.getUserProperties();
  const solvedJson = userProps.getProperty('SOLVED_QUESTIONS') || '[]';
  const solvedList = JSON.parse(solvedJson);
  if (qNum > 0 && !solvedList.includes(qNum)) {
    solvedList.push(qNum);
    userProps.setProperty('SOLVED_QUESTIONS', JSON.stringify(solvedList));
  }

  const tileOwnersJson = userProps.getProperty('TILE_OWNERS') || '{}';
  const tileOwners = JSON.parse(tileOwnersJson);

  if (qNum > 0) {
    tileOwners[qNum] = { teamIdx: currentTeamIdx, isCorrect: true };
    userProps.setProperty('TILE_OWNERS', JSON.stringify(tileOwners));
  }

  const resTeams = scores.map((s, idx) => ({ name: `${idx + 1}팀`, score: s }));

  return {
    teams: resTeams,
    tileOwners: tileOwners
  };
}

/**
* 틀린 문제 풀이 완료 처리
*/
function markAsSolved(qNum, currentTeamIdx) {
  const userProps = PropertiesService.getUserProperties();

  const solvedJson = userProps.getProperty('SOLVED_QUESTIONS') || '[]';
  const solvedList = JSON.parse(solvedJson);
  if (qNum > 0 && !solvedList.includes(qNum)) {
    solvedList.push(qNum);
    userProps.setProperty('SOLVED_QUESTIONS', JSON.stringify(solvedList));
  }

  const tileOwnersJson = userProps.getProperty('TILE_OWNERS') || '{}';
  const tileOwners = JSON.parse(tileOwnersJson);
  if (qNum > 0) {
    tileOwners[qNum] = { teamIdx: currentTeamIdx, isCorrect: false };
    userProps.setProperty('TILE_OWNERS', JSON.stringify(tileOwners));
  }

  return {
    solvedList: solvedList,
    tileOwners: tileOwners
  };
}


/* =========================================================
   SOLO 공용 랭킹
   ========================================================= */

/**
* SOLO_RANKING 숨김 시트를 가져오고, 없으면 자동 생성
*/
function getSoloRankingSheet_() {
  const ss = getQuizSpreadsheet_();
  let sheet = ss.getSheetByName(SOLO_RANKING_SHEET);

  if (!sheet) {
    sheet = ss.insertSheet(SOLO_RANKING_SHEET);
    sheet.getRange(1, 1, 1, 8).setValues([[
      'problemSheet',
      'name',
      'score',
      'correct',
      'createdAt',
      'entryId',
      'timestampMs',
      'deviceId'
    ]]);
    sheet.setFrozenRows(1);

    try {
      sheet.hideSheet();
    } catch (e) {
      Logger.log('SOLO_RANKING 시트 숨김 실패: ' + e.toString());
    }
  } else {
    // v1.02 migration: existing 7-column ranking sheets gain deviceId in column H.
    if (sheet.getMaxColumns() < 8) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), 8 - sheet.getMaxColumns());
    }
    if (String(sheet.getRange(1, 8).getValue() || '').trim() !== 'deviceId') {
      sheet.getRange(1, 8).setValue('deviceId');
    }
  }

  return sheet;
}
/**
* 랭킹 이름 정규화
*/
function normalizeSoloRankName_(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
}


function normalizeSoloDeviceId_(value) {
  return String(value || '')
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, '')
    .slice(0, 100);
}

/**
* 특정 카트리지의 전체 랭킹을 정렬해서 반환
* 점수 높은 순 → 동점이면 먼저 등록한 기록 우선
*/
function getSoloRankingRows_(problemSheet) {
  const canonicalProblem = canonicalRankingProblemName_(problemSheet);
  const sheet = getSoloRankingSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();

  return values
    .filter(r => canonicalRankingProblemName_(r[0]) === canonicalProblem)
    .map(r => ({
      problemSheet: String(r[0] || ''),
      name: String(r[1] || ''),
      score: Number(r[2] || 0),
      correct: Number(r[3] || 0),
      createdAt: r[4],
      id: String(r[5] || ''),
      time: Number(r[6] || 0),
      deviceId: String(r[7] || '')
    }))
    .sort((a, b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff !== 0) return scoreDiff;
      return a.time - b.time;
    });
}

/**
* 웹앱에서 현재 카트리지 TOP 25 랭킹 불러오기
*/
function getSoloRankings(problemSheet) {
  const name = canonicalRankingProblemName_(problemSheet);
  if (!name || name === SOLO_RANKING_SHEET) return [];

  const cacheKey = soloRankCacheKeyV106_(name);
  const cached = safeCacheGetJsonV106_(cacheKey);
  if (Array.isArray(cached)) return cached;

  const rows = getSoloRankingRows_(name)
    .slice(0, SOLO_RANKING_VISIBLE)
    .map(r => ({
      id: r.id,
      name: r.name,
      score: r.score,
      correct: r.correct,
      time: r.time
    }));

  safeCachePutJsonV106_(cacheKey, rows, SOLO_RANK_CACHE_TTL_V106);
  return rows;
}

/**
* SOLO 랭킹 저장
* - 문제별 TOP 25만 유지
* - 화면 반환값은 TOP 25
* - 동시 등록 충돌 방지
*/
function saveSoloRanking(problemSheet, playerName, score, correct, deviceId, replaceConfirmed) {
  const problem = canonicalRankingProblemName_(problemSheet);
  const name = normalizeSoloRankName_(playerName);
  const device = normalizeSoloDeviceId_(deviceId);
  const numericScore = Math.round(Number(score || 0) * 10) / 10;
  const numericCorrect = Math.max(0, Math.floor(Number(correct || 0)));

  if (!problem || problem === SOLO_RANKING_SHEET) {
    throw new Error('문제 시트 이름이 올바르지 않습니다.');
  }
  if (name.length !== 3 || SOLO_RANKING_FORBIDDEN.has(name)) {
    throw new Error('사용할 수 없는 랭킹 이름입니다.');
  }
  if (!device) {
    throw new Error('기기 식별 정보를 확인할 수 없습니다.');
  }
  if (!Number.isFinite(numericScore) || numericScore < 0) {
    throw new Error('점수 값이 올바르지 않습니다.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getSoloRankingSheet_();
    const lastRowBefore = sheet.getLastRow();
    const existingRows = [];

    if (lastRowBefore >= 2) {
      const values = sheet.getRange(2, 1, lastRowBefore - 1, 8).getValues();
      values.forEach((r, idx) => {
        const rowProblem = canonicalRankingProblemName_(r[0]);
        const rowDevice = normalizeSoloDeviceId_(r[7]);
        if (rowProblem === problem && rowDevice === device) {
          existingRows.push(idx + 2);
        }
      });
    }

    // Destructive replacement never happens before the client confirms it.
    if (existingRows.length > 0 && !replaceConfirmed) {
      const firstRow = sheet.getRange(existingRows[0], 1, 1, 8).getValues()[0];
      return {
        requiresReplace: true,
        existing: {
          name: String(firstRow[1] || ''),
          score: Number(firstRow[2] || 0),
          correct: Number(firstRow[3] || 0)
        }
      };
    }

    const updated = existingRows.length > 0;

    // Same device + same cartridge must never occupy more than one row.
    existingRows
      .sort((a, b) => b - a)
      .forEach(rowNum => sheet.deleteRow(rowNum));

    const now = new Date();
    const timestampMs = now.getTime();
    const entryId = Utilities.getUuid()
      .replace(/-/g, '')
      .slice(0, 12)
      .toUpperCase();

    sheet.appendRow([
      problem,
      name,
      numericScore,
      numericCorrect,
      now,
      entryId,
      timestampMs,
      device
    ]);

    const allRows = getSoloRankingRows_(problem);
    const kept = allRows.slice(0, SOLO_RANKING_MAX_KEEP);
    const keptIds = new Set(kept.map(r => r.id));

    // This cartridge still keeps only TOP 25 overall.
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      const rowsToDelete = [];

      values.forEach((r, idx) => {
        const rowProblem = canonicalRankingProblemName_(r[0]);
        const rowId = String(r[5] || '');
        if (rowProblem === problem && !keptIds.has(rowId)) {
          rowsToDelete.push(idx + 2);
        }
      });

      rowsToDelete
        .sort((a, b) => b - a)
        .forEach(rowNum => sheet.deleteRow(rowNum));
    }

    const rankIndex = kept.findIndex(r => r.id === entryId);
    invalidateSoloRankCacheV106_(problem);

    return {
      requiresReplace: false,
      updated: updated,
      entryId: rankIndex >= 0 ? entryId : '',
      rank: rankIndex >= 0 ? rankIndex + 1 : 0,
      rankings: kept.slice(0, SOLO_RANKING_VISIBLE).map(r => ({
        id: r.id,
        name: r.name,
        score: r.score,
        correct: r.correct,
        time: r.time
      }))
    };
  } finally {
    lock.releaseLock();
  }
}


/* =========================================================
   교사용 스프레드시트 랭킹 관리 메뉴
   학생이 실행하는 웹앱에는 나타나지 않음
   ========================================================= */

/**
* 스프레드시트를 열 때 상단에 "랭킹 관리" 메뉴 생성
*/
function onOpen() {
  const ss = getQuizSpreadsheet_();

  // 더 이상 사용하지 않는 STATE 시트가 있으면 자동 삭제
  const stateSheet = ss.getSheetByName('STATE');
  if (stateSheet) {
    try {
      ss.deleteSheet(stateSheet);
    } catch (e) {
      Logger.log('STATE 시트 삭제 실패: ' + e.toString());
    }
  }

  // 기존 모둠점수 시트도 자동 숨김
  const teamSheet = ss.getSheetByName('모둠점수');
  if (teamSheet) {
    try {
      teamSheet.hideSheet();
    } catch (e) {
      Logger.log('모둠점수 시트 숨김 실패: ' + e.toString());
    }
  }

  
}


/**
* 현재 선택 중인 문제 탭(카트리지)의 SOLO 랭킹만 삭제
*/

/**
* 모든 카트리지의 SOLO 랭킹 전체 삭제
* 실수 방지를 위해 2단계 확인
*/


/* =========================================================
   📦 카트리지 관리 메뉴
   - Project A Cleanup RC1: legacy .smq transfer/import/export removed.
   - RC2: Project B Manager is the sole order/lock writer.
   - Project A organizer is retained only for legacy cartridge deletion.
   ========================================================= */








/* ============================================================================
 * RC3 — STUDENT PRIVATE REPOSITORY ADAPTER
 * Project B remains frozen. Project A reads the existing B Registry/private
 * repositories through a separate, read-only cartridge path. Ranking writes
 * are isolated to _SMQ_RANKING and require a server-issued HARD+Single run token.
 * ========================================================================== */
const PLAYER_PRIVATE_REGISTRY_ID_KEY_RC3 = 'SMQ_PLAYER_PRIVATE_REGISTRY_ID_RC3';
const PLAYER_PRIVATE_REGISTRY_NAME_RC3 = 'SMQ_SYSTEM_REGISTRY';
const PLAYER_PRIVATE_REGISTRY_SHEET_RC3 = 'REPOSITORIES';
const PLAYER_PRIVATE_TOKEN_PREFIX_RC3 = 'SMQ_PLAYER_REPO_RC3_';
const PLAYER_PRIVATE_RUN_PREFIX_RC3 = 'SMQ_PLAYER_RUN_RC3_';
const PLAYER_PRIVATE_TOKEN_TTL_RC3 = 1800;
const PLAYER_PRIVATE_RUN_TTL_RC3 = 7200;
const PLAYER_PRIVATE_LOCK_PREFIX_RC3 = '🔒 ';
const PLAYER_PRIVATE_RANK_HEADERS_RC3 = [
  'cartridgeId','playerName','score','correct','total','elapsedMs',
  'deviceId','submissionId','createdAt','entryId','status'
];

/**
 * One-time Project A setup. Run manually from the Apps Script editor as owner.
 * It finds exactly one existing B Registry by its frozen file name and stores
 * only its spreadsheet ID in Project A Script Properties.
 */
function setupPlayerPrivateRegistryRC3() {
  const files = DriveApp.getFilesByName(PLAYER_PRIVATE_REGISTRY_NAME_RC3);
  const ids = [];
  while (files.hasNext()) {
    const f = files.next();
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) ids.push(f.getId());
  }
  if (ids.length !== 1) {
    throw new Error('SMQ_SYSTEM_REGISTRY를 정확히 1개 찾을 수 있어야 합니다. 현재: ' + ids.length);
  }
  validatePlayerPrivateRegistryRC3_(ids[0]);
  PropertiesService.getScriptProperties().setProperty(PLAYER_PRIVATE_REGISTRY_ID_KEY_RC3, ids[0]);
  return {ok:true, registrySpreadsheetId:ids[0]};
}

function validatePlayerPrivateRegistryRC3_(id) {
  const ss = SpreadsheetApp.openById(String(id||'').trim());
  const sh = ss.getSheetByName(PLAYER_PRIVATE_REGISTRY_SHEET_RC3);
  if (!sh || sh.getLastRow() < 1) throw new Error('Private Registry 형식이 올바르지 않습니다.');
  const h = sh.getRange(1,1,1,Math.max(7,sh.getLastColumn())).getDisplayValues()[0]
    .map(v=>String(v||'').trim());
  ['repositoryId','participationCode','repositorySpreadsheetId','status'].forEach(k=>{
    if (h.indexOf(k)<0) throw new Error('Private Registry 필수 열이 없습니다: '+k);
  });
  return sh;
}

function playerPrivateRegistryRC3_() {
  const id = String(PropertiesService.getScriptProperties()
    .getProperty(PLAYER_PRIVATE_REGISTRY_ID_KEY_RC3)||'').trim();
  if (!id) throw new Error('개인 카트리지 연결이 아직 준비되지 않았습니다.');
  return validatePlayerPrivateRegistryRC3_(id);
}

function normalizeParticipationCodeRC3_(value) {
  const s=String(value||'').trim();
  if (s.length!==5 || !/^[23456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz]{5}$/.test(s)) {
    throw new Error('참여 코드를 확인해 주세요.');
  }
  return s;
}

function findPrivateRegistryRowRC3_(participationCode, repositoryId) {
  const sh=playerPrivateRegistryRC3_();
  const lastCol=Math.max(7,sh.getLastColumn());
  const h=sh.getRange(1,1,1,lastCol).getDisplayValues()[0].map(v=>String(v||'').trim());
  const idx={
    repositoryId:h.indexOf('repositoryId'),
    participationCode:h.indexOf('participationCode'),
    repositorySpreadsheetId:h.indexOf('repositorySpreadsheetId'),
    status:h.indexOf('status'),
    creatorNickname:h.indexOf('creatorNickname')
  };
  const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,lastCol).getDisplayValues():[];
  const matches=rows.filter(r=>{
    if (participationCode && String(r[idx.participationCode]||'')!==String(participationCode)) return false;
    if (repositoryId && String(r[idx.repositoryId]||'')!==String(repositoryId)) return false;
    return true;
  });
  if (matches.length!==1) throw new Error('참여 코드를 확인해 주세요.');
  const r=matches[0];
  if (idx.status<0 || String(r[idx.status]||'').trim().toUpperCase()!=='ACTIVE') {
    throw new Error('현재 사용할 수 없는 개인 카트리지입니다.');
  }
  const repositorySpreadsheetId=String(r[idx.repositorySpreadsheetId]||'').trim();
  const repo=String(r[idx.repositoryId]||'').trim();
  if(!repositorySpreadsheetId||!repo) throw new Error('개인 카트리지 연결 정보가 올바르지 않습니다.');
  return {
    repositoryId:repo,
    participationCode:String(r[idx.participationCode]||''),
    repositorySpreadsheetId,
    creatorNickname:idx.creatorNickname>=0?String(r[idx.creatorNickname]||''):''
  };
}

function resolvePrivateParticipationCodeRC3(code) {
  const clean=normalizeParticipationCodeRC3_(code);
  const row=findPrivateRegistryRowRC3_(clean,'');
  // Prove Project A's effective account can open the target before issuing token.
  const ss=SpreadsheetApp.openById(row.repositorySpreadsheetId);
  ss.getName();

  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  const session={
    repositoryId:row.repositoryId,
    participationCode:row.participationCode,
    repositorySpreadsheetId:row.repositorySpreadsheetId,
    creatorNickname:row.creatorNickname,
    issuedAt:Date.now()
  };
  CacheService.getScriptCache().put(
    PLAYER_PRIVATE_TOKEN_PREFIX_RC3+token,
    JSON.stringify(session),
    PLAYER_PRIVATE_TOKEN_TTL_RC3
  );
  return {
    token,
    repositoryId:session.repositoryId,
    creatorNickname:session.creatorNickname,
    expiresInSeconds:PLAYER_PRIVATE_TOKEN_TTL_RC3
  };
}

function getPrivatePlayerSessionRC3_(token) {
  const t=String(token||'').trim();
  if(!t) throw new Error('개인 카트리지 연결이 만료되었습니다.');
  const raw=CacheService.getScriptCache().get(PLAYER_PRIVATE_TOKEN_PREFIX_RC3+t);
  if(!raw) throw new Error('개인 카트리지 연결이 만료되었습니다. 참여 코드를 다시 입력해 주세요.');
  let session;
  try{session=JSON.parse(raw);}catch(_){throw new Error('개인 카트리지 연결이 올바르지 않습니다.');}
  const current=findPrivateRegistryRowRC3_('',session.repositoryId);
  if(String(current.repositorySpreadsheetId)!==String(session.repositorySpreadsheetId)){
    throw new Error('개인 카트리지 연결이 변경되었습니다. 참여 코드를 다시 입력해 주세요.');
  }
  return session;
}

function isPrivateSystemSheetRC3_(name) {
  const n=String(name||'').trim();
  if(/^_SMQ_/i.test(n)) return true;
  return isSystemSheetName_(stripGameLockPrefix_(n));
}
function isPrivateLockedRC3_(sheet) {
  return !!sheet && String(sheet.getName()||'').trim().indexOf(PLAYER_PRIVATE_LOCK_PREFIX_RC3)===0;
}
function privateVisibleNameRC3_(name) {
  let s=String(name||'').trim();
  while(s.indexOf(PLAYER_PRIVATE_LOCK_PREFIX_RC3)===0) s=s.slice(PLAYER_PRIVATE_LOCK_PREFIX_RC3.length).trim();
  return s;
}
function getPrivateCartridgeByNameRC3_(ss,requestedName) {
  const wanted=String(requestedName||'').trim();
  const matches=ss.getSheets().filter(sh=>privateVisibleNameRC3_(sh.getName())===wanted);
  if(matches.length!==1) throw new Error('이 개인 저장소의 카트리지를 찾을 수 없습니다.');
  const sh=matches[0];
  if(isPrivateSystemSheetRC3_(sh.getName())||isPrivateLockedRC3_(sh)){
    throw new Error('이 카트리지는 현재 사용할 수 없습니다.');
  }
  return sh;
}

function getPrivateCartridgeByIdRC3_(ss,cartridgeId) {
  const id=String(cartridgeId||'').trim();
  if(!/^\d+$/.test(id)) throw new Error('카트리지 식별 정보가 올바르지 않습니다.');
  const sh=ss.getSheetById(Number(id));
  if(!sh || isPrivateSystemSheetRC3_(sh.getName()) || isPrivateLockedRC3_(sh)){
    throw new Error('이 카트리지는 현재 사용할 수 없습니다.');
  }
  return sh;
}

function getPrivateGameSheetsListRC3(token) {
  const session=getPrivatePlayerSessionRC3_(token);
  const cacheKey='SMQ_PRIVATE_LIST_RC3_'+session.repositoryId;
  const cached=safeCacheGetJsonV106_(cacheKey);
  if(Array.isArray(cached)) return cached;
  const ss=SpreadsheetApp.openById(session.repositorySpreadsheetId);
  const result=ss.getSheets()
    .filter(sh=>
      !isPrivateSystemSheetRC3_(sh.getName()) &&
      !isPrivateLockedRC3_(sh) &&
      hasGameQuestionRowsForCatalog_(sh)
    )
    .map(sh=>privateVisibleNameRC3_(sh.getName()));
  safeCachePutJsonV106_(cacheKey,result,30);
  return result;
}

function privateGameDataCacheKeyRC3_(repositoryId,sheetId) {
  return 'SMQ_PRIVATE_DATA_RC3_'+String(repositoryId)+'_'+String(sheetId);
}
function buildPrivateGameDataRC3_(session,sheetName) {
  const ss=SpreadsheetApp.openById(session.repositorySpreadsheetId);
  const sh=getPrivateCartridgeByNameRC3_(ss,sheetName);
  const cacheKey=privateGameDataCacheKeyRC3_(session.repositoryId,sh.getSheetId());
  const cached=safeCacheGetJsonV106_(cacheKey);
  if(cached&&Array.isArray(cached.questions)&&cached.questionSchemaVersion===2)return cached;
  const parsed=readGameQuestionRowsV2_(sh);
  const questions=parsed.questions.map((q,idx)=>({
    num:idx+1,sourceNum:idx+1,familyId:q.familyId,familyOrder:q.familyOrder,
    variantType:q.variantType,type:q.type,question:q.question,answer:q.answer,
    options:q.options,explanation:q.explanation,isNull:false
  }));
  const payload={
    questionSchemaVersion:2,sourceSheetVersion:parsed.sheetVersion,
    cartridgeId:String(sh.getSheetId()),questions,teams:[],solvedList:[],tileOwners:{}
  };
  safeCachePutJsonV106_(cacheKey,payload,60);
  return payload;
}
function getPrivateGameDataBySheetRC3(token,sheetName){
  const session=getPrivatePlayerSessionRC3_(token);
  return buildPrivateGameDataRC3_(session,sheetName);
}
function getPrivateGameDataBySheetsRC3(token,sheetNames){
  const session=getPrivatePlayerSessionRC3_(token);
  const names=Array.isArray(sheetNames)?sheetNames.map(v=>String(v||'').trim()).filter(Boolean):[];
  const unique=[...new Set(names)];
  if(!unique.length)throw new Error('선택된 카트리지가 없습니다.');
  if(unique.length>5)throw new Error('카트리지는 최대 5개까지 선택할 수 있습니다.');
  return unique.map(n=>({sheetName:n,data:buildPrivateGameDataRC3_(session,n)}));
}

function buildPrivateGameDataByIdRC3_(session,cartridgeId){
  const ss=SpreadsheetApp.openById(session.repositorySpreadsheetId);
  const sh=getPrivateCartridgeByIdRC3_(ss,cartridgeId);
  const cacheKey=privateGameDataCacheKeyRC3_(session.repositoryId,sh.getSheetId());
  const cached=safeCacheGetJsonV106_(cacheKey);
  if(cached&&Array.isArray(cached.questions)&&cached.questionSchemaVersion===2)return cached;
  const parsed=readGameQuestionRowsV2_(sh);
  const questions=parsed.questions.map((q,idx)=>({
    num:idx+1,sourceNum:idx+1,familyId:q.familyId,familyOrder:q.familyOrder,
    variantType:q.variantType,type:q.type,question:q.question,answer:q.answer,
    options:q.options,explanation:q.explanation,isNull:false
  }));
  const payload={
    questionSchemaVersion:2,sourceSheetVersion:parsed.sheetVersion,
    cartridgeId:String(sh.getSheetId()),questions,teams:[],solvedList:[],tileOwners:{}
  };
  safeCachePutJsonV106_(cacheKey,payload,60);
  return payload;
}
function getPrivateGameDataByCartridgeRC3(token,cartridgeId){
  const session=getPrivatePlayerSessionRC3_(token);
  return buildPrivateGameDataByIdRC3_(session,cartridgeId);
}
function getPrivateGameDataByCartridgesRC3(token,cartridgeIds){
  const session=getPrivatePlayerSessionRC3_(token);
  const ids=Array.isArray(cartridgeIds)?cartridgeIds.map(v=>String(v||'').trim()).filter(Boolean):[];
  const unique=[...new Set(ids)];
  if(!unique.length)throw new Error('선택된 카트리지가 없습니다.');
  if(unique.length>5)throw new Error('카트리지는 최대 5개까지 선택할 수 있습니다.');
  return unique.map(id=>({cartridgeId:id,data:buildPrivateGameDataByIdRC3_(session,id)}));
}

function privateRankingRowsRC3_(ss,cartridgeId){
  const sh=ss.getSheetByName('_SMQ_RANKING');
  if(!sh||sh.getLastRow()<2)return [];
  const h=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),PLAYER_PRIVATE_RANK_HEADERS_RC3.length))
    .getDisplayValues()[0].map(v=>String(v||'').trim());
  if(!PLAYER_PRIVATE_RANK_HEADERS_RC3.every((v,i)=>h[i]===v)){
    throw new Error('개인 랭킹 형식이 올바르지 않습니다.');
  }
  return sh.getRange(2,1,sh.getLastRow()-1,PLAYER_PRIVATE_RANK_HEADERS_RC3.length).getValues()
    .filter(r=>String(r[0])===String(cartridgeId)&&String(r[10]||'ACTIVE').toUpperCase()!=='DELETED')
    .map(r=>({
      id:String(r[9]||''),name:String(r[1]||'---'),score:Number(r[2])||0,
      correct:Number(r[3])||0,time:r[8] instanceof Date?r[8].getTime():new Date(r[8]).getTime()||0,
      elapsedMs:Number(r[5])||0,deviceId:String(r[6]||'')
    }))
    .sort((a,b)=>(b.score-a.score)||(b.correct-a.correct)||(a.elapsedMs-b.elapsedMs)||(a.time-b.time));
}
function getPrivateSoloRankingsRC3(token,sheetName){
  const session=getPrivatePlayerSessionRC3_(token);
  const ss=SpreadsheetApp.openById(session.repositorySpreadsheetId);
  const sh=getPrivateCartridgeByNameRC3_(ss,sheetName);
  const key='SMQ_PRIVATE_RANK_RC3_'+session.repositoryId+'_'+sh.getSheetId();
  const cached=safeCacheGetJsonV106_(key);
  if(Array.isArray(cached))return cached;
  const rows=privateRankingRowsRC3_(ss,String(sh.getSheetId())).slice(0,25)
    .map(r=>({id:r.id,name:r.name,score:r.score,correct:r.correct,time:r.time}));
  safeCachePutJsonV106_(key,rows,20);
  return rows;
}

function getPrivateSoloRankingsByCartridgeRC3(token,cartridgeId){
  const session=getPrivatePlayerSessionRC3_(token);
  const ss=SpreadsheetApp.openById(session.repositorySpreadsheetId);
  const sh=getPrivateCartridgeByIdRC3_(ss,cartridgeId);
  const key='SMQ_PRIVATE_RANK_RC3_'+session.repositoryId+'_'+sh.getSheetId();
  const cached=safeCacheGetJsonV106_(key);
  if(Array.isArray(cached))return cached;
  const rows=privateRankingRowsRC3_(ss,String(sh.getSheetId())).slice(0,25)
    .map(r=>({id:r.id,name:r.name,score:r.score,correct:r.correct,time:r.time}));
  safeCachePutJsonV106_(key,rows,20);
  return rows;
}

function createPrivateSoloRankingSessionRC3(token,sheetName,difficulty,selectedCount){
  const session=getPrivatePlayerSessionRC3_(token);
  if(String(difficulty||'').toUpperCase()!=='HARD'||Number(selectedCount)!==1){
    throw new Error('이 플레이는 개인 랭킹 대상이 아닙니다.');
  }
  const ss=SpreadsheetApp.openById(session.repositorySpreadsheetId);
  const sh=getPrivateCartridgeByNameRC3_(ss,sheetName);
  const runToken=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put(
    PLAYER_PRIVATE_RUN_PREFIX_RC3+runToken,
    JSON.stringify({
      repositoryId:session.repositoryId,
      repositoryToken:String(token),
      cartridgeId:String(sh.getSheetId()),
      sheetName:privateVisibleNameRC3_(sh.getName()),
      difficulty:'HARD',selectedCount:1,issuedAt:Date.now()
    }),
    PLAYER_PRIVATE_RUN_TTL_RC3
  );
  return {runToken};
}
function createPrivateSoloRankingSessionByCartridgeRC3(token,cartridgeId,difficulty,selectedCount){
  const session=getPrivatePlayerSessionRC3_(token);
  if(String(difficulty||'').toUpperCase()!=='HARD'||Number(selectedCount)!==1){
    throw new Error('이 플레이는 개인 랭킹 대상이 아닙니다.');
  }
  const ss=SpreadsheetApp.openById(session.repositorySpreadsheetId);
  const sh=getPrivateCartridgeByIdRC3_(ss,cartridgeId);
  const runToken=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  CacheService.getScriptCache().put(
    PLAYER_PRIVATE_RUN_PREFIX_RC3+runToken,
    JSON.stringify({
      repositoryId:session.repositoryId,
      repositoryToken:String(token),
      cartridgeId:String(sh.getSheetId()),
      sheetName:privateVisibleNameRC3_(sh.getName()),
      difficulty:'HARD',selectedCount:1,issuedAt:Date.now()
    }),
    PLAYER_PRIVATE_RUN_TTL_RC3
  );
  return {runToken};
}
function getPrivateRunRC3_(runToken){
  const key=PLAYER_PRIVATE_RUN_PREFIX_RC3+String(runToken||'').trim();
  const raw=CacheService.getScriptCache().get(key);
  if(!raw)throw new Error('랭킹 게임 세션이 만료되었습니다.');
  let run;try{run=JSON.parse(raw);}catch(_){throw new Error('랭킹 게임 세션이 올바르지 않습니다.');}
  if(run.difficulty!=='HARD'||Number(run.selectedCount)!==1)throw new Error('랭킹 대상 게임이 아닙니다.');
  const repo=getPrivatePlayerSessionRC3_(run.repositoryToken);
  if(String(repo.repositoryId)!==String(run.repositoryId))throw new Error('랭킹 저장소가 일치하지 않습니다.');
  return {run,repo,key};
}
function privateRankingSubmissionFingerprintRC36_(playerName,score,correct,total,elapsedMs,deviceId,replaceConfirmed){
  const raw=JSON.stringify([
    normalizeSoloRankName_(playerName),
    Math.round(Number(score||0)*10)/10,
    Math.max(0,Math.floor(Number(correct||0))),
    Math.max(0,Math.floor(Number(total||0))),
    Math.max(0,Math.floor(Number(elapsedMs||0))),
    normalizeSoloDeviceId_(deviceId),
    !!replaceConfirmed
  ]);
  return cacheKeyHashV106_(raw);
}
function savePrivateSoloRankingRC3(runToken,playerName,score,correct,total,elapsedMs,deviceId,replaceConfirmed){
  const name=normalizeSoloRankName_(playerName);
  const device=normalizeSoloDeviceId_(deviceId);
  const numericScore=Math.round(Number(score||0)*10)/10;
  const numericCorrect=Math.max(0,Math.floor(Number(correct||0)));
  if(name.length!==3||SOLO_RANKING_FORBIDDEN.has(name))throw new Error('사용할 수 없는 랭킹 이름입니다.');
  if(!device)throw new Error('기기 식별 정보를 확인할 수 없습니다.');
  if(!Number.isFinite(numericScore)||numericScore<0)throw new Error('점수 값이 올바르지 않습니다.');

  const fingerprint=privateRankingSubmissionFingerprintRC36_(
    playerName,score,correct,total,elapsedMs,deviceId,replaceConfirmed
  );
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    // RC3.6: validate the run again under the same lock that owns the write.
    // A completed run remains in cache with its exact response so a network-loss
    // retry is idempotent, while a different submission cannot reuse the token.
    const ctx=getPrivateRunRC3_(runToken), run=ctx.run, repo=ctx.repo;
    if(run.consumed===true){
      if(String(run.submissionFingerprint||'')!==fingerprint || !run.submissionResult){
        throw new Error('이미 사용된 랭킹 게임 세션입니다.');
      }
      return run.submissionResult;
    }

    const ss=SpreadsheetApp.openById(repo.repositorySpreadsheetId);
    const sh=ss.getSheetById(Number(run.cartridgeId));
    if(!sh||isPrivateSystemSheetRC3_(sh.getName())||isPrivateLockedRC3_(sh))throw new Error('카트리지를 사용할 수 없습니다.');
    const rank=ss.getSheetByName('_SMQ_RANKING');
    if(!rank)throw new Error('개인 랭킹 저장소가 준비되지 않았습니다.');
    const headers=rank.getRange(1,1,1,Math.max(rank.getLastColumn(),PLAYER_PRIVATE_RANK_HEADERS_RC3.length))
      .getDisplayValues()[0].map(v=>String(v||'').trim());
    if(!PLAYER_PRIVATE_RANK_HEADERS_RC3.every((v,i)=>headers[i]===v))throw new Error('개인 랭킹 형식이 올바르지 않습니다.');

    const rows=rank.getLastRow()>1?rank.getRange(2,1,rank.getLastRow()-1,PLAYER_PRIVATE_RANK_HEADERS_RC3.length).getValues():[];
    const existing=[];
    rows.forEach((r,i)=>{
      if(String(r[0])===String(run.cartridgeId)&&String(r[6]||'')===device&&String(r[10]||'ACTIVE').toUpperCase()!=='DELETED')existing.push(i+2);
    });
    if(existing.length&&!replaceConfirmed){
      const r=rank.getRange(existing[0],1,1,PLAYER_PRIVATE_RANK_HEADERS_RC3.length).getValues()[0];
      // Do NOT consume here: the confirmed replacement is a second request.
      return {requiresReplace:true,existing:{name:String(r[1]||''),score:Number(r[2])||0,correct:Number(r[3])||0}};
    }
    const updated=existing.length>0;
    existing.sort((a,b)=>b-a).forEach(n=>rank.deleteRow(n));
    const now=new Date();
    const entryId=Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    const submissionId=Utilities.getUuid().replace(/-/g,'').slice(0,16).toUpperCase();
    rank.appendRow([
      String(run.cartridgeId),name,numericScore,numericCorrect,Math.max(0,Math.floor(Number(total||0))),
      Math.max(0,Math.floor(Number(elapsedMs||0))),device,submissionId,now,entryId,'ACTIVE'
    ]);
    let all=privateRankingRowsRC3_(ss,String(run.cartridgeId));
    const keep=all.slice(0,25), keepIds=new Set(keep.map(r=>r.id));
    for(let r=rank.getLastRow();r>=2;r--){
      const v=rank.getRange(r,1,1,11).getValues()[0];
      if(String(v[0])===String(run.cartridgeId)&&String(v[10]||'ACTIVE').toUpperCase()!=='DELETED'&&!keepIds.has(String(v[9]||'')))rank.deleteRow(r);
    }
    all=privateRankingRowsRC3_(ss,String(run.cartridgeId)).slice(0,25);
    const idx=all.findIndex(r=>r.id===entryId);
    CacheService.getScriptCache().remove('SMQ_PRIVATE_RANK_RC3_'+repo.repositoryId+'_'+run.cartridgeId);
    const result={
      requiresReplace:false,updated,entryId:idx>=0?entryId:'',rank:idx>=0?idx+1:0,
      rankings:all.map(r=>({id:r.id,name:r.name,score:r.score,correct:r.correct,time:r.time}))
    };

    // Consume only after the ranking write has completed successfully. Keep the
    // exact result for idempotent retries caused by a lost client response.
    run.consumed=true;
    run.consumedAt=Date.now();
    run.submissionFingerprint=fingerprint;
    run.submissionResult=result;
    CacheService.getScriptCache().put(ctx.key,JSON.stringify(run),PLAYER_PRIVATE_RUN_TTL_RC3);
    return result;
  }finally{lock.releaseLock();}
}



/* =========================================================
   U1 — anonymous usage telemetry (append-only event log)
   2026-09-22
   - Dedicated telemetry Spreadsheet; never uses quiz/repository storage.
   - Game-start telemetry is best-effort and is not a gameplay dependency.
   - No email, account, IP, student name, score, answer, or question text.
   ========================================================= */
const SMQ_USAGE_SPREADSHEET_ID_KEY_U1 = 'SMQ_USAGE_SPREADSHEET_ID';
const SMQ_USAGE_SHEET_U1 = 'EVENT_LOG';
const SMQ_USAGE_HEADERS_U1 = [
  'eventId','timestamp','date','mode','repositoryKind','grade','subject','publisher',
  'cartridge','cartridgeCount','teamCount','cartridgeIds',
  'publicRepositoryNamespace','usageSchemaVersion','cartridgeTitlesJson'
];

/**
 * ONE-TIME SETUP (run manually from the Apps Script editor).
 * Creates the dedicated Usage spreadsheet and stores its id in Script Properties.
 * Safe to re-run: if an id is already configured, it returns that id unchanged.
 */
function setupUsageTelemetryStorageU1() {
  const props = PropertiesService.getScriptProperties();
  const existing = String(props.getProperty(SMQ_USAGE_SPREADSHEET_ID_KEY_U1) || '').trim();
  if (existing) return { ok:true, spreadsheetId:existing, created:false };

  const ss = SpreadsheetApp.create('SMQ_USAGE_TELEMETRY');
  const sh = ss.getSheets()[0];
  sh.setName(SMQ_USAGE_SHEET_U1);
  sh.getRange(1, 1, 1, SMQ_USAGE_HEADERS_U1.length).setValues([SMQ_USAGE_HEADERS_U1]);
  sh.setFrozenRows(1);
  props.setProperty(SMQ_USAGE_SPREADSHEET_ID_KEY_U1, ss.getId());
  return { ok:true, spreadsheetId:ss.getId(), created:true };
}

function smqUsageSafeTextU1_(value, maxLen) {
  return String(value == null ? '' : value).replace(/[\r\n\t]+/g, ' ').trim().slice(0, maxLen);
}

/**
 * U3 — canonical PUBLIC cartridge validation for telemetry.
 *
 * The client-provided repositoryKind/title is not sufficient authority.
 * Every telemetry event must carry stable public sheet IDs obtained from the
 * actual game-data response. The server resolves those IDs again against the
 * live PUBLIC Player repository and derives the stored title itself.
 */
function smqResolvePublicUsageCartridgesU3_(cartridgeIds, expectedCount) {
  const ids = Array.isArray(cartridgeIds)
    ? cartridgeIds.map(v => String(v == null ? '' : v).trim()).filter(Boolean)
    : [];

  const unique = [...new Set(ids)];
  const expected = Math.max(1, Math.min(5, Math.floor(Number(expectedCount) || 1)));

  if (!unique.length || unique.length !== expected) {
    throw new Error('USAGE_PUBLIC_CARTRIDGE_ID_REQUIRED');
  }

  const publicSs = getQuizSpreadsheet_();
  const lockState = getGameLockState_();
  const resolved = unique.map(id => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) throw new Error('USAGE_PUBLIC_CARTRIDGE_ID_INVALID');

    const sh = publicSs.getSheetById(numericId);
    if (!sh) throw new Error('USAGE_PUBLIC_CARTRIDGE_NOT_FOUND');

    const rawName = String(sh.getName() || '').trim();
    const visibleName = stripGameLockPrefix_(rawName);
    const locked =
      lockState[String(sh.getSheetId())] === true ||
      rawName.indexOf(GAME_LOCK_PREFIX) === 0;

    if (
      locked ||
      isSystemSheetName_(visibleName) ||
      !hasGameQuestionRowsForCatalog_(sh)
    ) {
      throw new Error('USAGE_PUBLIC_CARTRIDGE_NOT_PLAYABLE');
    }

    return {
      id: String(sh.getSheetId()),
      name: visibleName
    };
  });

  return resolved;
}

function smqEnsureUsageTelemetryHeaderU3_(sh) {
  const required = SMQ_USAGE_HEADERS_U1.length;
  const current = sh.getLastColumn();
  if (current < required) {
    sh.getRange(1, current + 1, 1, required - current)
      .setValues([SMQ_USAGE_HEADERS_U1.slice(current)]);
  }
}

/**
 * Append exactly one anonymous PUBLIC game-start event.
 * PRIVATE events from older clients are silently ignored.
 * Intentionally append-only: no aggregate mutation and no gameplay dependency.
 */
function recordUsageStartU1(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const eventId = smqUsageSafeTextU1_(p.eventId, 80);
  const mode = smqUsageSafeTextU1_(p.mode, 8).toUpperCase();
  const repositoryKind = smqUsageSafeTextU1_(p.repositoryKind, 8).toUpperCase();

  if (!eventId) throw new Error('USAGE_EVENT_ID_REQUIRED');
  if (mode !== 'TEAM' && mode !== 'SOLO') throw new Error('USAGE_MODE_INVALID');

  /* U3 receive-side hard boundary:
     - old PRIVATE clients may still call this RPC -> ignore, never store.
     - missing/unknown values are not treated as PUBLIC. */
  if (repositoryKind === 'PRIVATE') {
    return { ok:true, ignored:true, reason:'PRIVATE_NOT_COLLECTED' };
  }
  if (repositoryKind !== 'PUBLIC') {
    throw new Error('USAGE_REPOSITORY_INVALID');
  }

  const cartridgeCountRaw = Number(p.cartridgeCount);
  const cartridgeCount = Number.isFinite(cartridgeCountRaw) && cartridgeCountRaw >= 1
    ? Math.min(5, Math.floor(cartridgeCountRaw)) : 1;

  /* Validate live PUBLIC identity before entering the append lock. */
  const publicCartridges = smqResolvePublicUsageCartridgesU3_(
    p.cartridgeIds,
    cartridgeCount
  );
  const canonicalCartridgeNames = publicCartridges.map(x => x.name);
  const canonicalCartridgeIds = publicCartridges.map(x => x.id);

  const publicSs = getQuizSpreadsheet_();
  const publicRepositoryNamespace = 'PUBLIC:' + String(publicSs.getId() || '').trim();
  if (!/^PUBLIC:.+/.test(publicRepositoryNamespace)) {
    throw new Error('USAGE_PUBLIC_NAMESPACE_INVALID');
  }

  const spreadsheetId = String(
    PropertiesService.getScriptProperties().getProperty(SMQ_USAGE_SPREADSHEET_ID_KEY_U1) || ''
  ).trim();
  if (!spreadsheetId) throw new Error('USAGE_STORAGE_NOT_CONFIGURED');

  const ss = SpreadsheetApp.openById(spreadsheetId);
  const sh = ss.getSheetByName(SMQ_USAGE_SHEET_U1);
  if (!sh) throw new Error('USAGE_SHEET_NOT_FOUND');
  smqEnsureUsageTelemetryHeaderU3_(sh);

  const gradeRaw = Number(p.grade);
  const grade = Number.isFinite(gradeRaw) && gradeRaw >= 3 && gradeRaw <= 6
    ? Math.floor(gradeRaw) : '';
  const teamCountRaw = Number(p.teamCount);
  const teamCount = mode === 'TEAM'
    ? (Number.isFinite(teamCountRaw) ? Math.max(2, Math.min(6, Math.floor(teamCountRaw))) : '')
    : 1;

  /* U3-S1 accepted-at boundary:
     timestamp/date are assigned only after the SAME Project A ScriptLock is
     acquired. append + SpreadsheetApp.flush() finish before the lock is released.
     Thus the permanent date means "server append accepted at", not browser time. */
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('USAGE_APPEND_LOCK_TIMEOUT');

  try {
    const now = new Date();
    const dateKey = Utilities.formatDate(now, 'Asia/Seoul', 'yyyy-MM-dd');

    sh.appendRow([
      eventId,
      now,
      dateKey,
      mode,
      'PUBLIC',
      grade,
      smqUsageSafeTextU1_(p.subject, 20),
      smqUsageSafeTextU1_(p.publisher, 60),
      smqUsageSafeTextU1_(canonicalCartridgeNames.join(' | '), 500),
      canonicalCartridgeIds.length,
      teamCount,
      canonicalCartridgeIds.join('|'),
      publicRepositoryNamespace,
      'U3S1',
      JSON.stringify(canonicalCartridgeNames)
    ]);

    SpreadsheetApp.flush();

    return {
      ok:true,
      repositoryKind:'PUBLIC',
      cartridgeCount:canonicalCartridgeIds.length,
      usageSchemaVersion:'U3S1'
    };
  } finally {
    lock.releaseLock();
  }
}
