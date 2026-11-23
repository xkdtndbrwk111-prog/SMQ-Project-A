# 40-6 Claude Code 실행 작업 로그 (구현자 작성 / 독립 감수 전)
**준비 상태: NOT STARTED.** 이번 파일은 Claude Code의 작업 증거를 기록하는 곳이며 GPT-6 검수/승인을 의미하지 않는다.

| 단계 | 상태 | 브랜치/커밋 | CI/실 GAS 증거 | 안전성 / 실패 및 보류 | 감수 상태 |
|---|---|---|---|---|---|
| 0. 시작점 확인 및 추가 사본 분리 | NOT STARTED | - | - | 운영본 변경 금지 | PENDING REVIEW |
| 1. A COPY-ONLY 기록 검증 | NOT RUN | - | - | 원본·기존 검증 사본 쓰기 금지 | PENDING REVIEW |
| 2. B 실제 권한 및 V4 조회 | NOT RUN | - | - | U2 원본 RPC 유지 | PENDING REVIEW |
| 3. A/B 동시성·자정 검증 | NOT RUN | - | - | 교차 ScriptLock 공유 가정 금지 | PENDING REVIEW |
| 4. U2/V4 패리티·최종 회귀 | NOT RUN | - | - | 운영 전환 HOLD | PENDING REVIEW |

## 증거 작성 규칙
각 단계 아래에 (1) 실행 시각 KST (2) 정확한 커밋·CI URL (3) 실제 GAS/모의테스트/시트 API의 종류 (4) 실제 실행 함수·환경 (5) 결과 및 요약 불변식 (6) 미실시 사유 (7) 민감정보가 없는 출력만 남긴다.

## 작업 기록
- 2026-11-23: GPT-6가 체크리스트 및 Claude 지시서를 초기화함. 구현 및 실제 GAS 시험은 아직 시작되지 않음.

## 40-6-U 사용자 범위 변경 (2026-11-23, 구현 미착수)
- **결정:** 기존 교실매니저 제품 폐기 예정, Project B 별도 GAS 통계 개발 취소, Project A 단일 Apps Script에 게임 기록·V4 집계·관리자 통계 통합.
- 40-6의 과거 A/B 단계표는 SUPERSEDED로 취급한다. 과거 코드/CI 성공 증거는 삭제하지 않으며, 실제 GAS A/B 통합을 PASS로 승격하지 않는다.
- 이후 구현자 신규 로그는 `40-6-U0` ~ `40-6-U4` 아래에 기록한다.
- 상태: U0 설계 NOT STARTED, U1 단일 GAS NOT RUN, U2 권한·UI NOT RUN, U3 경계·실기 시험 NOT RUN, U4 감수 PENDING.
- 최신 지시서: `docs/HOJA_USAGE_V4_40_6_UNIFIED_A_CLAUDE_DIRECTIVE_20261123.md`

## 40-6F 통계 공개 정책 갱신 (2026-11-23)
- 새 정책: Project A 한 GAS 프로젝트에서 누구든 **비로그인/익명으로 PUBLIC 집계 통계만 열람**.
- 기존 "관리자 통계 조회·OWNER 권한"에 관한 정책은 SUPERSEDED. 단 원본 데이터, 집계 재작성/설정/삭제, 개인정보는 공개되지 않는다.
- U0~U4 새 공개 통계 구현/실 GAS 검증: NOT RUN. 운영 배포 HOLD.

## 40-6G 정본 실행 지시서 rev.2 재작성 (2026-11-23)
- U0~U4 공개 통계 단일 Project A 지시서 rev.2를 확정. 기존 Project A/B 분리 및 관리자 조회 권한 설계는 SUPERSEDED.
- 현재 이 항목은 문서 변경만 완료. 코드 수정·실 GAS·익명 브라우저 시험은 NOT RUN. 운영 배포 HOLD.

---
# 40-6-U 구현자 로그 (Claude Code, rev.2 지시서 기준)
> 과거 A/B 단계표(위 0~4)는 **SUPERSEDED**(감사 추적용 보존). 아래가 신규 U0~U4 기록. 모든 상태는 구현자 자기 보고이며 GPT-6 독립 감수 전이다.

| 단계 | 구현자 상태 | 브랜치 | 감수 |
|---|---|---|---|
| U0 정책·시작점·설계 | DONE (문서) | `work/usage-v4-40-6-u-20261123` | PENDING REVIEW |
| U1 단일 GAS 시험 통합 | NOT STARTED | 〃 | PENDING REVIEW |
| U2 익명 공개 통계 UI | NOT STARTED | 〃 | PENDING REVIEW |
| U3 실제 GAS·동시성·성능 | NOT STARTED | 〃 | PENDING REVIEW |
| U4 독립 검수 제출 | NOT STARTED | 〃 | PENDING REVIEW |

## U0 — 2026-11-23 KST
- 기준: `work/unified-quiz-renderer-20261122` @ `d72964f` → 신규 브랜치 `work/usage-v4-40-6-u-20261123`. 기존 40-6-U 브랜치/PR 없음 확인.
- 읽은 자료: 지시서 rev.2, 체크리스트 40-1~40-6G, REBUILD_PLAN, REAL_COPY_BACKFILL, 루트 `Code.gs`, `UsageRollupU3S.gs`, `experimental/usage-retention/` V4 CORE/LIVE_TAIL/TRIAL_GAS/LIVE_TRIAL_GAS/APPEND_GUARD 및 시험, `versions/2.0.0` Game.html(조립 후 RPC 호출부 정적 조사).
- 산출물: `docs/HOJA_USAGE_V4_40_6_U0_DESIGN_20261123.md` (공개 RPC allowlist, 응답 allowlist·소규모 셀 정책, Writer 멱등/날짜 보호, commit watermark 절단점, Daily seal, 캐시·남용 상한, doGet 분기, 40-6 쓰기 사본 이중 canary, 시험 매트릭스).
- **발견 F-1 (기존 운영 후보, HOLD)**: `UsageRollupU3S.gs`의 `_` 없는 9개 함수가 `ANYONE_ANONYMOUS`+`USER_DEPLOYING` 웹앱에서 익명 `google.script.run`으로 소유자 권한 실행 가능. `setupUsageRollupShadowU3S1`는 통계 저장소 spreadsheetId를 반환, `installUsageRollupDailyTriggerU3S1`는 트리거 재설치. 운영 배포 여부는 확인 불가. 운영 소스 미수정, 교사 결정 필요.
- 시험 종류: 정적 소스 조사만. 코드 실행 시험 없음. 실 GAS NOT RUN.
- 운영 데이터·배포·트리거: 무변경.

## U1 — Project A 단일 GAS 시험 통합 (2026-11-23 KST)
**신규 파일** (`experimental/usage-v4-unified/`)
| 파일 | 내용 |
|---|---|
| `gas/Code.gs` | 루트 `Code.gs` 복제 + (1) `doGet(e)` `?view=stats`만 통계, 나머지 게임 (2) `recordUsageStartU1` 동일 ScriptLock 안에서 V4 가드→append→flush→commit. 격리 속성 없으면 원래 U1 동작 그대로 |
| `gas/UsageV4Core.gs` | 기존 V4 CORE와 **바이트 동일**(시험으로 고정) |
| `gas/UsageV4Public.gs` | 순수 JS: 확정 과거 + commit된 꼬리(미확정 전일 ≤3일 포함) 투영, 서버측 응답 allowlist, 카트리지 이름 정제·k=5 소규모 셀 병합, 고정 오류 코드 |
| `gas/UsageV4Unified.gs` | 격리(속성+ID 3중 상이+이중 canary), commit watermark, Writer 가드(확정일·역행·최근창 멱등/충돌·분당 상한·replay storm·미commit 꼬리 복구/HOLD), Daily seal(PREPARING→버킷→재읽기 SHA→COMPLETE, 재개·수동검토), 공개 Reader(무락·캐시 60s·재계산 상한·stale 표시) , 운영자 가드 |
| `mock_gas.mjs`, `fixture.mjs`, `UNIFIED_GAS_U1.test.mjs` | 실제 `gas/*.gs` 4개를 한 V8 컨텍스트(=한 GAS 프로젝트)로 로드하는 in-memory Sheets/Lock/Cache/Properties/Session mock 시험 24종 |
| `ci/usage-v4-unified-qa.yml` | **제안 워크플로**(문법 검사 + 기존 V4 6개 + U1 시험). GitHub가 `workflow` scope 없는 OAuth 토큰의 `.github/workflows/` 쓰기를 거부하여 활성화하지 못함 → 저장소 소유자가 `.github/workflows/`로 이동 필요 |

**시험 결과 (GitHub mock 종류, 로컬 Node 24.21 실행)**: `UNIFIED_GAS_U1.test.mjs` 24/24 PASS. 기존 V4 6개 시험 fail 0. **GitHub Actions CI: NOT RUN** (위 workflow scope 사유). 로컬 실행 결과만 존재.
- 공개 RPC 집합 = allowlist 9개 정확히 일치, Ops 함수 첫 문장 가드, 익명/타인 Ops 호출 거부(시트 open 0회), 통합본에 U2/Project B/시험 RPC 이식 0.
- 격리: 속성 부재=원래 U1·통계 NOT_CONFIGURED / 잘못된 값·운영ID·인증사본ID·랭킹ID·B1 canary 부재 → append 0행.
- Writer: 동일 ID 동일 내용 재전송 신규 0행, 내용 충돌(팀·카트리지) 거부 0행, 전일 재전송 `duplicateIgnored`, 확정일로 시계 역행 거부, 미래일 꼬리 HOLD, 분당 상한, append→commit 크래시 후 다음 기록에서 완전 행만 채택·부분 행은 HOLD.
- Reader: 합산 정확(합성 4일+오늘), 0회 날짜 0 표시, 응답 키 allowlist 정확 일치, eventId·저장소ID·namespace·watermark 문자열 미노출, **락·쓰기·속성변경 0, EVENT_LOG는 확정 꼬리 범위만 읽음**. 해시 손상·0회일 누락·prefix 단절·지연/미래 이벤트·commit된 부분 행·다른 저장소 watermark·중간 PREPARING·미지 버킷·감사표 부재 → 모두 `UNAVAILABLE`이고 숫자 필드 없음.
- 캐시 60s(age 표시), 재계산 상한 초과 시 stale 표시, 무결성 오류는 stale로 덮지 않음, 캐시 없으면 RATE_LIMITED.
- 자정: 확정 전 전일은 `provisionalDays`로 계속 집계, seal 전후 숫자 동일, seal 멱등, 0회 날짜는 절단점 이후에만 COMPLETE, 미확정 전일 3일 초과 SEAL_STALE, PREPARING 중단 재개(중복 manifest 0)·변조 PREPARING 수동검토.
- 동시성(인터리빙 모의): 읽는 중 commit/미commit append → 이전 또는 이후 commit 절단점만 표시(부분 숫자 0), 읽는 중 seal → 재시도 후 동일 수치, 락 점유 중 seal/append 타임아웃.
- 합성 61일(0회 4일+@, 재전송 2건) 형태: raw−2 = plays, 일별 버킷 해시 검증 통과.

**실 사본 대조 (Google Sheets connector)**: **BLOCKED / NOT RUN.** 이 세션의 Google Drive 커넥터는 인증 사본에 `canEdit:false`(읽기 전용, 적절)이나 17k행 다중 탭을 범위 단위로 읽는 기능이 없음(전체 base64 다운로드만 가능). 따라서 17,670/2/4/3,969 및 날짜별 SHA 재검증은 이번 U1에서 **수행하지 않음**. 40-6 전용 쓰기 사본도 **생성하지 않음**.
**실 Apps Script 엔진**: NOT RUN (U3에서 판단).
**운영**: 운영 GAS/EVENT_LOG/랭킹/배포/트리거 무변경. 루트 `Code.gs`·`UsageRollupU3S.gs` 무변경.
**미해결**: 최근창 멱등은 2일 이상 지난 재전송 미탐지 가능(설계 문서 3장 색인안), Ops 가드 실측 필요, 실 사본 수치 대조 미실시.

