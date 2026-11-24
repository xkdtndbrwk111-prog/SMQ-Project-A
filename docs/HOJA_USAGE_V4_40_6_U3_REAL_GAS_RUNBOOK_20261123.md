# 40-6-U3 실 Apps Script 격리 시험 절차 (단일 Project A, 미실행)

> 상태: **NOT RUN / BLOCKED — 교사(저장소 소유자) 승인 대기.** Claude는 이 절차를 실행하지 않았다.
> 운영 Project A GAS·운영 EVENT_LOG·랭킹·운영 배포는 어떤 단계에서도 사용하지 않는다.

## 왜 Claude가 혼자 실행하지 않았나
- 실 GAS 시험은 사용자 Google 계정에 (1) 인증 사본의 **새 복제본(실 이벤트 원본 포함)** 생성, (2) 새 Apps Script 프로젝트 생성, (3) 익명 브라우저 e2e를 위한 `ANYONE_ANONYMOUS` **공개 URL 배포**가 필요하다. 공개 URL 생성은 외부 노출 행위이므로 별도 승인이 필요하다고 판단했다.
- 현재 세션의 Google Drive 커넥터는 인증 사본에 쓰기 권한이 없고(적절), 시트 범위 읽기·셀 쓰기 기능이 없다.

## 준비 (교사 또는 승인 후 Claude)
1. 인증 사본(61일 COMPLETE)을 Drive에서 **사본 만들기** → 이름 예: `HOJA_USAGE_V4_40_6U_WRITE_COPY_시험전용`. 원본 인증 사본은 이후 열지 않는다.
2. 새 사본의 `_HOJA_USAGE_TRIAL_ONLY!B1`에 `HOJA_V4_40_6U_WRITE_COPY` 입력(A1의 `HOJA_RETENTION_SANDBOX_V1` 유지).
3. 로컬에서 묶음 생성: `python3 experimental/usage-v4-unified/build_unified_gas.py --output <빈 폴더>` → Game.html SHA-256 `4ac5c4ef…` 확인.
4. **새 독립 Apps Script 프로젝트**(운영 프로젝트 아님)에 위 폴더 업로드(`clasp create --type standalone` 후 `clasp push`, 또는 편집기 붙여넣기).
5. Script Properties:
   - `SMQ_USAGE_SPREADSHEET_ID` = 40-6U 쓰기 사본 ID
   - `HOJA_USAGE_PRODUCTION_SPREADSHEET_ID` = 운영 원본 ID(열지 않음, 비교용)
   - `HOJA_USAGE_CERTIFIED_COPY_SPREADSHEET_ID` = 61일 인증 사본 ID(열지 않음, 비교용)
   - `HOJA_V4_UNIFIED_ISOLATION` = `COPY_40_6U_ONLY`
   - `HOJA_PROD_RANKING_SPREADSHEET_ID` = **비워 둠**(랭킹 시험 제외 → `HOJA_PROD_RANK_NOT_CONFIGURED`가 정상) 또는 별도 랭킹 시험 사본
6. 편집기에서 `hojaV4OpsStatus` 실행 → `enabled:true`, `sealedThrough:2026-11-22`, `sealedPrefixEndRow:17673`, `committedWatermark:null` 확인.

## 시험 순서와 기대값 (모두 쓰기 사본에서만)
| # | 실행 | 기대 |
|---|---|---|
| R1 | 편집기 `getPublicUsageStatisticsV4` | watermark 미초기화 → `UNAVAILABLE/NOT_CONFIGURED` (0 표시 아님) |
| R2 | 테스트 배포(웹앱, 실행 USER_DEPLOYING·액세스 ANYONE_ANONYMOUS) 후 **로그인 안 된 새 시크릿 창**에서 게임 1회 시작 | EVENT_LOG +1행, watermark=17674, 시트 쓰기는 이 사본만 |
| R3 | 시크릿 창 `?view=stats` | 전체 **17,671**(=17,670+1), 오늘 1 `LIVE_PROVISIONAL`, 61일 확정 일별·0회 4일 표시, 버킷 3,969 행은 변경 없음 |
| R4 | 시크릿 창 개발자도구 `google.script.run.hojaV4OpsSealPendingDays()` / `hojaV4OpsStatus()` / `hojaV4uSealPendingDays_(7)` / `setupUsageRollupShadowU3S1()` | 앞 둘 `HOJA_V4_OPS_DENIED`, 뒤 둘 "함수를 찾을 수 없음" |
| R5 | 시크릿 창에서 같은 eventId로 `recordUsageStartU1` 2회(동일 내용) / 팀 수만 바꿔 1회 | 신규 행 0 / `USAGE_EVENT_ID_CONFLICT` |
| R6 | 두 시크릿 창에서 각 20회 게임 시작을 동시에, 그 사이 통계 연속 새로고침 | EVENT_LOG 정확히 +40, 통계는 항상 commit된 값(감소·부분값 없음), `USAGE_APPEND_LOCK_TIMEOUT` 발생 시 건수 기록 |
| R7 | 다음 날 00:00~00:10 KST 통계 조회 후 편집기 `hojaV4OpsSealPendingDays` | seal 전 `provisionalDays` 2일, seal 후 manifest 62행 COMPLETE·SHA 64hex, 숫자 불변 |
| R8 | 사본에서 버킷 1셀 수정 후 통계 | `UNAVAILABLE/INTEGRITY` (숫자 없음). 복구 후 OK |
| R9 | 실행 시간 기록 | 통계 재계산 1회 소요(목표 < 10s), seal 1일 소요, 캐시 적중 응답 시간 |
| R10 | 종료 | 테스트 배포 **보관(archive)**, 프로젝트 공유 없음, 사본은 시험 증거로 보존 |

## 보고 형식
각 R 항목: 실행 시각 KST, 실행 주체(편집기/시크릿 창), 결과 PASS/FAIL, 비식별 증거(건수·SHA 앞 8자리·오류 코드). 시트 ID·eventId·배포 URL은 GitHub에 쓰지 않는다.
