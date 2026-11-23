# Claude Code 작업 지시서 — HOJA/SMQ V4 40-6 실제 Project A/B 격리 연동 검증
작성일: 2026-11-23 (KST)
상태: 지시서 등록 / 실 GAS 연동 NOT RUN / 운영 전환 HOLD

## 역할 및 절대 금지
- Claude Code = 구현·실험·로그 제출. GPT-6 = **독립 감수자**로 GitHub 소스·CI·증거를 검토한 뒤 중앙 체크리스트에 PASS/FAIL/HOLD 기록. Claude Code는 본인 작업을 최종 승인하지 않는다.
- 작업 저장소: `xkdtndbrwk111-prog/SMQ-Project-A`. 기준 브랜치: `work/unified-quiz-renderer-20261122`. 이 브랜치의 최신 HEAD에서 **별도의 40-6 작업 브랜치**를 만들어 원자적 소단위 커밋/PR을 남겨라. 변경된 상위 HEAD와의 관계를 확인한다.
- `main`, `versions/2.0.0`, Project A/B **운영 Apps Script**, 운영 원본 `EVENT_LOG`, 실사용 Manager, 랭킹 TOP25, 배포 설정·트리거·삭제/보관 로직 **변경 금지**. 이 작업은 코드/테스트/이중 시험 사본에만 국한한다.
- 원본 스프레드시트 ID, 민감한 Script Properties, 토큰, 학생·학교·개별 이벤트 값은 코드/PR/CI/문서에 남기지 않는다. 필요한 ID는 각 **격리 시험 GAS의 Script Properties에만 수동 저장**.
- 이력 61일 완료/통계 17,670회는 **2026-11-22까지의 이전 시험 복사본 스냅샷**. 현재 운영 실시간 수치인 것처럼 쓰지 말 것.
- 실 Google Apps Script 엔진을 호출하지 않았다면 무조건 `NOT RUN`. Github mock PASS와 Google Sheets connector PASS를 실제 GAS PASS로 표현하지 말 것.

## 반드시 먼저 읽을 경로
1. `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md` 중 40-1~40-6B
2. `docs/HOJA_USAGE_V4_REBUILD_PLAN_20261123.md`
3. `docs/HOJA_USAGE_V4_REAL_COPY_BACKFILL_20261123.md`
4. `docs/HOJA_USAGE_V4_40_6_AB_GAS_TRIAL_RUNBOOK_20261123.md`
5. `Code.gs`의 `recordUsageStartU1()`, `experimental/usage-retention/HOJA_USAGE_V4_{CORE,LIVE_TAIL,TRIAL_GAS,LIVE_TRIAL_GAS,APPEND_GUARD_TRIAL}*`, 및 관련 CI.

## 검증 불변식 / 기준
- 기존 시험 복사본은 2026-09-23~11-22의 검증된 61일, 원본 17,672행, 고유 플레이 17,670, 동일 이벤트 재전송 2, 검증된 0회 날짜 4일, V4 버킷 3,969, 최종 확정 원본 위치 17,673. 이미 검증된 `COMPLETE` 표기를 근거 없는 수정으로 덮어쓰지 않는다.
- 원본 `EVENT_LOG`를 통계 화면마다 전체 재조회하지 않는다. 과거는 SHA-256 검증 완료 요약, 오늘은 인증된 sourcePrefixEndRow 다음 꼬리만 읽는다.
- 기존 Project B `getUsageStatisticsU2()`와 `requireUsageStatisticsAccessU3_()`의 의미 및 lazy RPC를 유지한다. OWNER/현재 유효 GOOGLE CREATOR만 허용; EDIT_CODE-only, PENDING, BLOCKED, 만료·철회는 차단.
- V4와 U2 누적값 차이 2건은 기존 기록의 중복 재전송 때문이며 정상화 차이로 분리 보고. U2와 V4의 다른 모든 집계 불일치는 숨기지 말고 FAIL/HOLD.
- 각 프로젝트의 ScriptLock은 **서로 공유되지 않는다**. A 작성 중 B의 부분 읽기, 날짜 전환, 비정렬/지연 이벤트를 차단하거나 명시적 보류로 처리한다.

## 단계 0 — 시작점 및 추가 격리
- 현재 브랜치 HEAD/CI를 확인하고 작업 범위를 기록한다. 별도 작업 브랜치 생성; 기존 승인 빌드/운영 파일의 변경 여부 검증.
- **기존 V4 61일 검증 복사본에는 쓰지 않는다.** 그 복사본을 다시 한 번 복제한 '40-6 쓰기 시험 전용 복사본'을 새로 만든다. 새 파일의 `_HOJA_USAGE_TRIAL_ONLY!A1` 표식, `HOJA_V4_BACKFILL_AUDIT`, V4 61일 COMPLETE, 버킷 SHA와 최종 watermark를 재확인한다.
- 사용 가능한 인증된 Google API/Apps Script 실행 경로가 없으면 `BLOCKED: GAS runtime access`로 기록. 성공한 척 시뮬레이션 로그를 작성하지 않는다.