## U2 — 익명 공개 통계 UI (2026-11-23 KST)
**신규/변경**: `gas/Stats.html`(공개 통계 페이지), `build_unified_gas.py`(단일 GAS 폴더 조립, Game.html SHA-256 검증), `make_stats_payloads.mjs`(실제 `gas/*.gs`가 합성 사본에서 만든 응답), `verify_stats_chromium.py`, `UNIFIED_GAS_U2.test.mjs`, `evidence/stats_desktop.png`·`stats_mobile.png`(합성 데이터 화면).
- 화면: 기간 카드 4개(오늘 잠정), 일별 막대(확정 단색/잠정 빗금, hover tooltip, 표 보기), 개인전/팀전, 팀 2~7, 학년·교과·출판사, TOP20. 단일 계열 차트만 사용(색상 1개, 식별은 텍스트). 진입 시 RPC 1회 + 수동 새로고침(10초 제한). 외부 리소스 0, 데이터는 `textContent`로만 렌더링. 오류 시 코드·설명만, **숫자 미표시**. 교실매니저 UI 복제 없음. Game.html 무수정 → 게임 홈·인트로 통계 호출 0.

**시험 결과**
| 종류 | 결과 |
|---|---|
| GitHub mock `UNIFIED_GAS_U2.test.mjs` (로컬) | 7/7 PASS — 익명 공개 Reader 인자 무시·allowlist 동일·쓰기/락 0, Ops 거부(저장소 open 0), 악성 시작 기록 12종 append 0·저장소ID 미노출, `doGet` 파일 선택 불가, 기존 게임 RPC 18개 함수 루트 `Code.gs`와 동일, Stats.html RPC 1종·외부 리소스 0, 조립 Game.html SHA-256 `4ac5c4ef…` 동일·통계 호출 0 |
| 오프라인 Chromium (로컬 Playwright 1.x/Chromium, 새 컨텍스트·쿠키 없음·모든 네트워크 차단, `google.script.run` 스텁) | PASS — 데스크톱 수치/잠정 배너/막대 수/표/TOP20/tooltip, 모바일 375px 가로 넘침 0, stale 표시, INTEGRITY·NOT_CONFIGURED·NETWORK 오류 시 숫자 0개 표시, 라벨 XSS 텍스트 처리 |
| **실 Apps Script 웹앱 익명 브라우저 e2e** | **NOT RUN** — 실 GAS 배포 필요(U3 runbook, 승인 대기) |
| GitHub Actions CI | **NOT RUN** — workflow scope 문제(U1 참조). 제안 워크플로에 U2/U3/Chromium 단계 추가 |

**운영**: 무변경.

## U3 — 실제 GAS·동시성·성능 (2026-11-23 KST)
**mock 시험** `UNIFIED_GAS_U3.test.mjs` (파일은 U2 커밋 `6e828b9`에 함께 포함됨) — 로컬 6/6 PASS. **실 GAS 엔진 결과가 아님.**
- KST 자정 경계: 23:59:59.999 / 00:00:00.000 기록이 서로 다른 날짜, 통계 일별 분리.
- 요청 폭주: 1분 내 익명 조회 2,000회 → 모두 OK, EVENT_LOG 꼬리 읽기 ≤1회(캐시).
- 캐시 강제 미적중 공격 200회/분 → 재계산 정확히 20회, 나머지 180회 `stale:true`.
- 규모: 61일×290건(17,690행) 확정 + 오늘 꼬리 20,000행 → 정확 합계, Node 계산 수백 ms. 꼬리 25,001행 → `READ_LIMIT` fail-closed(잘라서 표시하지 않음).
- 안전 중단·복구: seal 중 manifest/버킷 쓰기 단계에서 실행시간 초과 모의 → 그 사이 통계 숫자 불변, 재실행 시 정확히 1회 확정.
- 연속 기록 300회+재전송 30회: 행 +300, watermark 매회 +1 단조.
- (U1 시험 포함) 읽는 중 commit/미commit append, 읽는 중 seal flip, 락 점유 중 seal/append 타임아웃.

**실 Apps Script 엔진: BLOCKED / NOT RUN.**
- 사유: 실 엔진 시험에는 사용자 Google 계정에 ① 인증 사본의 새 복제본 생성 ② 새 Apps Script 프로젝트 생성 ③ 익명 e2e용 `ANYONE_ANONYMOUS` 공개 URL 테스트 배포가 필요. 공개 URL 생성은 외부 노출 행위이므로 교사 승인 없이 진행하지 않음. 이 세션의 Drive 커넥터는 인증 사본 쓰기 권한 없음(적절).
- 실행 절차와 기대값: `docs/HOJA_USAGE_V4_40_6_U3_REAL_GAS_RUNBOOK_20261123.md` (R1~R10: 익명 Ops 거부·`_` 함수 호출 불가 실측, 17,671 = 17,670+1, 재전송/충돌, 동시 40건, 자정 seal, 해시 손상, 실행 시간).
- 실 엔진에서만 확인 가능한 잔여 위험: PropertiesService 쓰기-읽기 일관성(watermark), CacheService 실제 휘발, `Session.getActiveUser()` 익명 빈 값, ScriptLock 대기 시 `USAGE_APPEND_LOCK_TIMEOUT` 빈도, connector로 기록된 실 사본 manifest의 표시 형식(날짜가 `2026-09-23` 텍스트로 표시되는지, 숫자 천단위 구분 없음) — 형식이 다르면 Reader가 `INTEGRITY`/`MANIFEST_DATE_GAP`로 fail-closed(0 표시 아님).

## 사용자 범위 변경 반영 — 팀전 팀 수 비공개 (2026-11-23 KST)
- 사용자 지시: "팀전 팀수는 필요없음". 공개 응답에서 `teamCount` 필드 제거(서버 allowlist), Stats.html의 "팀전 팀 수" 카드 제거. 개인전/팀전(SOLO/TEAM) 비율은 유지.
- 기록 계약(팀 2~7 입력 검증)과 V4 내부 `TEAM_SIZE` 버킷·정합성 검사는 **변경 없음**(과거 61일 인증 SHA·버킷 3,969행 호환 유지).
- 재시험(로컬): U1 24/24, U2 7/7, U3 6/6, 오프라인 Chromium PASS(팀 수 카드 부재 확인). 지시서 rev.2의 `teamCount`/"팀 인원 2~7" 화면 요구는 이 사용자 결정으로 대체됨.

## U4 — 독립 검수 제출 (2026-11-23 KST) — **Claude 자기 PASS 아님, 승인 아님**
**검수 대상**: 브랜치 `work/usage-v4-40-6-u-20261123` (기준 `d72964f`), 커밋 `05fa127`(U0) → `c6ba90b`(U1) → `6e828b9`(U2+U3 mock 시험) → `5f15527`(U3 문서) → `a584582`(팀 수 비공개) → 본 U4 커밋. diff: `git diff d72964f..work/usage-v4-40-6-u-20261123`. Draft PR 링크는 PR 본문 참조.

| 검증 종류 (분리 보고) | 상태 | 근거 |
|---|---|---|
| GitHub mock (node:test, 로컬) | PASS(구현자 실행) | U1 24, U2 7, U3 6, 기존 V4 6개 suite fail 0 |
| GitHub Actions CI | **NOT RUN** | OAuth 토큰 `workflow` scope 없음 → `ci/usage-v4-unified-qa.yml`을 소유자가 `.github/workflows/`로 이동 필요 |
| 오프라인 익명 Chromium | PASS(구현자 실행) | `verify_stats_chromium.py`, 스크린샷 `evidence/` (합성 데이터) |
| Google Sheets 실제 복사본 검사 | **BLOCKED / NOT RUN** | 커넥터 범위 읽기 불가. 17,670/2/4/3,969·날짜별 SHA **미재검증** |
| 실 Apps Script 엔진 | **BLOCKED / NOT RUN** | 새 사본·새 GAS·공개 테스트 배포 승인 필요. runbook R1~R10 |
| 실 GAS 익명 브라우저 e2e | **NOT RUN** | 동일 |

**PASS 기준(지시서 4장) 대비**: 61일 인증 수치·SHA 일치, 실 GAS, 실 익명 e2e는 **증거 없음 → PASS 주장하지 않음.** mock 수준에서 중복/충돌 신규 0, fail-closed, 부분 숫자 0, 원본/관리 RPC 거부를 확인.

**감수 요청 핵심 포인트**
1. 발견 F-1: 운영 후보 `UsageRollupU3S.gs` 9개 함수 익명 호출 가능(저장소 ID 반환·트리거 재설치). 운영 핫픽스 여부 교사 결정 필요.
2. commit watermark 절단점 논증(U0 설계 4장)과 Reader 읽기 순서(manifest→W→꼬리→재확인).
3. Ops 가드(`activeUser==effectiveUser`, 비어있지 않음)의 충분성 — 실 GAS R4에서 실측 필요.
4. 최근창 멱등(2일 초과 재전송 미탐지 가능)과 운영용 색인 제안.
5. 카트리지 이름 정규식·k=5 병합 정책이 실데이터 251개 조합 중 얼마나 `기타`로 가려지는지 실 사본 미확인.
6. 실 사본 manifest 셀 표시 형식이 Reader 가정(텍스트 날짜·구분자 없는 숫자)과 다르면 fail-closed됨.

**HOLD 유지**: 운영 GAS·EVENT_LOG·랭킹·배포·트리거·원본 보관/삭제·교실매니저 실제 폐기·중앙 체크리스트 PASS 기록.

## U3-REAL — 실 Apps Script 엔진 + 익명 브라우저 e2e (2026-11-23 10:57~11:01 KST, 사용자 승인 후 실행)
**환경**: 사용자 계정의 **새 격리 Apps Script 프로젝트**(운영 아님) + 61일 인증 사본을 Drive에서 복제한 **40-6U 쓰기 사본**(B1 두 번째 canary 설정). 인증 사본·운영 원본·운영 GAS·랭킹 무접근(랭킹 속성 미설정). 사용자가 편집기에서 OAuth 승인·`hojaV4TestSetupU3` 실행·웹앱 배포(모든 사용자)를 직접 수행. 익명 시험은 로그인/쿠키 없는 새 Chromium 컨텍스트(Playwright)에서 실 `/exec` URL로 수행.
**시험 전용 코드**: `test-only/TestOnlyU3.template.gs`(ID·토큰 제거본; 실제 파일은 시험 프로젝트에만 존재, 토큰 보호 증거/변조 함수), `verify_real_gas_anonymous.py`. 원시 로그: `evidence/u3_real_gas_20261123.log`(ID·URL·토큰·eventId 없음).
**쓰기 전 안전장치**: R0에서 시험 프로젝트 전용 함수와 B1 canary를 확인하지 못하면 쓰기 전에 중단(첫 시도에서 실제로 중단 작동 — 설정 미완료 시).

