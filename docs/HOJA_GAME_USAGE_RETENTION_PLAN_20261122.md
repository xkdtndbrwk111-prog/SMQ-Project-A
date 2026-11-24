# HOJA 게임 이용 통계 — 기간별 요약·압축 보관 설계안 (2026-11-22)

> 상태: 설계 합의안. **운영 코드/Google Sheets/Apps Script 트리거/기존 데이터는 변경하지 않음.**
> 범위: 비로그인 게임의 익명 이용량·완주·모드·문제은행/게임별 합산. 학생 개인/학급별 상세 추적은 하지 않음.

## 요구 정책

| 보관 기간 (Asia/Seoul) | 기준 데이터 | 저장 형태 |
| --- | --- | --- |
| 최근 30일 | 게임/문항 선택 후 실제 시작 기록·종료 기록 | 이벤트 단위 `EVENT_LOG` (원본) |
| 31일~최근 12개월 | 모드/게임/학년·교과·단원별 총합 | 하루당·구분값당 1개 요약 행 `USAGE_DAILY_*` |
| 12개월 초과 | 날짜·모드·게임·단원별 월 합계 | 월당·구분값당 1개 요약 행 `USAGE_MONTHLY_*` |

- 매일 종료된 일자에 대해 요약을 계산하고, 과거 상세는 최소 30일 동안 보관한다. 날짜는 한국 시간으로 고정한다.
- 단원은 다중 선택 가능하므로 **각 단원별 선택 횟수의 합은 전체 플레이 횟수보다 클 수 있음**을 통계 UI에 명시한다.
- 상세 레코드에는 학생 이름·학급·학교·IP·기기 식별자를 수집하지 않는다. TOP25 랭킹은 별도의 `HOJA_RANKING`에서 기존 정책을 유지하며 이용 통계 축약의 대상이 아니다.
- 기존 통계 `eventId`와 새 결과 이벤트의 `runId`를 활용해 네트워크 재시도 중복을 방지한다. 한 번의 게임 안에서 사망·부활·문제별 답변은 새로운 플레이 수에 합산하지 않는다.
- 새 게임이 추가되어도 `gameId` + `mode` + `cartridgeId` 기준으로 동일한 통계 집계기를 사용한다.

## 요약 데이터에 남길 값

- 날짜/월, `gameId`, `mode`(아케이드/문제풀이/팀전 등), `grade`, `subject`, `cartridgeId`, `teamCount`(2~7).
- 게임 시작 수, 정상 완료 수, 시간 종료 수, 기타 종료 수, 정답 수 합계, 출제 수 합계, 플레이 시간 합계.
- 평균 정답률과 평균 플레이 시간은 *요약된 합계값으로 계산*한다. 개별 점수·닉네임·기기 ID는 요약 보관하지 않는다.
- 단순 시작 수는 실제 완료와 다름. 종료 이벤트를 받지 못한 세션은 별도 상태(`UNKNOWN`/미확인)로 집계하며 조용히 완료 또는 이탈로 단정하지 않는다.

## 아카이브 처리와 안전 장치