## 단계 1 — Project A 격리 Apps Script 기록 테스트
- `Code.gs` U1와 의존 코드, `HOJA_USAGE_V4_APPEND_GUARD_TRIAL.gs`를 **격리 A 테스트 GAS**에 구성한다. 시험 속성은 runbook 참조:
  `SMQ_USAGE_SPREADSHEET_ID`, `HOJA_USAGE_TRIAL_SPREADSHEET_ID`, `HOJA_USAGE_PRODUCTION_SPREADSHEET_ID`, `HOJA_USAGE_V4_TRIAL_APPEND_GATE=COPIED_SHEET_ONLY`.
- 실제 PUBLIC 카탈로그에 존재하는 시험용 cartridgeId와 새 UUID를 써서 오늘 KST 기준 1회 시작 기록. 15열 스키마/행수/성공 반환 확인.
- 같은 이벤트 ID + 같은 게임 내용은 2회 전송해도 신규 행 0개. 같은 ID + 다른 모드/팀/카트리지는 거부. 지연 전일 ID 재전송도 중복 저장 방지. 미래/과거 날짜 삽입, 잘못된 사본 ID, canary 불일치, 해제된 옵트인 플래그의 기존 경로 각각 검사.
- 전역 이벤트 ID 전체 검색 방식은 COPY 시험용이므로 **운영에 그대로 이식하지 말고** 성능/원자적 경계 대안만 제안한다.

## 단계 2 — Project B 격리 GAS 권한 및 통계 조회
- **실제 B UsageU2.gs의 권한 함수와 필요한 의존성**으로 별도 B 테스트 GAS 구성. 다른 GitHub 저장소가 보이지 않으면 실제 사용 가능한 B 프로젝트/소스 경로부터 확인; 임의 인증 mock으로 실권한 PASS를 쓰지 않는다.
- `HOJA_USAGE_V4_CORE.js`, `HOJA_USAGE_V4_TRIAL_GAS.gs`, `HOJA_USAGE_V4_LIVE_TAIL.js`, `HOJA_USAGE_V4_LIVE_TRIAL_GAS.gs`를 시험 B에 설치. 같은 **40-6 전용 새 쓰기 사본**을 가리키게 한다.
- `getUsageStatisticsU4TrialShadow(creatorToken)` 직접 실행. 허용된 OWNER/현재 GOOGLE CREATOR 및 거부 상태(EDIT_CODE-only/PENDING/BLOCKED/만료/철회)의 **Sheets 열기 이전 인증 선행** 검증.
- 응답 `today,days7,days30,all,daily,mode,teamCount,repositoryKind,grade,subject,publisher,topCartridges`를 U2와 동등한 기준으로 대조. 개별 UNIT_SELECTION 합계를 조합 TOP20으로 오인하지 않는다.
- 누락 0일/비 COMPLETE/버킷 SHA 불일치/오늘 미완성 15열/PRIVATE·미분류/과거 날짜 꼬리/오늘 행수 변경은 반드시 안전하게 실패하는지 확인.

## 단계 3 — 두 프로젝트 동시 기록/조회 및 날짜 경계
- 실 A 쓰기와 실 B 읽기를 좁은 건수로 교차 실행. 서류상 mock가 아니라 두 개의 **독립된 GAS 실행 로그**로 입증. 기록 중 조회가 불완전 값을 정상 통계로 표시하는 순간 FAIL.
- 특히 자정 KST 직전/직후, 어제 COMPLETE 누락, 꼬리 sourceLastRow 변동을 확인. 시각 제어가 불가능하면 `NOT RUN` 유지하고 재현 테스트 계획만 작성한다.
- 현 B의 앞뒤 `getLastRow` 비교는 완전한 동시성 보증이 아님. A 소유 원자적 commit watermark/index 없이 강한 동시성 PASS를 선언하지 않는다.
- 만약 시험 시점이 2026-11-24 이후라면 11/23에 대한 COMPLETE가 없으면 새 B 조회는 HOLD가 정상이다. 검증되지 않은 날짜를 0회 COMPLETE로 임의 채우지 않는다.

## 단계 4 — 회귀·결산
- GitHub Actions 자동시험과 (가능하면) 실제 GAS 시험 로그를 구분해 기록.
- `docs/HOJA_USAGE_V4_40_6_CLAUDE_WORKLOG_20261123.md`에 각 단계별 시각, 커밋 SHA, CI 실행 링크, 실제/모의 실행 종류, 데이터 변경 대상(사본만), 출력 증거, PASS/FAIL/BLOCKED/NOT RUN을 추가한다.
- 단계가 하나 완료될 때마다 **코드 + 시험 + 작업 로그를 같은 커밋**에 묶고 작업 브랜치에 push. 중앙 체크리스트 `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md`는 GPT-6 독립 검수자가 관리하므로 **직접 PASS 처리하지 마라**.
- 완료할 때 PR 또는 diff 범위, 실행 명령, 테스트 프로젝트의 비식별 구성 정보, 실패·미검증 항목, 다음 단계 제안 제공.
- 담당 감수자가 승인하기 전 merge/운영 배포/원본 삭제/트리거 설치 금지.

## 중지 조건
운영·사본 ID 혼선, 원본 파일 쓰기 위험, 인증 우회, 실제 GAS 실행 불가, 데이터 무결성 불일치, 날짜 누락, 비정렬 이벤트, 불완전 집계 노출, 권한 거부 실패 → 즉시 STOP/HOLD, 증거와 최소 재현만 기록하고 운영 변경 없이 보고.