| # | 결과 | 비식별 증거 |
|---|---|---|
| R0 실 엔진 사본 재검증 | **PASS** | 61일 COMPLETE, 원본 17,672 / 고유 17,670 / 재전송 2 / 0회 4일 / 버킷 3,969 / prefix 17,673, **원본 SHA 61/61, 버킷 SHA 61/61, 버킷 집합 61/61 일치**, bad 0. 전체 읽기 3.7~4.4s, 검증 0.4~0.9s |
| R1 쓰기 전 통계 | **PASS** | `UNAVAILABLE/NOT_CONFIGURED`, 화면 숫자 0개 표시 |
| R4 익명 공격면 | **PASS** | Ops 2종·Setup → `HOJA_V4_OPS_DENIED`; `_` 함수·UsageRollupU3S 함수는 **익명 google.script.run 스텁에 아예 없음**; 증거 함수 오토큰 거부 |
| R2 익명 1회 기록 | **PASS** | append ok, watermark 초기화·전진, RPC 4.3s |
| R5 재전송/충돌/PRIVATE | **PASS** | 동일 → `duplicateIgnored`(신규 0), 팀 변경 → `USAGE_EVENT_ID_CONFLICT`, PRIVATE → 미수집 |
| R3 공개 통계 | **PASS** | 전체 **17,671 = 17,670+1**, 오늘 1(LIVE_PROVISIONAL), 62일·0회 4일, 7일 1,299, 30일 4,291, 응답 키 allowlist 정확, TOP20, 익명 화면 렌더 OK |
| R6 동시 40건(익명 2창×20) + 통계 폴링 | **FAIL (데이터 유실)** | 성공 **10/40**. 실패 30 = `USAGE_APPEND_LOCK_TIMEOUT` 13 + `SHEETS_HTTP_429_RATE_LIMIT_EXCEEDED` 17. 행 +10 = watermark +10(부분 행 0), 통계 폴링 단조(17,672→17,681), 불완전 숫자 0 |
| R8 버킷 1셀 변조 | **PASS** | 변조 중 `UNAVAILABLE/INTEGRITY`(숫자 없음), 복구 후 OK 17,681 |
| R9 시간 | 기록 | 캐시 적중 RPC 1.8s, 재계산 3.7s(공개 계산 1.8s) |
| 게임 기본 경로 | **PASS** | 익명 `/exec` → `HOJA QUIZ 2.0`, 통계 DOM 없음 |
| R7 자정 seal | **NOT RUN** | 시험 시각이 11/23 오전 → 확정할 지난 날짜 없음 |
| R10 정리 | 완료 | 공개 시험 배포 삭제(해당 URL "페이지를 찾을 수 없음" 확인). 시험 프로젝트·쓰기 사본은 증거로 보존(시험 이벤트 11건 포함) |

### R6 FAIL 분석 — **운영 전환 STOP/HOLD 사유**
- 게임 클라이언트는 기록 실패 시 재시도하지 않으므로(`withFailureHandler(()=>{})`), 교실 동시 시작(20~40명)에서 **시작 기록이 유실**된다. 지시서 STOP 조건("재전송 데이터 유실")에 해당.
- `SHEETS_HTTP_429`: `recordUsageStartU1`이 매 호출마다 `hojaPublicSheets_()`로 Sheets API를 2회 호출(카탈로그 검증). **기존 운영 후보 코드와 동일한 경로**이며 V4가 추가한 것은 아님.
- `USAGE_APPEND_LOCK_TIMEOUT`: 기존 `tryLock(10000)` + **V4가 락 안에 추가한 작업**(manifest 읽기, 최근창 TextFinder, flush 후 재읽기, 속성 쓰기)으로 락 보유 시간 증가. 기존 경로(V4 없음)와의 동시 부하 비교는 **NOT RUN**이므로 V4 기여분은 미정량.
- 불변식은 유지됨: 거부된 요청은 행을 남기지 않았고 watermark=행수, 공개 통계는 commit된 값만 단조 표시.
- 개선 후보(미구현, 결정 필요): ① 카탈로그 검증 결과 CacheService 단기 캐시(429 제거) ② 봉인 상태(마지막 COMPLETE·prefix)를 seal 시 캐시해 락 안 manifest 읽기 제거 ③ `waitLock` 상향(예 25s) ④ eventId 멱등이 보장되므로 **클라이언트 동일 eventId 재시도**(Game.html 수정 필요) ⑤ 수정 후 R6 재실행.

### 추가 발견 — 카트리지 이름 공개 규칙이 과도
실 버킷 251개 조합 중 **112개(플레이 4,700회, 약 27%)**가 이름 형식 규칙에 걸려 `기타 공개 카트리지`로 가려짐(5회 미만 소수 조합은 별도 93개). 실제 이름 형식을 확인해 규칙을 완화할지 교사/감수자 결정 필요(개인정보 위험 판단 포함).

---

## U-APPROVED-CATALOG — 단계 A: 승인 정본 인덱스 자동 생성 (2026-11-23, 지시서 `HOJA_USAGE_V4_40_6_CLAUDE_NEXT_STEPS_20261123.md`)
**정본 고정:** `xkdtndbrwk111-prog/HOJA-QUESTION-BANK` @ `9573f91d2845a9667e2540df051f499d937dd94a` (로컬 클린 체크아웃, `approved/` 변경 없음 확인 후 빌드). 빌드 타임 전용 — GAS 런타임은 GitHub를 읽지 않음.

**후보 `969cdec` 검토 결과(실행 증거):** 후보 자체 테스트 4/4 PASS. 그러나 같은 코드를 **실제 승인 데이터**에 돌리면 23/732는 맞지만 다음 결함 확인 → 선별 반영하지 않고 재작성.
1. 승인 effective 제목 추출 없음 → 실데이터에서 **정식 제목 0/23**(전부 임시 `N학년 과목 N단원`), 따라서 후보의 배포 게이트는 영원히 통과 불가.
2. ZIP을 열지 않음: 아카이브 SHA-256 재계산·내부 파일표·문항 수 검증 없음(manifest 표기값만 신뢰).
3. `subjects.math`에 `paths`와 `manifest`가 함께 있을 때 `paths`만 사용 → 수학 상위 manifest의 단원별 SHA pin을 대조하지 않음.
4. 학년/단원을 ID 정규식으로만 판정(+과목 코드 고정표) — 지시서의 "이름 문자열 정규식으로 판정 금지"에 저촉, 표에 없는 새 과목은 실패.
5. 영어 천재 6개 단원 문항 수 `null`(미검증), q21 시계 오버레이 미적용·미검증.
6. YBM: 단원 파일과 승인 데이터의 일치, 태그·이미지 표 누락 검사 없음, 제목 없음.
7. 배포 게이트가 `teacherDeploymentApproval:true`와 **임의의 64자 hex**만 보면 통과 — 실제 effective digest와 대조 안 함, 렌더러/문항검증/미디어 권리 게이트 없음. 정본 commit pin·잠금 파일 없음.

**구현(`experimental/usage-v4-unified/approved-catalog/`):**
- `zip_reader.mjs`: 무의존 ZIP 리더(중앙 디렉터리, stored/deflate, ZIP64·암호화·경로 이탈·중복·크기 위조 거부) + 시험용 writer.
- `approved_catalog_normalizer.mjs`: `catalog.json → manifest → 승인 아카이브`를 **필드 형태(shape)**로 해석. 4개 형태: `unit-effective-zip`(사회 paths), `aggregate-units`(수학 manifest.units → 단원 manifest; `paths`와 불일치 시 실패), `bundle-source-zips`(영어 천재: 외부 ZIP `release/approval.json` + 중첩 원본 ZIP + `release/media-overlay.json`), `bundle-unit-questions`(영어 YBM: 승인 문항/태그/이미지 표 + 승인 화면 `UNIT_META`). 알 수 없는 형태·루트 섹션 → **fail-closed 진단**.
- 각 단원: 아카이브 SHA-256 재계산, 내부 파일표(`file-manifest`/`FILES_SHA256`/`SHA256SUMS`) 전 파일 재해시, effective 문항 수·ID 접두·중복, 참조 이미지 존재, 승인 기록 제목과 effective 제목 일치, 분류는 **effective metadata 우선**(ID 규칙은 메타데이터 없는 YBM의 fallback이며, 둘 다 있으면 교차검증 불일치 시 실패).
- 출력 레코드: `cartridgeId, subject, subjectLabel, grade, semester, unit, subunit, publisher, author, unitTitle, approvedTitle, titleSource, questionCount, types, releaseId, sourceRepo, sourceCommit, sourceManifest, archiveSha256, effectiveSha256, presentationSha256, mediaOverlay, mediaRights, approvalStatus, deploymentStatus`.
- `build_approved_index.mjs`: 빌드/`--check`(재생성 결과가 커밋본과 다르면 실패 — CI drift 검사용). 산출물 `generated/approved-source-index.json`(23 entries), `generated/approved-source-index.lock.json`(정본 commit, catalog SHA, 읽은 소스 파일 54개 SHA, index digest `4e64ec40…`).
- `activeApprovedCatalog(index, deployment)`: 승인 ≠ 배포. 교사 배포 승인(`'APPROVED'`+날짜), **실제 effectiveSha256 pin 일치**, 같은 정본 commit, `rendererGate`/`questionValidationGate` = PASS, 미디어 권리 CLEARED(또는 명시 확인) 모두 충족한 ID만 활성.

**실데이터 결과(Node, 정본 @9573f91):** 23단원 / 732문항 — 영어 12/384(천재 6/201 + YBM 6/183), 사회 5/161, 수학 6/187. 23개 모두 `NOT_DEPLOYED`.
| 항목 | 결과 |
|---|---|
| 아카이브 SHA-256 재계산 | 17개 ZIP(외부 1 + 중첩 6 + 사회 5 + 수학 6 중 외부/단원) **전부 일치**, 내부 파일표 재해시 전부 일치 |
| 정식 제목 | **23/23 승인 자료에서 추출**: effective `cartridge.json` 11, 영어 천재 중첩 원본 cartridge 제목(= `release/approval.json` 제목과 일치 검증) 6, YBM 승인 화면 `UNIT_META` 6 |
| 분류 출처 | effective metadata 17, ID 규칙 fallback 6(YBM — 승인 자료에 학년/단원 메타데이터 없음) |
| q21 시계 오버레이 | `eng5-ham-u10:q21`에 적용·검증(원본 이미지 2개 존재, 대체 표시 자산 존재·해시, 정답 c4 일치), 해당 단원 effective digest에 포함 |
| 미디어 공개 권리 | **23/23 HOLD**(CLEARED 표기 없음: `NOT_AUDITED`·`PENDING_Q07`·미기재). 자동 승인으로 변환하지 않음 |
| 진단 | YBM 학기 미기재 6, YBM manifest `rawQuestionsSHA256`/`rawImagesTableSHA256`은 저장소 파일과 다른 원본 기준 값이라 **저장소에서 재검증 불가**(보고만) |

**시험:** `node --test approved_catalog_normalizer.test.mjs` **16/16 PASS**(Node/mock). 합성 정본에 4개 형태 모두 포함; **새 사회 단원 + 새 과학 과목을 catalog/manifest만 추가 → 코드 수정 없이 자동 발견·NOT_DEPLOYED**; 알 수 없는 루트/형태·미승인·ZIP 바이트 변조·수학 SHA pin 불일치·수량 위조·이미지 누락·제목 누락·paths/manifest 불일치·오버레이 정답 불일치·파일표 위조 → 전부 실패; 배포 게이트 8개 경로; 빌더 소스에 실제 ID/제목 문자열 0개(소프트코딩 검사). `--check` drift 검사 PASS.
**구분 보고:** Node 시험 PASS / 실데이터 빌드 PASS(로컬) / GitHub Actions **NOT RUN**(워크플로 미활성) / 게임 연동·실 GAS **NOT RUN**(단계 B·D).
**데이터 유출:** 산출물은 ID·승인 제목·해시·commit만 포함. 문항 본문·이미지·학생/교사/학교 정보·시트 ID·토큰 없음. 정본 저장소는 읽기만 함(쓰기 0).
**남은 위험:** YBM 학기·학년 메타데이터가 승인 자료에 없어 ID 규칙에 의존; 미디어 권리 23/23 HOLD라 현재 어떤 단원도 활성화 불가(정상 동작); 사회 6학년 그룹 manifest(`unitArchives`)는 catalog가 참조하지 않아 교차검증 대상 외.

---

