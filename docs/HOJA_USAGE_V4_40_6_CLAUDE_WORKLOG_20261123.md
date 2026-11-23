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