1. **현재는 원본 삭제 금지.** `UsageRollupU3S.gs`는 'Shadow only / Project B still reads raw EVENT_LOG / No raw deletion / No archive automation'로 작성되어 있음. `USAGE_DAILY_TOTALS`/`USAGE_DAILY_DIMENSIONS`가 존재해도 바로 삭제하면 기존 Project B 통계와 raw-prefix parity 검증이 깨진다.
2. 먼저 두 통계 조회 주체(Project A/B)를 요약을 읽는 버전으로 전환한다. 신규 이벤트/종료 기록의 중복방지와 누락 재시도, 모드 구분을 검증한다. 기존 일별 `team2~team6` 집계는 7팀 이벤트를 받는 서버 정책과 불일치하므로 반드시 `team7`을 추가하거나 팀 수별 차원 표로 일반화한다.
3. 날짜별 요약 재계산 → 합계와 차원별 검증 → 원본 개수·체크섬 및 집계 세대(`generation`) 기록 → `COMPLETE` 게시 순서를 유지한다. 체크섬/합계/건수 중 하나라도 다르면 **삭제하지 않는다**.
4. 새로 만든 아카이브/보관 관리 표(`USAGE_ARCHIVE_MANIFEST`)에 적용 대상 날짜, 집계 세대, 원본 행 수, checksum, 상태(`PREPARING`/`VERIFIED`/`PURGED`), 작업 시각을 기록한다. 원본 삭제 자체가 성공한 경우에만 `PURGED` 처리한다.
5. 압축 전 데이터 백업을 마련하고, 일 단위 또는 작은 묶음으로 오래된 원본 행을 **아래에서 위로** 삭제한다. 중단·재실행해도 중복 집계/추가 삭제가 일어나지 않는 재시작 가능한 절차로 구현한다. 삭제와 이벤트 append가 충돌하지 않도록 동일 잠금·작업 경계 적용.
6. 롤업 재빌드/검증은 삭제된 원본의 `cutoffLastRow`에 계속 의존할 수 없으므로, 검증 기준을 각 날짜의 고정 스냅샷·매니페스트로 교체해야 한다. 원본이 남아 있는 날짜만 raw parity 재검증 가능.
7. 12개월이 지난 일별 요약은 월별 합계를 작성하고 원본 일별 합계와 일치하는지 검증한 뒤 축약한다. 여러 세대의 `COMPLETE` 집계 행이 합계에 이중 계산되지 않도록 **날짜별 최신 승인 세대 하나만** 선택한다.
8. 운영 일정은 수동 테스트 → 시험 복사 시트에서 재실행/부분 실패/중복/복원 테스트 → 읽기 화면 전환 → 관리자 승인 후 실제 purge 활성화 순서. **현재 설계 단계에는 운영 데이터 삭제·GAS 배포 작업 없음.**

## 출처와 호환 지점

- `versions/2.0.0/Code.gs`: `recordUsageStartU1()`가 공개 단원별 시작 이벤트를 `EVENT_LOG`에 append. 형식 검증은 하지만 현재 `eventId` 중복 존재 검사 없음. `HOJA_RANKING`은 별도의 TOP25 자료.
- `versions/2.0.0/UsageRollupU3S.gs`: `runUsageRollupDateU3S1`, `runUsageRollupParityDateU3S2`, `USAGE_DAILY_TOTALS`, `USAGE_DAILY_DIMENSIONS`, `USAGE_ROLLUP_MANIFEST`. Shadow·원본 보존 전제.
- 기존 통계의 기록/운영 설정이 보존되도록 `versions/2.0.0` 파일 자체와 운영 배포는 본 설계 작업에서 수정하지 않음.

## 시험판 코드 구현 및 자동검증 (2026-11-23)

이번 개발 브랜치에 아래 파일을 추가했다. 이들은 **운영 배포본이 아니며 운영 시트에 쓰거나 행을 지우지 않는다.**

| 소스 | 구현 내용 |
| --- | --- |
| experimental/usage-retention/HOJA_USAGE_RETENTION_CORE.js | 기존 EVENT_LOG 15열 인식, 이벤트 ID 중복 제거 및 충돌 차단, 일별·단원별 총합, 팀 7개까지 지원, 모든 날짜 검증 후 월별 집계, 30일 및 12개월 보관기한 판정 |
| experimental/usage-retention/HOJA_USAGE_RETENTION_CORE.test.mjs | 다중 단원 1회 플레이, 반복 수신, 윤년 29일, 월 합산 및 누락 검출, 1,000회 시작→일별 1행, 개인정보 제외, 보관 보류 안전 조건 |
| experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_GAS.gs | 복사한 시험 시트의 EVENT_LOG 읽기 전용 미리보기. 10,000행을 넘으면 부분 집계 없이 중단. 운영용으로 등록된 시트 ID와 같으면 읽기조차 거부 |
| experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_GAS.test.mjs | Apps Script·Sheets 모의객체로 스키마·날짜 변환·SHA-256·운영 ID 차단·변경 API 부재 확인 |
| .github/workflows/unified-trial-qa.yml | 위 두 종류의 자동 검증을 렌더러 CI 단계에 연결 |

**기존 기록의 한계:** 기존 EVENT_LOG에는 종료 정보와 게임 구분 필드가 없다. 시험 엔진은 모르는 종료를 UNKNOWN, 게임 구분을 HOJA_LEGACY로 처리해 실제 모드·완주를 지어내지 않는다. 다중 단원을 선택하면 플레이 수는 1회, 해당 단원별 선택 수는 각 1회로 집계한다. 정답률·완주율은 결과 이벤트 연결 이후에만 산출할 수 있다.