## U-APPROVED-CATALOG(B) + C 경계 + U-R6-FIX(코드·mock) — 2026-11-23
### B. 승인 ≠ 배포: 교사 배포 manifest 게이트 + 내장 active catalog
- `approved-catalog/deployment/active-deployment.json`: **entries 0개**(교사 배포 승인 없음). 지금 어떤 승인 단원도 게임에 활성화되지 않음이 정상.
- `approved-catalog/build_active_catalog.mjs` → `gas/ApprovedActiveCatalog.gs`(생성 파일, 메타데이터만, 문항 본문 없음, `--check` drift 검사). GAS 런타임은 GitHub·구형 Sheets를 읽지 않고 이 상수만 사용.
- `gas/Code.gs`(시험 번들): `hojaListApprovedCartridges()`·`hojaGetApprovedQuestions(ids)`·`recordUsageStartU1` 승인 ID 검증이 **같은 내장 목록**을 사용. 목록에 없는 ID → `APPROVED_CARTRIDGE_NOT_ACTIVE`/`USAGE_APPROVED_CARTRIDGE_NOT_ACTIVE`. 활성 ID라도 문항 패키징·게임 렌더러 연동은 별도 게이트라 `APPROVED_CONTENT_NOT_PACKAGED`(Game.html 승인 정본 렌더링은 **미구현**).
- 기존 게임 계약 유지: `hojaListPublicCartridges` 반환값 동일(차이는 텔레메트리 캐시 예열 1줄, U2 시험이 그 차이만 허용하도록 정확히 비교), 질문 로드 `hojaGetPublicQuestions`는 실시간 카탈로그+재확인 그대로.

### C. 구형 61일 기록과 신규 승인 통계의 경계 (migration-free)
- 행 스키마를 명시적으로 구분: `U3S1`(구형, 숫자 시트 ID, `PUBLIC:` 네임스페이스) / `A1`(승인 정본, **정렬된 안정 ID**, `APPROVED:<정본 commit 12자>`, cartridge 열=`a + b`, 제목 JSON=승인 제목). 기존 15열 스키마·원본 행·V4 CORE(인증본과 바이트 동일) 무변경.
- **시대(era) 경계** Script Property `HOJA_USAGE_APPROVED_ERA_START`: 미설정 → 구형만 기록(승인 ID 거부), 설정일 이후 → 승인만 기록(구형 `USAGE_LEGACY_CATALOG_RETIRED`). 하루 안에서 두 스키마가 섞이지 않음. 공개 계산은 날짜 기준으로 era별 집계·era별 정합성 검사, 섞이면 `ERA_SCHEMA_MIXED` → `UNAVAILABLE/LATE_OR_UNSORTED_EVENT`(숫자 미표시).
- 공개 응답 allowlist에 `era:{current, approvedSince, legacy:{from,through,all}|null}` 추가. 승인 era에서는 totals/daily/분포/TOP20이 **승인 기록만**, 이전 17,670회는 "합산하지 않음" 문구와 함께 별도 숫자로만 표기. A+B=B+A(ID 정렬). 표시명은 내장 승인 제목에서만, k=5 소수 셀 보호 유지. 구형 이름 정규화·복원은 하지 않음.
- `Stats.html`: 어떤 출처의 숫자인지 한 줄 표기(구형/승인).

### D. R6 데이터 유실 수정 (코드 + mock; 실 GAS 재시험은 아래 별도 기록)
원인 분리(실 R6: 429 17 + lock 13)에 맞춰 각각 수정 — 단순 잠금시간 연장만이 아님.
1. **Sheets API 429 제거:** 시작 기록의 구형 카탈로그 검증을 CacheService 300초 캐시로(`hojaListPublicCartridges`가 게임 목록 표시 때 예열). 40회 시작에 카탈로그 API 읽기 **40×2회 → 최대 1×2회**(mock 계측: 첫 1건 LIVE, 39건 CACHE, `sheetsApiCalls` 0). 캐시는 *기록 검증*에만 쓰며 문항 제공은 계속 실시간.
2. **잠금 안 작업 축소:** 봉인 상태(마지막 COMPLETE·prefix·dedupe 창)를 캐시(봉인 함수가 같은 잠금에서 무효화), 직전 행 날짜를 watermark에 저장해 읽기 생략, canary/헤더 확인은 저장소 ID에 묶인 5분 캐시(잠금 밖). 잠금 안 호출(새 이벤트, 캐시 warm): **manifest 읽기·헤더 확인·직전 날짜 읽기·getLastRow 재확인 제거** → `getLastRow → TextFinder(창) → appendRow → flush → W+1 한 행 readback → watermark 속성` 만 남음(mock trace로 고정). eventId 멱등 검사는 잠금 안 유지(동시 재전송 경합 방지).
3. **잠금 대기 10초 → 20초** + 비식별 계측 `perf{catalog, catalogMs, sheetsApiCalls, lockWaitMs, lockHoldMs, totalMs}` 응답 포함.
4. **클라이언트 재시도(가장 중요):** 시험 번들 빌드에서 Game.html의 `<script id="hojaProdUsageTelemetry">` **한 블록만** `gas/UsageTelemetryClient.html`로 교체(원본 블록 SHA `18bc5697…` 확인 후 교체, 나머지 바이트 동일 — 빌더가 원본/교체 SHA 출력; 루트·versions Game.html 무변경). 같은 eventId 유지, 지수 백오프(1→16s, full jitter) 최대 6회, 영구 오류(입력/설정/충돌/봉인) 즉시 중단, 일시 오류(락/429/네트워크/응답 유실)만 재시도. 첫 시도 **전에** localStorage에 저장하고 서버 응답 시에만 삭제 → 예산 소진 시 페이지 내 60초 간격 재플러시(최대 10회), 탭을 닫았으면 같은 KST 날 다음 로드에서 재전송, 지난 날짜분은 날짜를 바르게 기록할 수 없으므로 폐기·`expired` 계수. UI 변화 없음, 게임 진행 차단 없음.
   - mock 시험 중 실제 결함 2건 발견·수정: ① 대기열 상한 20 때문에 40건 동시 시작 시 앞선 대기분이 밀려나 재시도 소진분 2건 유실 → 상한 200 + 소진 시 재저장 ② 로드 시 플러시가 진행 중 항목을 보고 재플러시 10회를 헛소모 → 진행 중이 아닌 대기분이 있을 때만 재예약.

### 시험 (Node/mock — 실 엔진 아님)
| 묶음 | 결과 |
|---|---|
| `UNIFIED_GAS_D.test.mjs` (신규) | **13/13 PASS**, 8회 반복 실행 모두 PASS. B 3, C 3, D 서버 4(캐시 1회 읽기·잠금 내 호출 고정·응답 유실 재전송 duplicateIgnored·봉인 시 캐시 무효화), D 클라이언트 4(**40건 동시 + 락 타임아웃·429·응답 유실 주입 → 행 +40, 고유 40, 중복 0, watermark +40, 공개 합계 +40**; 영구 오류 1회만 호출; 6회 소진→대기열→재로드 복구 3/3; 페이지 내 재플러시 복구) |
| U1/U2/U3 기존 + A 카탈로그 | 53/53 PASS (의도된 계약 변경 3곳만 시험 갱신: 공개 RPC 2개 추가, 응답 키 `era` 추가, `hojaListPublicCartridges` 캐시 예열 1줄) |
| 기존 V4 회귀(usage-retention) | CORE 11/11, TRIAL_GAS 9/9 PASS |
| 오프라인 Chromium(Stats.html) | **U2_STATS_CHROMIUM_PASS** — 데스크톱/모바일/stale/오류 3종/XSS + **era 표기**(구형 문구, 승인 era에서 이전 6회 "합산하지 않음"·TOP 승인 제목) |
| 빌더 | 패치 범위 검증: 접두·접미 바이트 동일, 원본 게임 SHA `4ac5c4ef…`, 패치 게임 SHA `1bff25cb…` |
**CI:** 제안 워크플로(`ci/usage-v4-unified-qa.yml`)에 A/B/D 단계와 정본 pin 체크아웃 drift 검사(읽기 토큰 secret 있을 때만) 추가. 현재 OAuth 토큰에 `workflow` 권한이 없어 `.github/workflows/`에 올릴 수 없음 → **GitHub Actions NOT RUN**.
**데이터 유출:** 없음(합성 fixture만). **남은 위험:** 실 엔진 동시성은 mock으로 증명 불가 — 아래 실 GAS R6 재시험 필요. 캐시 TTL(300초) 동안 공개 해제된 구형 카트리지 시작이 계수될 수 있음(문항 제공은 차단). 브라우저 저장소가 막힌 환경에서는 재로드 복구 불가(페이지 내 재시도만).

