# HOJA 2.0 — 신규 문제은행 운영 연결 절차서 (40-6BM, 2026-11-24)

**상태: 준비 문서. 운영 GAS·시트·랭킹·배포는 아직 아무것도 바꾸지 않았다.**
아래 "확인 필요 3가지"가 답해지면 그대로 실행한다. 원칙은 다음과 같다.
- 기존 운영 게임·학생 기록·랭킹을 보존한다.
- 격리 사본 전용 설정을 운영에 옮기지 않는다.
- 언제든 1분 안에 되돌릴 수 있어야 한다.

## 0. 확인 필요 3가지 (교사)
1. **운영 프로젝트가 어느 것인가.**
   - `clasp list`의 "SUPER MARIO QUIZ…"를 읽기 전용으로 확인했더니 HOJA 2.0 구성이 아니었다(Code.js 627 KB, Feedback·Supabase, Index/Script/Styles). 받은 사본은 즉시 삭제했다.
   - HOJA 2.0 운영 프로젝트(`Code.gs` + `Game.html` + `UsageRollupU3S.gs`)의 **편집기 이름이나 주소**가 필요하다. 이 계정의 다른 프로젝트 이름에도 해당하는 것이 보이지 않는다.
2. **전환하면 게임 목록이 신규 23단원으로 바뀐다.**
   - 운영 빌드는 승인 단원이 활성화되면 공개 목록을 **승인 23단원만** 보여준다. 기존 시트(Project B) 카트리지는 목록에서 빠진다(시트와 기록은 그대로 보존).
   - 그대로 진행해도 되는가.
3. **전환 순간에 `HOJA_USAGE_APPROVED_ERA_START`를 설정해야 한다.**
   - 운영 빌드는 이 값이 없으면 승인 목록 자체를 거부한다(`APPROVED_ACTIVE_BEFORE_ERA_START`). 즉 "통계는 정식 배포 때 연결"이 이 순간이다.
   - 값은 전환일(예: 전환 당일 KST 날짜)로 한다. 그날 이전 기록은 기존(legacy) 집계로 남는다.

## 1. 운영 빌드 준비 (저장소만, 운영 무변경)
- `approved-catalog/deployment/active-deployment.json`에 23단원을 기록한다. 항목마다 다음을 넣는다.
  - `teacherDeploymentApproval: APPROVED`, `approvedOn`
  - 정확한 `effectiveSha256`
  - `rendererGate: PASS`, `questionValidationGate: PASS`(근거: F3-3 렌더 732×4, 40-6BF/BK 실플레이)
  - `mediaRightsAcknowledged: true`(교사 결정 40-6AZ)
- `build_active_catalog.mjs`에 `--content-commit`을 추가한다. 카탈로그는 `GITHUB_RAW_PINNED_V1 @ 440cc1f`(공개 게시본, 23/23 SHA 일치)를 쓰고, 내장 콘텐츠는 0개로 한다.
- 안전장치를 갱신한다. 지금은 "커밋된 운영 빌드 = 활성 0개"로 강제하고 있다. 이를 "활성 항목이 있으면 반드시 고정 commit 원격 소스와 내장 콘텐츠 0개"로 바꾼다(`UNIFIED_GAS_F1` 시험, `verify_release_candidate.py`).
- 운영 번들은 다음으로 구성한다(크기 약 8.77 MB, 격리 프로젝트 저장 성공 크기).
  - 통합 release 8파일
  - 운영의 `UsageRollupU3S.gs`(그대로 유지: 매일 00:15 집계 트리거가 참조)
  - 운영의 `appsscript.json`
- 전역 이름 충돌 검사: 통합 5개 .gs와 `UsageRollupU3S.gs` 사이에 중복 0, 한 전역으로 합친 문법 검사 OK(40-6BM).
- 운영 설정에서의 동작(코드 근거):
  - 격리 속성(`HOJA_V4_UNIFIED_ISOLATION`)이 없으면 V4 copy-only 경로는 꺼지고, 사용량은 기존 U1 방식으로 운영 `EVENT_LOG`에 기록된다.
  - 루트 `Code.gs`의 opt-in 가드는 속성이 없으면 동작이 같다.
  - 랭킹은 `HOJA_PROD_RANKING_SPREADSHEET_ID`를 그대로 쓰고, 새 단원 ID로 새 랭킹판이 생긴다. 기존 랭킹은 보존된다.
- mock 검증: 운영형 속성(격리 속성 없음, 시작일 설정)에서 LIST 23, GET, 시작 기록 1행을 확인한다. 기존 시험은 반복하지 않는다.

## 2. 백업 (전환 직전, 읽기 전용)
1. `clasp pull`로 운영 프로젝트 전체 파일을 받는다. 로컬 보관만 하고 커밋하지 않는다.
2. 운영 웹앱 **현재 배포 버전 번호**를 기록한다(배포 관리 화면). 되돌리기의 핵심이다.
3. 스크립트 속성 **이름 목록**과 트리거 목록을 기록한다(교사가 편집기에서 확인, 값은 적지 않음).

## 3. 전환 (수업 없는 시간)
1. Claude: 운영 프로젝트에 운영 번들을 `clasp push`한다. HEAD만 바뀌고 학생용 배포 주소는 아직 이전 버전이다.
2. 교사: 프로젝트 설정 → 스크립트 속성에 `HOJA_USAGE_APPROVED_ERA_START = 전환일`을 추가한다.
3. 교사: 배포 → 배포 관리 → 운영 웹앱 연필 → 버전 "새 버전" → 배포. 주소는 그대로다.
4. Claude: 운영 주소에서 대표 확인만 한다.
   - 싱글: 시작 → 문제 입력 → 결과
   - 팀전: 시작 → 진행
   - 아케이드: 시작
   - 통계 화면 열림
   - 익명 운영자 함수 거부

## 4. 되돌리기 (문제 발생 시, 1분)
1. 교사: 배포 관리 → 운영 웹앱 연필 → 버전을 **2-2에서 기록한 이전 번호**로 → 배포. 주소는 그대로이고 즉시 이전 게임으로 돌아간다.
2. 교사: `HOJA_USAGE_APPROVED_ERA_START` 속성을 삭제한다.
3. Claude: 백업 파일을 HEAD에 다시 push한다. 매일 집계 트리거가 HEAD 코드를 실행하므로 필요하다. 이후 `clasp pull`로 대조한다.
4. 데이터: 전환 동안 쌓인 신규 단원 시작 기록은 `EVENT_LOG`에 append-only로 남는다. 삭제하지 않는다.

## 5. 하지 않는 것
- 격리 사본 전용 속성/시트/토큰을 운영에 넣지 않는다.
- 실제 Seal·자동 마감 트리거를 설치하지 않는다(후속).
- 기존 기록 삭제나 재작성을 하지 않는다.
- 물속 충돌과 movement-smoke 조사는 하지 않는다(교사 중단 지시).