### 안전한 실행 절차

1. 기존 운영 시트와 GAS는 변경하지 않고, 별도의 시험 복사 시트와 Apps Script 프로젝트를 준비한다.
2. 시험 프로젝트에 위 CORE.js와 TRIAL_GAS.gs 소스를 넣는다.
3. 시험 스크립트 속성 HOJA_USAGE_TRIAL_SPREADSHEET_ID에 복사한 시트 ID를 입력한다.
4. 함수 hojaUsageRetentionPreviewTrialU1()을 실행한다. 반환되는 전체 시작 합계, 단원별 합계, 중복 재전송 수와 SHA-256을 기존 통계와 대조한다.
5. 실제 운영 데이터 삭제는 **프로젝트 A/B 조회 화면 모두 요약을 읽도록 바뀌고, 집계 세대·원본 백업·체크섬·재실행/복원 시험이 완료된 뒤** 별도의 승인으로만 진행한다.

현재 시험 모듈은 삭제할 수 있는 날짜/월을 **미리보기로 계산할 뿐**, 삭제 함수·보관 스케줄·시트 변경 동작은 포함하지 않는다. 원본 EVENT_LOG의 실제 압축은 아직 실행하지 않았다.

## 단계 2: 복사 시험 시트 전용 일별 요약 기록 (운영 적용 금지)

구현: experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_WRITER.gs

읽기 전용 미리보기와 달리 새 HOJA_TRIAL_* 시트에 일별 요약을 기록하지만 **복사된 테스트 스프레드시트에서만** 실행하도록 다중 조건으로 제한한다.

실행 전 조건:
1. 실제 운영이 아닌 **별도 복사된** Google Spreadsheet와 별도 Apps Script 시험 프로젝트 준비.
2. 복사본에 이름이 정확히 `_HOJA_USAGE_TRIAL_ONLY`인 탭을 **직접 생성**, 셀 A1에는 `HOJA_RETENTION_SANDBOX_V1`이라고 입력. 스크립트는 이 확인 탭을 자체 생성하지 않는다.
3. 별도 프로젝트 스크립트 속성 `HOJA_USAGE_TRIAL_SPREADSHEET_ID`에 **복사 시트 ID**, `HOJA_USAGE_TRIAL_WRITE_ACK`에 `COPIED_SHEET_ONLY` 입력. 운영 사용량/랭킹/문제은행 ID와 일치하면 실행 거부.
4. 시험 프로젝트에 `HOJA_USAGE_RETENTION_CORE.js`, `HOJA_USAGE_RETENTION_TRIAL_GAS.gs`, `HOJA_USAGE_RETENTION_TRIAL_WRITER.gs`를 추가하고 `hojaUsageRetentionWriteTrialU1()` 수동 호출.
5. 생성 결과: `HOJA_TRIAL_DAILY_TOTALS`, `HOJA_TRIAL_DAILY_DIMENSIONS`, `HOJA_TRIAL_RETENTION_MANIFEST`. 시험 원본 `EVENT_LOG`는 변경/삭제하지 않음.

매니페스트는 `PREPARING` 다음에 원본 합계·일별 집계·단원 집계에 대한 저장값 확인을 마친 경우에만 `COMPLETE`로 게시. 동일 입력 SHA-256 재호출은 **실제 저장된 요약값과 다시 대조한 뒤** 변경하지 않고 재사용한다. 같은 세대가 PREPARING으로 남으면 자동 덮어쓰지 않고 수동 검토를 요구한다. 데이터가 손상된 COMPLETE도 무조건 신뢰하지 않고 오류로 차단한다.

시험 검증: `HOJA_USAGE_RETENTION_TRIAL_WRITER.test.mjs`에서 수동 확인값 누락, 운영 ID 차단, 원본 변경 금지, 중단 후 재실행 차단, 중복 기록 방지, 완료 후 저장행 변조 검출을 모의 스프레드시트로 확인한다. 실제 복사 시트 연결 실험은 아직 수행하지 않았다.

**미지원:** 운영 이전, 실제 자동 스케줄, 요약 조회 화면의 운영 전환, 원본·일별 행 삭제, 스냅샷 영구 복구. 이 기능을 현재 운영 프로젝트에 붙여 넣으면 안 된다.