### CI 활성화 — GitHub Actions 실행 증거 (2026-11-23)
- 사용자가 `workflow` 권한으로 재인증 → `.github/workflows/usage-v4-unified-qa.yml` 활성화(커밋 `4bf80c2`). Google 접근·배포 없음, mock/오프라인 전용.
- 실행 [#45107912487](https://github.com/xkdtndbrwk111-prog/SMQ-Project-A/actions/runs/45107912487) (HEAD `4bf80c2`): **success**. 통과 단계: GAS 문법 검사, 기존 V4 회귀 6종, U1, U2, U3, A 카탈로그 시험, B 내장 목록 drift, B/C/D 시험, 오프라인 Chromium.
- **SKIPPED:** 정본 저장소 pin 체크아웃 + 인덱스 재생성 drift 검사 — 저장소 secret `HOJA_QBANK_READ_TOKEN`(HOJA-QUESTION-BANK 읽기 전용 토큰) 미설정. 로컬에서는 `--check` PASS.
- 정정: 앞 절의 패치 Game.html SHA `1bff25cb…`는 재시도 결함 수정 전 값. 시험 프로젝트에 올린 현재 값은 `f9647ad6…`.
- 실 Apps Script R6 재시험·R7 자정 시험: 여전히 **NOT RUN**.

## U-R6-FIX — 실 Apps Script 재시험 (2026-11-23 약 12:50 KST, 격리 시험 프로젝트)
**환경:** 기존 격리 시험 프로젝트(운영 아님) + 40-6U 쓰기 사본. 커밋 `ada67a2` 번들(패치 Game.html `f9647ad6…`) clasp push → 사용자가 UI로 웹앱 배포(모든 사용자) → 시험 → **배포 삭제(URL 404 확인)**. 로그인·쿠키 없는 새 Chromium 컨텍스트. 원시 로그: `evidence/r6_real_gas_rerun_20261123.log`(URL·토큰·eventId 없음).

| # | 결과 | 비식별 증거 |
|---|---|---|
| R0 사본 재검증(전/후) | **PASS** | 61일 COMPLETE, 원본 SHA 61/61, 버킷 SHA 61/61, 집합 61/61, bad 0 — 시험 전후 동일 |
| R6a 서버 단독 cold burst (재시도 없음, 캐시 초기화 후 40건 동시) | 19/40 (참고 지표) | 실패 21 = 전부 `USAGE_APPEND_LOCK_TIMEOUT`, **429 = 0**(이전 17). 카탈로그 LIVE 7 / CACHE 12(cold 동시 미스), Sheets API 14회(이전 80). 잠금 대기 p50 10.3s / 최대 19.9s, **잠금 보유 p50 1.0s / p95 2.3s**. 행 +19 = 고유 19, 중복 0, 불완전 0, watermark=마지막 행 |
| **R6b 실제 게임 화면 + 패치 클라이언트** (8창 × 5회 = 40 시작, 동시 통계 폴링) | **PASS 40/40** | 클라이언트 delivered 40, 재시도 16, 영구 실패 0, 대기열 0. **행 +40, 고유 eventId 40, 중복 행 0, 불완전 0, watermark=마지막 행, 공개 합계 +40**, 폴링 값 단조 증가, 전체 58.1초 |
| R6c 같은 eventId 3회 동시 전송(응답 유실 재전송 모사) | **PASS** | 3건 모두 성공 응답, 그중 2건 `duplicateIgnored`, 행 +1 |
| 최종 공개 계산 | OK | 전체 17,741(이전 17,681 + 이번 60), 62일, 오늘 잠정 |

**판단 근거(자기 승인 아님):** 이전 R6 10/40 유실은 실제 게임 경로에서 40/40·중복 0·유실 0으로 해소됨을 응답·원본 행·watermark·공개 통계로 교차 확인. 단 서버 단독으로는 잠금 보유 약 1초 × 40건 직렬이라 20초 대기 안에 다 못 받음(R6a 19/40) — **유실 방지는 클라이언트 같은 eventId 재시도에 의존**. 브라우저를 즉시 닫는 등 재시도 기회가 없으면 같은 날 다음 로드 때 복구, 그 전에는 미기록. 40건 초과(예: 여러 반 동시) 규모는 미시험.
**여전히 NOT RUN:** R7 KST 자정 seal(실 엔진), 정본 저장소 drift CI(토큰 secret 없음), 승인 정본 게임 렌더링 연동.

---

## F0 — 기존 통합 렌더러·로더 진입점과 계약 (2026-11-23, 지시서 `HOJA_USAGE_V4_40_6_APPROVED_GAME_INTEGRATION_CLAUDE_DIRECTIVE_20261123.md` @ `7b45bf5`)
- **렌더러(재사용, 무변경):** `experimental/unified-quiz-renderer/HOJA_APPROVED_RENDERER_BRIDGE.html` — `HOJA_APPROVED_RENDERER.load({questions,originalQuestions,images,tags,unitMeta,mode})`, `show({questionId,mode,omitChoiceId})`, `embed()`, `stable()`, `reveal()`; 질문 필드 `id/type(MCQ|OX|SHORT)/prompt/image(1개)/imageAlt/dialogue/choices[{id,text,image}]/answer/renderTags/layoutHint`. **문항당 그림 1장만 표현 가능**. `HOJA_RENDER_TAGS[q.id].layout.preferredLayout`이 A/C/D 선택, 없으면 `image?C:A`.
- **게임 측 계약(재사용):** 기존 내장 시험판 `gas-test/HOJA_QB_UNIT_S6U3x.gs`의 단원 패키지 `{questionSchemaVersion:2, sourceSheetVersion:2, cartridgeId, unitId, questions:[{familyId,question,answer,type(MULTIPLE|OX|SUBJECTIVE),options,explanation,rendererQuestion,originalQuestion}], images, tags, unitMeta}`, 응답 `[{sheetName,data}]`(= 게임 `HOJA_B_LIVE.setSources()` 입력). 팀 바인딩 `HOJA_TEAM_APPROVED_BINDING.mjs`·오답 `HOJA_REVIEW_SESSION.mjs`·iframe 호스트 `HOJA_UNIFIED_FRAME_HOST.mjs`·아케이드 `HOJA_ARCADE_APPROVED_*.mjs`·7MB 시험 재조립 `game-trial/build_trial.py`(part-22만 패치)는 F2/F3에서 연결.
- **승인 표시 데이터의 실제 형태(정본 @9573f91):** 수학·사회6·YBM 승인 화면 HTML = 브리지와 같은 renderer-v2 상수(`DATA_ORIGINAL/DATA_CONCISE/IMAGES/UNIT_META/HOJA_RENDER_TAGS`). 사회5 3-1/3-2 승인 화면 = renderer-v2 문항·그림(UNIT_META/태그 없음, `layoutHint` 내장). 영어 천재 승인 화면 = 다른 형식(`DATA/MEDIA/NAMES`, 블록·다중 그림). 사회5 2-2 = `display/presentation.json`(블록 오버레이) 뿐.
- **수학 승인 화면 고유 스크립트 2개**(`hoja-math-priority-and-notation-v1` 분수·격자 표기, `hoja-math-teacher-final-wrap-v4` 보기 4개 줄바꿈)는 브리지에 없음 → F2 연결 시 승인 HTML의 해당 스크립트를 브리지 어댑터로 재사용해야 함(새 렌더러 작성 아님).

## F1 — 승인 정본 '문항+그림+태그' 내장 로더 (2026-11-23)
**구현(`experimental/usage-v4-unified/approved-catalog/`):**
- `approved_content_packager.mjs`: A단계 인덱스의 각 단원에 대해 **선언된 필드로만** 승인 표시 데이터 위치를 찾음(단원 manifest `reviewedPresentation`, YBM manifest `approvedPresentation`, ZIP `release/approval.json`의 `display`). `const NAME=` JSON 리터럴을 eval 없이 추출. renderer-v2 데이터를 **승인 effective 콘텐츠와 교차검증**(문항 ID·유형·보기 ID·정답 키·그림 유무·보기 그림 수, YBM은 승인 questions/tags/images 표와 완전 일치) → 불일치 시 실패. 그림 data URI 존재 확인 + effective 자산과 바이트 SHA 대조. 승인 화면 SHA가 manifest에 있으면 재계산 대조.
- 교사 배치 결정: ZIP `presentation/layout-preferences.json`을 **schemaVersion으로만** 해석 — `hoja-math-presentation-v1`은 승인 HTML의 `teacherCLayoutIds`와 3자 대조 후 승인 HTML과 동일하게 `preferredLayout='C'` 적용, `choiceWrap` 기록; `hoja-layout-preferences-v1`은 고정 C 배치가 태그와 일치하는지 검증; 그 밖 스키마 → 실패.
- 출력 패키지 = 기존 게임 계약 그대로. **회귀: 사회6 2단원 패키지가 기존 `gas-test/HOJA_QB_UNIT_S6U31.gs`·`S6U32.gs`와 바이트 단위 동일**(로컬 실행).
- 표현 불가 단원은 변환·추측하지 않고 **BLOCKED + 사유**.
- `build_content_packages.mjs`: 정본 pin 불일치(drift)·작업트리 변경 시 거부. `generated/approved-content-report.json`(문항 본문·그림 없음, 20KB) 커밋, `--check` drift 검사. `--qa-out`은 저장소 밖 출력 폴더에 QA 번들 생성.
- **문항 본문·그림은 이 저장소에 커밋하지 않음**(미디어 권리 23/23 HOLD) — QA 번들은 pin된 정본 체크아웃에서 매번 생성.
- **출시/QA 분리:** `qa_preview.mjs` + `deployment/qa-preview.json`(`TEST_ONLY_QA_NOT_DEPLOYMENT`, `ALL_READY`) → `buildType:'QA_TEST_ONLY'`, `deploymentStatus:'QA_PREVIEW_NOT_DEPLOYED'`, 교사 배포 승인·미디어 권리 해제 주장 없음. 출시 카탈로그는 `buildType:'RELEASE'`, 활성 0개(배포 승인 0 유지), 활성 ID는 READY 패키지 + `packageSha256` pin 필수. `build_unified_gas.py --variant release|qa`: release는 QA 카탈로그·콘텐츠 파일이 있으면 빌드 거부.
- **GAS 런타임(`gas/Code.gs` 시험 번들):** `hojaApprovedActive_()`가 QA 카탈로그를 격리 시험 프로젝트(`HOJA_V4_UNIFIED_ISOLATION=COPY_40_6U_ONLY`) 밖에서는 거부. `hojaGetApprovedQuestions(ids)`가 선택된 단원만 지연 로드, 활성 카탈로그의 `packageSha256`과 실제 문자열 SHA-256 재계산 대조, 구조 검증 후 `[{sheetName:승인 제목, data}]`. GitHub/Sheets 원격 조회 없음.

**실데이터 결과(정본 @9573f91, 로컬):**
| 구분 | 단원/문항 | 내용 |
|---|---|---|
| **READY** | **16 / 498** | YBM 6(183), 수학 6(187), 사회6 2(64), 사회5 3-1·3-2(64). 유형 MCQ 350·OX 84·SHORT 64. 그림 107개 effective 자산과 **바이트 일치 107/107**. 수학 교사 C **19개 적용**(전체 A120/C67 = 승인 HTML 표기와 일치), 보기 줄바꿈 4개 기록, 사회6 교사 고정 C 11개 일치 |
| **BLOCKED** | **7 / 234** | 영어 천재 6(201): 승인 화면이 renderer-v2가 아님 + 5학년 10단원 q21 **그림 2장(학교+시계 오버레이)**을 브리지가 1장만 표현 가능. 사회5 2-2(33): 승인 renderer 데이터 없음(블록 오버레이 JSON만) |
| 주의 | — | 사회5 3-1·3-2는 승인 화면에 렌더 태그·UNIT_META가 없어 `layoutHint`+인덱스 제목 사용(승인 화면 렌더러 v0.1.0-preview.2 ↔ 브리지 v0.2 동일성 **미검증**). 수학은 분수·줄바꿈 표기 스크립트가 브리지에 없음(F2 과제) |

**시험:**
| 시험 | 종류 | 결과 |
|---|---|---|
| `UNIFIED_GAS_F1.test.mjs` 14개 | Node/mock(합성 정본) + 커밋된 실데이터 보고서 | **14/14 PASS** — 패키지 형식·정답 매핑, 정답/보기/유형/그림 불일치·미지 배치 스키마 fail-closed, 교사 C 적용, BLOCKED 사유 3종, 새 단원 자동 패키징, QA 카탈로그 격리 밖 거부, 지연 로드(목록은 0건 파싱·선택 단원만 파싱), 변조 패키지 거부, release 빌드 콘텐츠 0·배포 승인 0 |
| 전체 Node 묶음 | Node/mock | **80/80 PASS** |
| 실콘텐츠 GAS 로더 | mock GAS + 실제 QA 번들(16단원 4.06MB, 파일 17개) | 498문항, 누락 그림 0, 단원당 로드 최대 5ms(Node; 실 GAS 시간 **NOT RUN**) |
| **실콘텐츠 브리지 렌더** | 오프라인 Chromium, 기존 브리지 무변경 | **498/498 × 1920×1080·1280×720·1024×768 표시, 빈 화면 0, 문항 그림 미표시 0, JS 오류 0** (`evidence/f1_real_content_20261123.log`) |
| 정본 재생성 drift | CI | secret 없으면 SKIPPED; 로컬 `--check` PASS |
**구분:** 위는 Node/mock·로컬 Chromium 결과. 게임 버튼 E2E·실 GAS·전자칠판 **NOT RUN**. 픽셀 단위 승인 화면 대조는 이번 범위 아님(사회6 192건 기존 결과만 존재).
**데이터 안전:** 운영 GAS·원본·루트 Code.gs/Game.html·versions 무변경, `active-deployment.json` 0건·미디어 권리 HOLD 유지, 커밋에 문항 본문/그림 없음.
**남은 위험/다음:** BLOCKED 7단원(234문항)은 교사 승인 renderer-v2 데이터(또는 다중 그림 지원 결정)가 있어야 게임 사용 가능 — 결정 필요. F2: 싱글 문제풀이 실제 버튼 연결 + 수학 표기 스크립트 재사용.

## F1-B — 승인 형식 버전별 무손실 어댑터 + 공용 렌더러 media[] 확장 (2026-11-23, 지시서 `HOJA_USAGE_V4_40_6_F1B_APPROVED_RENDERER_COMPAT_20261123.md`, 40-6R Q01/Q03)
**원칙:** 승인 콘텐츠(문항·정답·보기·그림·오버레이·교사 배치)는 수정하지 않음. 정본 pin `9573f91`. 형식은 **선언된 상수/스키마로만** 식별, 모호하면 실패.

**어댑터(`approved_content_packager.mjs`):**
| 어댑터 | 대상 | 변환 규칙(근거) |
|---|---|---|
| `renderer-v2` | 16단원(F1 그대로) | 승인 화면 `DATA_*` 그대로. **F1 패키지 16개 SHA 변화 없음** |
| `presentation-v3` | 영어 천재 6단원/201 | ZIP `release/approval.json.display`(SHA `htmlSHA256` 대조)의 `DATA/MEDIA/NAMES`. 텍스트 블록 = v3 `prompt`(+`stimulus`) 정확히 일치 검증 후 `\n` 결합(브리지의 다줄 prompt 규약), 그림 1장 = 기존 `image`, **그림 2장 이상·빈도표 = `media[]`(원본 순서)**, 대화 블록 = `dialogue`, 보기 블록 = text 또는 image 1개, 정답·해설 = v3, 허용 답 = 중첩 원본 cartridge `acceptedAnswers`. `release/media-overlay.json`을 **그대로** 적용: q21 원본 그림 2장을 승인 표시 자산(`school_no_clock_review.webp`, `clock_8_20_vector.svg`)으로 교체 + 카드 캡션 "자료 1 · 등교 장면 / 자료 2 · 시계", `doNotDisplay`("8시 20분") 문구가 답 이전 표시 요소(문항·캡션·alt)에 있으면 실패. 단원명 = v3 `NAMES` |
| `display-overlay-v1` | 사회5 2-2/33 | **승인 renderer 화면이 없다는 사실을 보고서에 명시**(`NO_APPROVED_RENDERER_PRESENTATION__GENERATED_FROM_EFFECTIVE_PLUS_TEACHER_REVIEWED_DISPLAY_OVERLAY`). 표시 = 승인 `display/presentation.json`(전 문항 `reviewedByTeacher:true` 필수, revision 일치, 보기 ID·순서 일치), 정답·허용 답·해설 = 승인 `effective/cartridge.json`, 원본 문항(originalQuestion) = effective 그대로, 그림 = `display/assets` 우선(4개) |
- v3·오버레이의 A/C/D 결정은 승인 필드(`layout`/`layoutFamily`)만 사용하되 렌더러 태그 형식이 필요해 **`hoja-derived-layout-v1` 태그(needsHumanReview:true, confidence:'derived')**로 생성 — 보고서 `renderTags: DERIVED_FROM_…`, `visualParity: NOT_VERIFIED`. 교사 승인 태그로 표기하지 않음.
- effective 대비 교차검증(ID·유형·보기 ID·정답·**그림 장수**)은 그대로 적용. renderer-v2 화면이 그림 1장인데 원본이 2장이면 실패.

**공용 렌더러 확장(새 렌더러 아님):** `experimental/unified-quiz-renderer/HOJA_RENDERER_MEDIA_EXT.js` + `compose_renderer.mjs`. 브리지 파일은 **수정하지 않고 SHA `12b76fbb…`로 고정**, `</body>` 앞에 확장 스크립트 1개만 추가. `media[]`가 있는 문항만 `renderQuestion` 이후 브리지 **자체 크기 클래스**(`imageCompare`: 2자료, `imageWide`: 표)를 써서 항목을 원본 순서·캡션과 함께 표시. 정답·점수·capture 코드 접근 없음.
- 실제 결함 2건 발견·수정(비교 시험으로 확인): ① 확장이 `data-media-count`를 남겨 q21 이후 707문항 DOM이 달라짐 → 매 렌더 초기화 ② 부분 태그가 브리지 교사용 태그 검사기에서 JS 오류 → 전체 형식 derived 태그. 육안 확인: q21 첫 시도는 문항 문구가 가려지고 캡션이 흐림 → 브리지 고유 `imageCompare` 크기 규칙 재사용으로 수정.

**결과(정본 @9573f91, 로컬):** **23단원 / 732문항 패키지**(renderer-v2 16, v3 6, overlay 1), BLOCKED 0. 그림 바이트 effective 대조 **199/199 일치**(오버레이 교체분 제외), media 문항 6(q21 1 + 빈도표 5).
| 시험 | 종류 | 결과 |
|---|---|---|
| 기존 브리지(무변경) vs 합성 렌더러, **732문항 × 1920×1080·1280×720·1024×768·390×844** | 오프라인 Chromium | **media 없는 726문항 #screen DOM 완전 동일(측정 후)**, media 6문항 항목 수·캡션·그림 디코드·빈도표 OK, 빈 화면 0, JS 오류 0 → `F1B_RENDER_PASS` (`evidence/f1b_real_content_20261123.log`) |
| mock GAS 지연 로더(QA 번들 23단원) | Node | 732문항, 누락 그림 0, 단원당 ≤5ms |
| Node 전체 | Node/mock | **83/83 PASS** (F1-B 신규: blocksToV2, 오버레이 어댑터 fail-closed 3종, 합성 렌더러 SHA·삽입 범위, 실보고서 23/732·어댑터 분포·q21·derived 표기) |
**구분/미완료:** 위 DOM 동일성은 *브리지 대비 무회귀* 증거이지 **승인 원본 HTML과의 시각 동등성 증거가 아님** — 영어 천재(v3 화면), 사회5 2-2(화면 없음), 사회5 3-1·3-2(v0.1 렌더러)는 `visualParity: NOT_VERIFIED`, 교사 시각 검토용 QA 미리보기 대상. 수학 분수·줄바꿈 스크립트(F2) 미연결. 실 GAS·게임 버튼·전자칠판 **NOT RUN**. 합성 v3 어댑터 단위 fixture는 실데이터 보고서 시험으로 대체(전용 fixture는 후속). 콘텐츠·이미지·스크린샷 미커밋, active 0·미디어 권리 23/23 HOLD 유지.

## F2 — 수학 표기·줄바꿈 재현 + 승인 화면 DOM 동등성 (2026-11-23, 40-6R Q03)
- `experimental/unified-quiz-renderer/extract_math_display.mjs` → `HOJA_RENDERER_MATH_EXT.js`(생성 파일): 승인 수학 검수 HTML(SHA `a85650c8…` = 수학 manifest `reviewerSha256` 대조)에서 **`enhanceMath()`(분수·수식·m5u4:q13 4값 격자·m6u6:q08 ㉠~㉣ 격자)와 `rebuildOptions()`(교사 지정 보기 줄바꿈 4건)을 글자 그대로**, 해당 CSS 18규칙을 그대로 복사. 승인 HTML의 교사용 사이드바 코드·DATA 변경 코드는 복사하지 않음(교사 C는 F1에서 태그에 이미 반영). 문항 `displayProfile === 'math-reviewfix1-ui4'`일 때만 동작 → 다른 과목 무영향. `--check` drift(CI는 정본 토큰 있을 때).
- 패키저: 승인 화면에 두 수학 스크립트가 있는 단원(수학 6개)의 문항에 `displayProfile` 기록. 합성 렌더러 = 브리지(무변경, SHA 고정) + media 확장 + math 확장.

| 시험 (오프라인 Chromium, 로컬) | 결과 |
|---|---|
| **수학 187문항: 승인 수학 HTML(원본 그대로 실행) vs 합성 렌더러**, 1920×1080·1280×720 | **187/187 동일** — 문항 DOM·보기 DOM(인라인 style 제외)·수학 플래그·선택 A/C/D 레이아웃(교사 C 19 포함). 분수 43·수식 34 렌더, JS 오류 0 → `F2_MATH_PARITY_PASS` |
| **사회5 3-1·3-2 64문항: 승인 화면(렌더러 v0.1.0-preview.2) vs 합성 렌더러(브리지 v0.2)**, 2해상도 | **64/64 동일** — 문항·보기·지문 패널·그림 수·레이아웃·composition → `F2_SOC5_PARITY_PASS` (F1의 "v0.1↔v0.2 동등성 미검증"을 DOM 수준에서 해소; 픽셀 대조는 아님) |
| 브리지 vs 합성(무회귀), 732문항 × 4해상도 | 일반 539문항 DOM 동일, media 6 OK, 수학 187은 위 승인 대조로 검증, 오류·빈 화면 0 |
| Node 전체 | **84/84 PASS** |
증거: `evidence/f2_parity_20261123.log`.
**여전히 시각 동등성 미검증:** 영어 천재 6단원(승인 v3 화면은 별도 렌더러 — 지문을 별도 패널로 표시하는 등 구조가 달라 DOM 대조 불가, 교사 QA 미리보기 검토 필요), 사회5 2-2(승인 렌더러 화면 자체가 없음). 픽셀 단위 대조·실 GAS·게임 버튼·전자칠판 **NOT RUN**.

## F3 (1차) — 세 게임 모드 시험 게임 연결 + 승인 ID 기록(Q04) + 게임 LIST/GET 경로 (2026-11-23, 40-6R Q03/Q04)
**변경:**
- `game-trial/build_trial.py --renderer`: 시험 7MB 게임(운영 아님)에 **합성 렌더러**(브리지 무변경 + media + math 확장)를 주입. 기본값은 기존 브리지 그대로(하위호환). 시험 파트 파일 무변경.
- 기존 3개 시험 검증기(`verify_trial_chromium.py`·`verify_trial_team_chromium.py`·`verify_trial_arcade_chromium.py`)에 `--sources` 추가 — 사회6 고정 샘플 대신 **GAS `hojaGetApprovedQuestions`가 반환하는 실제 `[{sheetName,data}]`** 사용. `run_f3_all_units.sh`로 단원 전체 반복.
- 발견·수정한 실제 결함 2건:
  1. **그림 보기 MCQ 22문항(영어 11단원 × 2)**이 게임의 기존 보기 검증("객관식 보기 오류": 4개 비어 있지 않은 고유 텍스트)에 걸려 단원 전체 로드 실패 → 패키지 `options`(게임 내부 키)에 승인 `imageAlt`(중복·누락 시 "그림 선택지 n") 사용. 화면에는 승인 그림이 그대로 표시, rendererQuestion 불변.
  2. 사회5 3-1·3-2는 승인 태그가 없어 팀 바인딩이 `TEAM_RENDER_APPROVED_TAGS_REQUIRED`로 fail-closed → 승인 화면 자체 규칙 `defaultLayout(q)=q.image?'C':'A'`(원문 일치 확인 후)를 **derived 태그**로 기록(`DERIVED_FROM_APPROVED_PAGE_DEFAULT_LAYOUT`, needsHumanReview). 적용 후에도 승인 화면 대비 **64/64 DOM 동일** 유지.
- **Q04 수정:** `UsageTelemetryClient.html` `track()`이 숫자 ID만 허용해 승인 ID를 조용히 버리던 문제 → 구형 숫자 ID **또는** 승인 안정 ID(혼합 불가)를 전송, 판단(시대·활성)은 서버가 fail-closed. 혼합/미인식은 미전송 + `lastError` 표시.
- **게임 LIST/GET = 같은 카탈로그:** 시험 번들 `hojaListPublicCartridges`/`hojaGetPublicQuestions` 첫머리에 2줄 QA 경로 — **QA 카탈로그(격리 시험 프로젝트에서만 허용)일 때만** 승인 목록/콘텐츠 반환(제목→ID 1:1), RELEASE 카탈로그(활성 0)에서는 기존 Sheets 경로 그대로(U2 시험이 이 2줄 외 원본과 동일함을 확인).

**결과(로컬, 오프라인 Chromium + mock GAS):**
| 시험 | 결과 |
|---|---|
| **23단원 × 3모드** (시험 게임 + 합성 렌더러 + 실제 GAS 형태 소스) | **23/23 전부 통과** — 싱글: MC·OX 클릭/키보드(1~3, O/X) 정답·오답 판정 표시·점수 반영 + 인트로 오디오 게이트(오디오 재생 자체는 mock) / 팀전: 첫 풍선이 승인 iframe 렌더러로 표시 / 아케이드: iframe 전송 MC·OX 2종 (`evidence/f3_modes_20261123.log`) |
| 승인 ID 텔레메트리 → A1 | mock: 승인 시대 + 활성 카탈로그에서 정렬 ID 조합 1행 기록, 혼합 ID 미전송 |
| 렌더러 무회귀·수학·사회5 동등성 재실행 | 539 동일 + media 6 OK(4해상도) / 수학 187/187 / 사회5 64/64 |
| Node 전체 | **86/86 PASS** |
**정직한 범위 표기:** 이번 3모드 시험은 기존 검증기 방식대로 게임의 `setServerQuestions` 시험 훅으로 소스를 주입한 것이다. **시작 화면에서 실제 카트리지 목록 클릭 → LIST/GET → 모드 버튼 → 시작까지의 완전한 UI 버튼 E2E는 NOT RUN.** 팀전 **우승 발표 후 오답 복습**, 아케이드 **실제 Phaser 풍선 라운드·FINISH·랭킹 차단**, 팀 SHORT 교사 판정 흐름, 단원 전 문항 순회, 실 GAS(QA 번들 배포)·전자칠판·85인치 터치는 **NOT RUN**(다음 F3 2차). 영어 천재·사회5 2-2의 승인 원본 대비 시각 동등성은 여전히 미검증(교사 QA 미리보기 대상). 운영·원본·active 0·미디어 권리 HOLD 무변경, 콘텐츠·스크린샷 미커밋.

## F3-2 (1부) — 40-6S 필수 수정: 출시 LIST/GET·fail-closed 하네스·QA 이중 방어·교사 시각 검토 미리보기 (2026-11-23)
- **Q03 출시 LIST/GET 공백 수정:** `hojaApprovedGameCatalog_()` — QA 카탈로그(격리 프로젝트)이거나 **RELEASE 카탈로그에 배포 승인 항목이 있고 승인 시대가 시작된 경우** 게임의 `hojaListPublicCartridges`/`hojaGetPublicQuestions`가 그 카탈로그만 사용(구형 Sheets와 혼합 없음). RELEASE 활성 항목이 있는데 시대 시작 전이면 `APPROVED_ACTIVE_BEFORE_ERA_START`로 **fail-closed**. RELEASE 활성 0(현재)은 구형 경로 그대로. 증명은 저장소의 `active-deployment.json`을 바꾸지 않고 **시험 코드 안의 합성 RELEASE-활성 fixture**로: 배포된 1단원만 목록·조회, 승인만 되고 미배포인 단원 거부, 같은 카탈로그로 A1 기록, 시대 전/미래 시작일 거부(`UNIFIED_GAS_F1.test.mjs`).
- **출시 번들 콘텐츠 = 활성 ID:** `build_unified_gas.py` release 변형은 활성 항목이 있으면 `--release-content-dir`의 콘텐츠 파일이 **활성 ID·packageSha256과 정확히 일치**해야 빌드, 활성 0이면 콘텐츠 디렉터리 지정 자체를 거부(`RELEASE_HAS_NO_ACTIVE_ENTRIES`, 로컬 확인).
- **Q03 하네스 fail-open 수정:** `run_f3_all_units.sh` 삭제 → `run_f3_all_units.py`. 단원 수(기본 23) 불일치, 검증기 비정상 종료, PASS 문자열 부재, 아케이드 PASS ≠ 2, 시간 초과 중 하나라도 있으면 **exit 1**, JSON 결과 저장. 음성 시험: 보기 하나를 비운 단원 → solo/team/arcade 모두 FAIL, exit 1; 단원 수 1≠23 → FAIL.
- **Q02 이중 방어:** QA 카탈로그에 빌드 시 `allowedScriptIds`(격리 시험 프로젝트 ID, 저장소 미커밋 — `--qa-script-id` 필수) 기록, GAS가 `ScriptApp.getScriptId()` 불일치 시 `APPROVED_QA_CATALOG_SCRIPT_ID_NOT_ALLOWED`. 격리 속성 + 스크립트 ID 둘 다 맞아야 QA 카탈로그 동작.
- **교사 시각 검토 미리보기:** `approved-catalog/build_visual_review_preview.mjs` → 저장소 밖 로컬 HTML 1개(저장소 내부 출력 거부). 영어 천재 6단원은 **승인 presentation 원본 화면 자체를 같은 문항으로 이동**시켜 왼쪽, 게임 공용 렌더러(팀 모드: 원래 보기 4개 표시)를 오른쪽에 나란히; 사회5 2-2는 승인 렌더러 화면이 없음을 명시하고 교사 검토 표시 데이터(문항·그림·보기·배치·정답)를 왼쪽에 표시. 문항별 같음/다름/보류 + 메모 저장·JSON 내보내기. 234문항, 로컬 Chromium 로드 오류 0. **콘텐츠 승인·공개 허가가 아님**을 화면 상단에 표기. 산출물(4.2MB, 승인 그림 포함)은 커밋하지 않음.
- 발견(다음 작업): 게임 카탈로그 화면이 카트리지를 **구형 이름 형식 `N-과목-출판사-단원` 파싱**으로 학년/과목/출판사 분류 → 승인 제목은 모두 "기타/미분류"로 묶임. 승인 메타데이터로 분류하도록 수정 필요(F3-2 2부).
- Node **88/88 PASS**. 실 GAS·UI 버튼 E2E는 다음 커밋.

## F3-2 (2부) — 실제 게임 UI 버튼 E2E · 아케이드 전 과정 · fail-closed 23단원 게이트 (2026-11-23, 40-6S Q03/Q04)
**시험 환경(로컬 오프라인 Chromium):** QA 번들 Game.html = 시험 7MB 게임 + 합성 렌더러 + **재시도/승인 ID 텔레메트리 블록**(`build_unified_gas.py --variant qa --trial-game`, release에는 trial 게임 금지). 브라우저의 `google.script.run`은 `qa_mock_gas_server.mjs`(실제 `Code.gs`·V4·QA 카탈로그·콘텐츠를 mock 엔진에서 실행, 모의 랭킹 시트 포함, 허용 RPC 5종)로 전달. Phaser 4.2.1은 저장소 CI와 같이 `npm pack`한 로컬 파일을 CDN 대신 제공. 게임은 `http://127.0.0.1`(보안 컨텍스트, 실제 https와 같이 `crypto.randomUUID` 존재)에서 로드.

**E2E 중 발견·수정한 실제 결함:**
1. **승인 카탈로그 이름이 게임 분류 규칙과 불일치** → 승인 항목이 모두 "기타/미분류"로 묶임. 서버 LIST가 승인 메타데이터로 게임 규약 이름(`학년-[N학기-]과목-[출판사(저자)-]승인 제목`)을 생성, GET도 같은 이름으로 역조회(`hojaApprovedGameName_`). 게임 코드 무변경, 표시 라벨은 승인 제목.
2. **GET 응답 `sheetName`이 요청 이름과 달라 게임이 거부**("응답 카트리지 목록이 요청과 다릅니다") → 요청 이름을 그대로 반환(단위 시험 고정).
3. **시험 게임에 원래 텔레메트리 블록이 남아 승인 ID 사용 기록이 0건**(Q04가 시험 게임 경로에서 재발) → QA 번들 빌드가 시험 게임에도 같은 교체 블록 적용.

| 시험 | 결과 |
|---|---|
| **UI 버튼 E2E, 23단원 × (싱글·팀)** — 인트로 클릭 → [공개 카트리지] → LIST → 학년·과목·(출판사)·단원 카드(정확한 전체 승인 제목으로 선택) → GET → [혼자 놀기]→[문제 풀이 모드] 또는 [함께 놀기]→[2] → 풍선 → 승인 렌더러 문항 → (싱글) 보기 클릭 → 판정 | **46/46 PASS** (`F3_UI_E2E_PASS`). 싱글 판정 표시 23(정답 13·오답 10), 그림 표시 13건, **매 시작마다 백엔드에 A1 사용 행 1개(승인 ID·SOLO/TEAM·APPROVED 네임스페이스), watermark = 마지막 행**, JS 오류 0 |
| **fail-closed 23단원 게이트** `run_f3_all_units.py` (싱글 MC/OX 클릭·키보드, 팀 첫 풍선, 아케이드 iframe 2종) | **23/23 PASS, exit 0** (실패·단원 수 불일치 시 exit 1 음성 시험 완료) |
| **실제 Phaser 아케이드 전 과정** (기존 검증기 + `--sources` 승인 단원): 풍선 25개 원본 `showQuiz` 판정·점수, 26번째 차단, **오답 복습 12문항(점수 불변)**, FINISH 결과, **랭킹 화면 읽기 전용(serverSaved=false)**, 한글 IME 이름, TIME UP | **7단원 전부 PASS**(수학5-2 4, 영어 천재 5-10(q21)·6-10(빈도표), YBM 6-10, 사회5 2-2(overlay)·3-1, 사회6 3-1) — 각 31개 검사점, 기존 사회6 샘플 기본 실행도 재확인 PASS (`evidence/f3_2_ui_e2e_20261123.log`) |
- 검증기 수정: 같은 묶음(groupId)에 MC·OX 변형이 있는 단원(사회5 2-2)에서 기록된 유형까지 맞춰 문항 선택, 아케이드 문항·복습 확인을 화면 텍스트 대신 렌더러 `current().id`로(승인 수학 표기는 `[[frac:a/b]]` 원문을 분수로 그려 텍스트가 정상적으로 달라짐), 단원 카드는 전체 제목 일치로(영어 천재 제목 앞부분 중복), 떠다니는 풍선은 강제 포인터 클릭(애니메이션 중 클릭이 실제 사용).
**여전히 NOT RUN:** 팀전 **전 풍선 진행 → 최종 결과(다음×3) → 우승 → [오답 복습 시작]** 전체 흐름(경로 확인: `advanceFinal` stage 3에서 오답 수만큼 복습 버튼), 팀 SHORT 교사 판정 흐름, 그림 보기 22문항 내부 대체 라벨이 결과/복습 화면에 노출되지 않는지, 실 GAS(QA 번들 실제 배포)·전자칠판·85인치·QR·오디오 실제 재생. 운영·원본·active 0·미디어 권리 HOLD 무변경.

## F3-3 — 출시 후보 조립 · 실제 힌트/정답 단서 검사 · 팀전 끝까지 · 입력 경합 재평가 (2026-11-23, 40-6T/V/W/X)
**경계:** 아래 수치는 모두 **Claude 로컬 오프라인 Chromium + mock GAS** 측정이며 GPT-6 독립 감수 전이다. 실 GAS·실 기기·교사 승인·운영 배포와 무관. `active-deployment.json` entries 0, 미디어 권리 23/23 HOLD, 운영/원본/`versions/2.0.0` 무변경. 원시 로그(ID·수치만, 문항/미디어 본문 없음, 로컬 경로는 `<SCRATCH>`/`<REPO>`로 치환)는 `experimental/usage-v4-unified/evidence/f3_3/`.

### 1. 출시 후보(RC) 조립 — `build_unified_gas.py --game approved-rc`
- 고정 2.0.0 스냅샷 `4ac5c4ef…` 검증 → 부품 **14/22만** 교체(part14 `cc872d05…`, part22 `f8b623b5…`) → 합성 렌더러(브리지 `12b76fbb…` 무수정 + media `6e8a77f1…` + math `04ac96ba…` + input-guard v2 `82b6b937…`, 합성 `d9e5547d…`) → RC 게임 `617f2228…`. 상세: `rc_release_build.json`, `composed_renderer_shas.json`.
- 시험용 RELEASE 경로: `approved-catalog/make_synthetic_release.mjs`가 **저장소 밖**에 `SYNTHETIC-TEST-ONLY-NOT-A-DEPLOYMENT` 23개 항목 카탈로그를 생성(각 `deploymentStatus: SYNTHETIC_TEST_ONLY_NOT_DEPLOYED`). 빌더는 `--synthetic-release-catalog`일 때 출력이 저장소 밖인지 mkdir 전에 확인하고 deploymentId 접두어를 강제.
- **RC 감사 `verify_release_candidate.py`:** 원본 SHA·변경 부품·브리지 SHA·게임 SHA·마커(media/math/input-guard/HOJA_TRIAL_APPROVED_HTML/hoja_usage_pending_v1)·구 텔레메트리 블록 부재·QA 전용 물질 금지 목록(QA_TEST_ONLY 빌드 타입, qa-preview, hojaV4TestEvidenceU3/SetupU3, qa_mock_gas_server, MOCK_ISOLATED_TEST_SCRIPT_ID, QA_PREVIEW_NOT_DEPLOYED)·카탈로그에 `allowedScriptIds` 없음.
  - 커밋 기준 RELEASE 빌드(활성 0/콘텐츠 0): **PASS** (`rc_audit_release.txt`).
  - 합성 RELEASE 빌드(23/23 SYNTHETIC 표시): **PASS** (`rc_audit_synthetic.txt`).
  - 음성 시험: QA 번들을 RELEASE로 위장 → **FAIL**(의도대로).
  - 오탐 1건 수정 이력: Code.gs의 QA 가드 **코드** 문자열 `allowedScriptIds`가 걸림 → 검사 범위를 카탈로그 데이터로 한정.

### 2. 입력 경합 — 원인 재평가(40-6X)와 identity guard
- **하네스 원인(정정):** 이전 "q20/q14 오채점"은 시험기가 `load` 직후(게임 `show` 약 30ms 전) 브리지의 **기본 첫 문항**을 정답 근거로 읽고, 선택자 클릭이 실제 문항의 같은 choice id로 재지정된 결과였다. `show` 확인 후 클릭하는 엄격 시험에서 **수정 전 빌드도 3/3 PASS**(`PREFIX_strict_harness_run1..3.txt`, 각 3단원 59문항 오류 0). 당시 실패 로그는 보존(`HISTORY_scoring_hint_old_harness_1fail_of_196.txt`, `HISTORY_captured_default_render_click*.{txt,json}`, `HISTORY_hint_run_settle*_exit1_tail.txt`).
- **폐기한 방식(이력):** ① 150ms 시간창 — 빠른 정상 탭 57회 차단(40-6W 보고) → 폐기. ② "첫 답 후 소비" rule 4 — 호스트가 버린 탭 뒤에도 해당 문항을 잠가 진행 정지 → 제거. ③ 초기 측정 20탭 전부 미등록(`HISTORY_race_20_instant_taps_all_unregistered.json`). ④ hazard 7건으로 보였던 측정은 **탭 시점이 아니라 대기 전 visibleQ를 읽은 시험기 결함**(`HISTORY_race_sweep_FALSE_HAZARD_visibleQ_read_before_delay.json`) — 시험 오탐으로 기록.
- **최종 guard v2(`HOJA_RENDERER_INPUT_GUARD.js`, 시간창 없음):** 1) `load`~`show` 사이 선택지 숨김·무효, 2) 누름과 뗌이 같은 그리기 세대의 같은 버튼일 때만 유효, 3) 다른 문항 ID로 찍힌 버튼 무효. 채점 코드 무변경(차단 탭은 오답이 아니라 미입력).
- **사전/사후 동일 오라클 비교(`verify_f3_input_race.py`, 2단원 × 21탭, 지연 0/16/33/50/100/200/300ms, 탭 순간 표시 문항 vs 게임 문항):**
  - 수정 전 rcA: probes 42, registered 30, **hazard 0**, dropped 12(0·16ms 탭 — 호스트가 `show` 안정화 전 답을 받지 않음).
  - 수정 후 rcE: **동일** 42/30/0/12 → guard로 인한 **추가 입력 손실 0**.
  - 따라서 "수정 전 빨간 시험"은 **재현되지 않았다**(가짜 RED 만들지 않음). guard는 실측 결함 수정이 아니라 `load`~`show` 창의 방어적 보호로 분류.
  - 채점기 직접 비교(scorerMismatch: 등록된 탭의 correct 증가량 == 탭한 보기가 게임 문항 정답인지): 결과는 아래 표.

