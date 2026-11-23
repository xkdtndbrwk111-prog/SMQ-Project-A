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
