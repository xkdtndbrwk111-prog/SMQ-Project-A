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