### 3. 최종 회귀(수정 후 rcE 합성 RELEASE Game.html)
| 시험 | 결과 / exit | 증거 |
|---|---|---|
| 23단원 정답·단서·3지/OX·그림 보기 라벨 비노출, settle 0ms | **PASS** 196문항(MCQ 158·OX 38·그림 12·cue 1), leaks 0·mappingFail 0·verdictFail 0, exit 0 | `scoring_hint_FIXED_settle0.txt` |
| 동일, settle 700ms | **PASS** 동일 수치, exit 0 | `scoring_hint_FIXED_settle700.txt` |
| RC 감사(release / synthetic) | **PASS / PASS** | `rc_audit_*.txt` |
| 입력 경합 + 채점기 직접 비교(재실행) | 수정 전 rcA: 42/31/hazard 0/dropped 11/**scorerMismatch 0**, exit 0 · 수정 후 rcE: 42/30/hazard 0/dropped 12/**scorerMismatch 0**, exit 0 (0ms 탭 전후 모두 0/6 등록, 16ms 탭 전 1/6·후 0/6 — 호스트 안정화 타이밍 편차) | `race_scorer_PREFIX.*`, `race_scorer_FIXED.*` |
| 팀전 전체(3단원) | **IN PROGRESS 1/3:** math5-s2-u4 24턴(MCQ 16·OX 5·SHORT 3 교사 판정), 우승, 오답 12=복습 12, 210:40, A1 TEAM 1행, 랭킹 RPC 0. eng5·soc6 실행 중 | 후속 커밋 |
| UI E2E 23단원 × 싱글/팀 | IN PROGRESS | — |
| F1-B 렌더 732×4, 수학·사회5 동등성 | IN PROGRESS | — |
| 아케이드 2단원 | IN PROGRESS | — |
- **guard 이전 RC(rcA)로 이미 끝난 시험(이력):** 팀전 math5-s2-u4·eng5-ham-u10·soc6-s2-u3-1-common 각 24턴, SHORT 교사 판정 eng5/soc6 각 2, 우승 발표, 오답 12 = 복습 12, 복습 후 점수 불변, A1 TEAM 1행, 랭킹 RPC 0 → **PASS**(`team_full_PRE_GUARD_*.txt`). UI E2E 46/46 PASS(150ms guard 빌드, `ui_e2e_PRE_GUARD_rc_release_46.txt`).

- Node 단위 시험(usage-v4-unified + approved-catalog): **90/90 PASS, exit 0** (`node_tests_90.txt`).

### 4. 남은 것 / 이월(F4)
- 실 GAS A1·익명 통계, R7 자정, 80–120 동시 부하, 탭 닫힘 복구, 교사 234문항 시각 검토, private QBank pin CI(SKIPPED), 85인치 실기, 미디어 권리 23/23 HOLD → **NOT RUN/HOLD 그대로 F4/F5/G 이월**.
- 0·16ms 즉시 탭은 수정 전후 모두 호스트가 받지 않음(학생은 다시 탭). UX 영향 판단은 실기기(전자칠판) 시험에서 확인 필요 → F4.

### 5. F3-3 후속 — 나머지 회귀 확정 (40-6Z 반영, 체크리스트 40-6AA)
- **정정:** §3의 힌트 시험은 23단원 목록을 순회했지만 실제 검사는 **196문항/7개 단원**(비무작위 표본). 40-6Z 교사 결정으로 표본 PASS 종료, 재실행 안 함.
- 수정 후 rcE에서: **팀전 3/3 PASS**(SHORT 교사 판정 3·2·1, 오답 12=복습 12, A1 1행, 랭킹 RPC 0), **UI E2E 46/46 PASS**, **아케이드 2/2 PASS**, 모두 exit 0.
- **검증기 결함 2건(제품 결함 아님):**
  1. guard v2의 `data-hoja-gen` 속성을 렌더/수학 동등성 검증기가 제외하지 않아 **1차 FAIL(exit 1)**. 진단으로 차이가 보기 버튼의 이 속성뿐임을 확인 → 두 guard 속성만 제외 → 렌더 539/539 × 4, 수학 187/187 PASS.
  2. `verify_f2_soc5_parity.py`가 차이가 있어도 **항상 exit 0**(fail-open) → fail-closed로 수정, 음성 시험 exit 1 확인, 재실행 64/64 PASS.
- 원시 로그: `evidence/f3_3/` (HISTORY_* 실패 이력 포함).

## F4 (1차) — 격리 GAS 실증 시도: 프로젝트 크기 한도로 push FAIL (2026-11-23, 40-6AB 승인 코멘트 7102127261)
**승인 범위:** 기존 격리 시험 프로젝트에 대한 시험용 `clasp push`만. 웹앱 배포는 선생님이 편집기에서 직접. 운영 GAS·EVENT_LOG·랭킹·`main`·활성화·merge 금지.

**푸시 전 안전 검증(로컬, ID 비공개):**
- 대상 = R6와 같은 격리 프로젝트(로컬 `.clasp.json` 3곳 동일 ID, `clasp list` 이름 접두 "HOJA V4 40-6U ISOLA"). 운영 프로젝트("SUPER MARIO QUIZ…" 등)와 별개.
- 원격 현재 내용 = R6 번들(Game.html `f9647ad6…`) → 푸시 전 전체 백업.
- 격리 조건은 서버 코드가 fail-closed로 강제: `HOJA_V4_UNIFIED_ISOLATION=COPY_40_6U_ONLY`, 저장 ID ≠ 운영·인증 사본·랭킹, 사본 `_HOJA_USAGE_TRIAL_ONLY` A1/B1 카나리. 시험 전용 설정 파일의 세 시트 ID가 서로 다름(집합 크기 3) 확인.
- 번들: QA 변형 + `--game approved-rc`, 31파일, 23단원/732문항, QA 카탈로그 `QA_TEST_ONLY` + `allowedScriptIds`=격리 프로젝트 1개. 게임 `876933…`(= F3-3 감사 RC, 원본 `4ac5c4ef…`, 부품 14/22). 서버 4파일 저장소와 바이트 동일. 매니페스트 원격과 동일.
- **로컬 사전 시험(mock):** 실제 격리 ID 번들을 다른 프로젝트에서 열면 `APPROVED_QA_CATALOG_SCRIPT_ID_NOT_ALLOWED`(음성 PASS). mock ID 쌍둥이(카탈로그 ID만 다름): UI E2E 4/4, 팀전 전체 1단원(SHORT 4 교사 판정, 12=12, A1 1행, RPC 0) exit 0.
- 시험 전용 파일에 F4용 꼬리 검사 함수 `hojaV4TestTailF4` 추가(토큰 보호, 공개 승인 ID·모드·날짜·스키마·중복 수만 반환). 저장소 템플릿 `test-only/TestOnlyU3.template.gs`에 같은 함수(비밀값 없음).

**결과 — FAIL(push 단계):**
- `clasp push`: "Skipping push."(비대화형 매니페스트 확인 기본값) → 전송 없음.
- `clasp push --force`(매니페스트 동일 확인 후): **"The project is too large to save." exit 1.**
- 푸시 후 `clasp pull`: 원격 9/9 파일 백업과 바이트 동일 → **원격 변경 없음, 배포 없음, 시험 시트 영향 없음.**
- 크기: 푸시 14,766,720 B(Game.html 8,613,936 + 승인 콘텐츠 23파일 6,036,252) vs 현재 원격 7,309,075 B → 이 프로젝트의 한도는 그 사이.
- 우회(단원 삭제·데이터 축소·검사 해제) 하지 않음. 증거: `evidence/f4/f4_isolated_push_attempt.txt`, `evidence/f4/f4_local_preflight.txt`.

**의미:** 승인 콘텐츠를 GAS 프로젝트 안 `.gs` 파일로 넣는 현재 RELEASE 설계는 23단원 전체 + 게임을 한 프로젝트에 담을 수 없다. F4 실 GAS 시험과 향후 RELEASE 모두 설계 결정 필요(예: 단원 일부만 시험, 콘텐츠를 프로젝트 밖 저장소에 두고 SHA 검증 후 로드, 게임 자산 경량화). **결정 전까지 F4 실 GAS 항목 NOT RUN.**
