# 40-6-U0 — Project A 단일 GAS 공개 통계 설계 (Claude 구현자 작성, 독립 감수 전)

> 작성 2026-11-23 KST. 정본 지시서 `docs/HOJA_USAGE_V4_40_6_UNIFIED_A_CLAUDE_DIRECTIVE_20261123.md` rev.2 기준.
> **이 문서는 설계 기록이며 승인이 아니다.** 운영 GAS·운영 EVENT_LOG·랭킹·배포·트리거·교실매니저 실제 제거는 변경하지 않았다.

## 0. 시작점과 작업 격리

| 항목 | 값 |
|---|---|
| 기준 브랜치 | `work/unified-quiz-renderer-20261122` @ `d72964f` |
| 작업 브랜치 | `work/usage-v4-40-6-u-20261123` (신규, 기준 브랜치에서 분기) |
| 기존 40-6-U 분기/PR | 없음 (원격 브랜치·PR 목록 확인. 열린 PR은 무관한 #1 기술감사 1건) |
| 운영 후보 소스 | 루트 `Code.gs`/`UsageRollupU3S.gs`, 보관 `versions/2.0.0/` — **수정하지 않음** |
| 신규 통합 소스 위치 | `experimental/usage-v4-unified/` (격리 시험용 단일 Project A GAS 소스 묶음) |

루트 `Code.gs`는 운영 후보이므로 그대로 두고, 통합본은 별도 디렉터리에서 루트 `Code.gs`를 복제·수정한다. 감수자는 `diff Code.gs experimental/usage-v4-unified/gas/Code.gs`로 변경 범위를 확인할 수 있다. `Game.html`(7.2MB)은 복제하지 않고 `versions/2.0.0/Game.html.parts`에서 SHA-256 검증 후 조립한다(게임 바이트 불변).

## 1. 실제 공개 노출 경로 조사 (공격자 관점)

`appsscript.json`: `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`. 따라서 웹앱이 내려준 페이지에서 **익명 사용자가 `google.script.run.<이름>()`으로 프로젝트의 모든 최상위 함수 중 이름이 `_`로 끝나지 않는 함수를 소유자 권한으로 호출**할 수 있다. 화면에 버튼이 없어도 개발자 도구로 직접 호출 가능하다.

### 1-1. 게임이 실제 사용하는 RPC (Game.html 2.0.0 정적 조사)
`hojaListPublicCartridges`, `hojaGetPublicQuestions`, `hojaRankList`, `hojaRankSave`, `recordUsageStartU1` — 5개. 게임은 통계 RPC를 호출하지 않는다.

### 1-2. ⚠️ 발견 F-1 (기존 운영 후보, 심각도 높음 — 본 브랜치에서 운영 수정 안 함, HOLD)
`UsageRollupU3S.gs`(루트 및 `versions/2.0.0/` 동일)에 `_` 없는 공개 함수 9개가 있다.

| 함수 | 익명 직접 호출 시 효과 |
|---|---|
| `setupUsageRollupShadowU3S1` | 통계 저장 스프레드시트에 시트 생성, **응답으로 통계 저장소 spreadsheetId 반환(비밀값 유출)** |
| `runUsageRollupDateU3S1(dateKey)` / `...YesterdayU3S1` / `...DailyU3S1` | 소유자 권한으로 롤업 시트 쓰기, ScriptLock 점유(게임 기록 지연 유발) |
| `installUsageRollupDailyTriggerU3S1` | **소유자 계정에 시간 트리거 삭제·재설치** |
| `runUsageRollupParityDateU3S2` 외 3개 | EVENT_LOG 전체 읽기(쿼터 소모) 및 결과 반환 |

운영에 이 파일이 배포되어 있다면 **익명 사용자가 운영 저장소 ID 획득·트리거 조작·쓰기 실행이 가능**하다. 실제 배포 여부는 Claude가 확인할 수 없음(운영 GAS 미접근). 권고: 교사 승인 후 해당 함수명을 `_` 접미로 바꾸거나 파일을 운영 프로젝트에서 제거하는 별도 핫픽스. **본 작업은 운영 소스를 수정하지 않으며**, 신규 통합본에는 `UsageRollupU3S.gs`를 포함하지 않는다.

또한 `experimental/usage-retention/`의 V4 시험 함수 `hojaV4PreviewDailyTrialU1`, `hojaV4WriteDailyTrialU1`, `getUsageStatisticsU4TrialShadow`도 공개 이름이므로 통합본에 **이식 금지**(지시서도 `getUsageStatisticsU2`, `requireUsageStatisticsAccessU3_` 이식 금지).

### 1-3. 통합본 공개 함수 allowlist (CI 정적 시험으로 고정)
| 함수 | 성격 |
|---|---|
| `doGet(e)` | 게임 / `?view=stats` 공개 통계 페이지 분기 |
| `hojaListPublicCartridges`, `hojaGetPublicQuestions`, `hojaRankList`, `hojaRankSave` | 기존 게임 계약 그대로 |
| `recordUsageStartU1(payload)` | 기존 계약 + V4 Writer 가드(검증된 제한적 append만) |
| `getPublicUsageStatisticsV4()` | **인자 무시**, 고정 allowlist 응답의 읽기 전용 공개 집계 |
| `hojaV4OpsSealPendingDays()` | 운영자(편집기/트리거) 전용 일별 확정. 첫 문장에서 소유자 신원 가드, 익명 호출 시 `HOJA_V4_OPS_DENIED`. 결정적·멱등이므로 가드가 뚫려도 같은 결과만 생성 |
| `hojaV4OpsStatus()` | 운영자 전용 비공개 진단(같은 가드) |

그 외 모든 함수는 `_` 접미(원격 호출 불가). 시험은 통합 GAS 전 파일을 파싱해 공개 함수 집합이 위 목록과 **정확히 일치**함을 확인하고, Ops 함수는 첫 문장이 가드인지 확인한다.

Ops 가드: `Session.getActiveUser().getEmail()`이 비어 있지 않고 `Session.getEffectiveUser().getEmail()`과 같을 때만 허용. 익명 웹앱 호출은 활성 사용자 이메일이 빈 문자열이므로 거부된다. 이는 **공개 통계 조회 인증이 아니라** 쓰기성 유지보수 함수의 방어 계층이다(공개 조회는 인증 없음, 정책 0-3).

## 2. 공개 응답 allowlist와 소규모 셀·텍스트 위험

`getPublicUsageStatisticsV4()` 응답은 서버에서 **새 객체로 재구성**(입력 객체 전달 금지)한다.

```
{ schema:'HOJA_PUBLIC_USAGE_V4', status:'OK',
  asOf, historyStart, generatedAt,
  todayStatus:'LIVE_PROVISIONAL', historyStatus:'COMPLETE',
  provisionalDays:[날짜...],            // 아직 확정 전 날짜(오늘 + 자정 직후 미확정 전일)
  cache:{ageSeconds,maxAgeSeconds,stale},
  totals:{today,days7,days30,all},
  daily:[{date,count}],
  mode, grade, subject, publisher, topCartridges : [{label,count,share}] }
  // teamCount(팀전 팀 수 분포)는 2026-11-23 사용자 결정으로 공개 제외
```
오류는 `{schema, status:'UNAVAILABLE', code, generatedAt}`만 반환하며 **숫자 필드를 포함하지 않는다**(0으로 위장 금지). 오류 코드는 고정 코드표로 매핑하고 내부 메시지·행 번호·시트 이름은 노출하지 않는다.

비공개: eventId, 원본 행/개별 timestamp, 행 번호·watermark, 시트/스프레드시트 ID, Script Properties, `publicRepositoryNamespace`, `cartridgeIds`, `UNIT_SELECTION` 버킷 키, `retriesSuppressed`·`unknownUnitStarts` 등 감사용 메타.

라벨 정책(`topCartridges`, `publisher`):
- EVENT_LOG `cartridge` 열은 공개 카탈로그 시트 이름의 결합(` | `). 공개 카탈로그는 이미 게임 사용자에게 노출되는 이름이지만, 교사가 시트 이름에 학교명·사람 이름을 넣었을 가능성이 있다.
- 각 결합 구성요소가 `^[3-6]-(국어|영어|수학|사회|과학|도덕|음악|미술|체육|실과)-[^-|]{1,20}-.{1,60}$` 형식이고 이메일·URL·전화번호·`학교|초등|중학|선생|교사|학생|반` 표현이 없을 때만 원문 공개. 아니면 `기타 공개 카트리지`로 병합.
- 소규모 셀: `topCartridges` 항목 중 누적 횟수 `< 5`는 `기타(소수)`로 병합(k=5). 학년·교과·모드·팀 인원은 범주형 고정 라벨이라 공개. 일별 건수는 날짜 단위 총량이며 개인 식별 불가.
- 출판사 라벨은 30자 이하 한글/영문/숫자만, 위반 시 `기타`.

## 3. Writer (`recordUsageStartU1`) — 기존 계약 보존 + V4 가드
기존 검증(PUBLIC만, mode, team 2~7, cartridgeIds/Count, 카탈로그 공개 여부, 15열 스키마 헤더, `U3S1`)은 그대로. ScriptLock 내부에서 추가:
1. **commit watermark 복구 점검**: `W`(Script Property `HOJA_V4_COMMIT_WATERMARK`) < `getLastRow()`이면 W 이후 행을 완전성 검사 후 W 전진, 불완전하면 `USAGE_V4_UNCOMMITTED_TAIL_HOLD`로 거부(데이터는 그대로, 수동 검토).
2. **날짜 역행·확정일 보호**: 마지막 행 날짜 > 오늘(서버 KST)이면 거부. 오늘 ≤ 마지막 COMPLETE 날짜면 거부(`USAGE_V4_DAY_ALREADY_SEALED`).
3. **멱등·충돌**: eventId를 **최근 창**(마지막 COMPLETE 날짜의 직전 확정일 시작 행 ~ W)에서 `TextFinder`로 검색. 타임스탬프·날짜만 다른 동일 내용 → 신규 행 0(`duplicateIgnored`), 내용 다름 → `USAGE_EVENT_ID_CONFLICT`. V4 상태가 없을 때(초기화 전)는 전체 열 검색(시험용, 기존 trial guard와 동일). 창 길이 상한 25,000행 초과 시 fail-closed.
4. **과다 호출**: CacheService 분 단위 카운터, 분당 300회 초과 시 `USAGE_RATE_LIMITED`(교실 동시 시작 30명 기준 10배 여유). 동일 eventId 기존 12회 초과 재전송은 `REPLAY_STORM`.
5. `appendRow` → `flush` → 마지막 행 재읽기로 eventId·날짜 일치 확인 → **W = 새 행 번호로 전진**(이 순간이 commit).

운영용 고효율 멱등 색인 제안(설계 제출, U1은 최근 창 방식 구현): `HOJA_V4_EVENT_ID_INDEX` 시트에 `eventId 앞 2hex → 행범위` 샤드 또는 확정일 seal 시 그날 eventId SHA-256 목록을 manifest 옆에 저장해 전일 재전송을 O(1일)로 판정. 색인 손상 시 EVENT_LOG에서 재구성(원본이 정본). 전기간 TextFinder는 시험 전용.

## 4. 같은 GAS 내부 동시성 — commit watermark와 읽기 절단점
- 단일 프로젝트이므로 Writer·Seal·Reader 모두 같은 `LockService.getScriptLock()`을 사용할 수 있다. 단 **Reader는 락을 잡지 않는다**(공개 요청 폭주가 게임 기록을 막지 않도록).
- 불변식: (a) W는 단조 증가, Writer가 flush·재읽기 검증 후에만 전진 → **행 ≤ W는 완전히 기록된 행**. (b) Seal은 락 안에서 오늘(KST)과 W를 읽는다. 락 순서상 어제 날짜 행은 모두 이 시점 이전에 commit되어 ≤ W. (c) manifest `COMPLETE`는 버킷 기록·재읽기·SHA 검증 후 마지막에 뒤집는다.
- Reader 절단 순서: ① manifest·버킷 읽기(COMPLETE만 채택, PREPARING 무시) → ② W 읽기 → ③ `[마지막 COMPLETE sourcePrefixEndRow+1, W]` 원본만 읽기 → ④ manifest COMPLETE 개수 재확인, 변했으면 1회 재시도 후 실패 시 `UNAVAILABLE`. W 이후 진행 중인 행은 읽지 않으므로 부분 행이 숫자에 섞이지 않는다. 앞뒤 `getLastRow()` 비교에 의존하지 않는다.
- 자정·미확정 전일: 꼬리에 오늘 이전 미확정 날짜가 있으면 그 날짜도 `LIVE_PROVISIONAL`로 함께 계산(`provisionalDays`). 꼬리 날짜는 비감소·마지막 COMPLETE 이후·오늘 이하여야 하며, 미확정 날짜가 3일을 넘으면 `SEAL_STALE`로 fail-closed.

## 5. Daily (일별 확정)
- `hojaV4OpsSealPendingDays()`: 가드 → 락 안에서 오늘·W 확정 → 마지막 COMPLETE 다음 날부터 어제까지 하루씩 V4 CORE `snapshot` + 원본/버킷 SHA-256 → `PREPARING` 기록 → 버킷 기록 → 재읽기·SHA 재검증 → `COMPLETE`. 0회 날짜는 꼬리에서 그 날짜 행이 0건임을 **연속 구간으로 증명**한 경우에만 COMPLETE(검증되지 않은 날짜를 0으로 만들지 않음).
- 기존 `PREPARING` 잔존 시 동일 세대면 재검증 후 이어서 완료, 다르면 `MANUAL_REVIEW`로 중단. 재실행은 멱등.
- 자동 트리거 설치 함수 없음. 원본 삭제·보관 없음.

## 6. 캐시·요청 남용
- 공개 응답은 CacheService에 60초 캐시(`ageSeconds` 표시). 재계산은 분당 최대 20회(전역 카운터). 초과 시 캐시된 최근 정상 응답(최대 10분)을 `stale:true`로 제공, 없으면 `UNAVAILABLE/RATE_LIMITED`.
- **무결성 오류(해시·누락·비정렬)는 stale 응답으로 덮지 않는다**: 즉시 `UNAVAILABLE`.
- Reader 읽기 상한: manifest ≤ 400행, 버킷 ≤ 40,000행, 꼬리 ≤ 25,000행.

## 7. 공개 대시보드
- `doGet(e)`: `e.parameter.view === 'stats'`면 `Stats.html`, 그 외 모든 요청은 기존대로 `Game` (기존 학생 QR·쿼리 파라미터 호환). 다른 파라미터는 무시.
- `Stats.html`은 진입 시에만 `getPublicUsageStatisticsV4()` 1회 lazy 호출(+수동 새로고침). Game.html은 변경하지 않으므로 게임 홈·인트로 자동 호출 0.
- 기간 카드, 일별 추이, SOLO/TEAM, 팀 2~7, 학년·교과·출판사, TOP20. 외부 CDN 없이 인라인 SVG/CSS, 모바일 반응형. 교실매니저 UI 복제 없음.

## 8. 시험 사본 설계 (실데이터)
- 기존 61일 인증 사본: **읽기만**(지시서). 40-6 전용 쓰기 사본 = 인증 사본의 재복제.
- 통합 GAS 격리 조건(모두 충족해야 Writer/Seal/Reader가 시트를 연다): Script Property `HOJA_V4_UNIFIED_ISOLATION=COPY_40_6U_ONLY`; 저장소 ID ≠ `HOJA_USAGE_PRODUCTION_SPREADSHEET_ID` ≠ `HOJA_USAGE_CERTIFIED_COPY_SPREADSHEET_ID`; `_HOJA_USAGE_TRIAL_ONLY!A1=HOJA_RETENTION_SANDBOX_V1` **그리고** `B1=HOJA_V4_40_6U_WRITE_COPY`(인증 사본에는 없는 두 번째 표식 → 인증 사본 쓰기 차단).
- 쓰기 사본 재검증: canary, 61개 manifest COMPLETE, 날짜별 원본·버킷 SHA-256 재계산, watermark 17,673, 누적 17,670/중복 2/0회 4/버킷 3,969 → 그 뒤에만 시험 이벤트.

## 9. 단계별 시험 계획과 증거 종류 (분리 보고)
| 종류 | U1 | U2 | U3 |
|---|---|---|---|
| GitHub mock (node:test + vm) | Writer/Seal/Reader/allowlist/동시성 시뮬레이션 | 공개 RPC 거부 목록 | 자정·손상·폭주 시뮬레이션 |
| 오프라인 Chromium | – | Stats.html 익명 렌더·오류 표시·모바일 | – |
| 실 사본(Sheets/Drive 읽기) | 인증 사본 읽기 전용 재계산 대조 | – | – |
| 실 Apps Script 엔진 | – | 익명 브라우저 e2e | 동시 append/read 실기 |
실행하지 못한 항목은 `NOT RUN` 또는 `BLOCKED`로만 기록한다.

## 10. 잔여 위험 (U0 시점)
- F-1 운영 노출은 운영 수정 HOLD 상태로 남는다(교사 결정 필요).
- 최근 창 멱등 색인은 2일 이상 지난 동일 eventId 재전송을 놓칠 수 있다(현재까지 관측된 재전송은 같은 날). 운영 전 색인 설계 승인 필요.
- Ops 가드는 Google 세션 정보에 의존한다. 멱등·결정적 동작으로 피해를 제한하지만 운영 전 실 GAS에서 익명 거부 실측 필요.
- PropertiesService 일관성·CacheService 휘발성은 실 GAS에서만 검증 가능.
