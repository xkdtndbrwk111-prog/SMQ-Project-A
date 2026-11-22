# HOJA / SMQ 이용 통계 V4 — 구형 UsageU2.gs 참고, 집계 엔진 신규 설계

> 날짜: 2026-11-23. **Project A 개발 브랜치의 실험판만 변경**. 운영 Google Sheets, Project A/B 운영 GAS, TOP25 랭킹, 기존 사용량 호출 함수 `getUsageStatisticsU2()` 수정 없음. 이전 39-1~39-6 작업은 참고하되 새 통계 엔진을 단독으로 구현한다.

## 1. 지켜야 하는 기존 계약

Project B 제공 `UsageU2.gs`의 두 가지만 운영에서 유지한다.

- 권한: `requireUsageStatisticsAccessU3_(creatorToken)`의 OWNER 또는 **유효한 GOOGLE CREATOR 세션과 현재 Registry의 CREATOR 상태**. EDIT_CODE만 있는 CREATOR·PENDING·BLOCKED·철회·만료는 거부. 통계는 HOME/bootstrap과 무관하게 lazy RPC로만 조회.
- 기존 화면에 제공되는 데이터: `generatedAt`, `accessRole`, `scope=PUBLIC_ONLY`, `totals:{today,days7,days30,all}`, `daily`, `mode`, `teamCount`, `repositoryKind`, `grade`, `subject`, `publisher`, `topCartridges`. 새 `U4_CORE.report()`에는 이 키들이 포함되지만 관리용 `__meta`는 실제 Project B RPC에서 제거해야 한다.

데이터 기준은 `EVENT_LOG`의 **정확히 PUBLIC인 유효한 날짜 레코드만**. 개인 저장소·불명확한 범위는 기록에서 제외. 학급·학생 이름, 학교·IP·기기 ID는 수집/요약하지 않음.

숫자의 의미를 바꾸면 안 된다.

- 플레이 1회 → 전체·학년·교과 각각 1회, 출판사 제공 시 출판사도 1회.
- 다중 단원 선택 → 개별 단원 선택 통계에서는 각 단원마다 +1.
- Project B 기존 `topCartridges` → **I열에 있는 결합 카트리지 이름 전체**를 1회로 세는 별도 통계. 개별 단원 선택 횟수 합을 TOP20으로 오인 금지.
- TEAM 2~7팀까지 정확하게 기록하고, 숫자가 모호한 과거 팀전은 '인원 미확인'으로 별도 표시.
- `EVENT_LOG`에는 정상 종료·정답률 정보가 없으므로 기존 기록에 대한 완료/정답 지표를 생성하지 않는다.

## 2. 실제 운영 원본의 복사본 조사

연결된 격리 복사 시트에서 A/B 운영 시스템은 변경하지 않고 날짜열·상태열만 조사했다.

- 데이터 행 **17,672개**. `PUBLIC` 17,672개, 조회한 날짜별 상태 분포에서 `PRIVATE`/미상은 없음.
- 첫 날짜 `2026-09-23`, 마지막 `2026-11-22`. 날짜가 역행하는 행은 검출되지 않았음.
- 57개의 날짜에 레코드가 존재. 이 기간에는 기록 없는 날도 있으므로 **0회인 날짜를 명시적으로 COMPLETE 요약**해야 월별·연속 기간 집계가 성립한다.
- 이건 **해당 사본 시점**의 상태만 증명한다. 앞으로 기록이 날짜 순으로 append될 것까지 자동 보장하지 않는다. 추후 Project A append 경로에서도 날짜 비역행/지연 이벤트 차단 정책이 필요하다.

## 3. 현재 신규 구현

| 파일 | 내용 |
| --- | --- |
| `experimental/usage-retention/HOJA_USAGE_V4_CORE.js` | 구형 U2 응답을 기준으로 처음부터 작성한 순수 통계 엔진. PUBLIC 필터, 하루 고유 이벤트 검증, 모드/7팀/학년·교과·출판사/결합 카트리지 TOP20/개별 단원 분리, 검증한 연속 날짜의 오늘·7일·30일·전체 계산 |
| `experimental/usage-retention/HOJA_USAGE_V4_CORE.test.mjs` | 과거 11열, PRIVATE/미상, 중복 이벤트 ID, 다중 단원, 7팀, 0일, 기간 누락, 저장 요약 체크섬 및 응답 필드 시험 |
| `experimental/usage-retention/HOJA_USAGE_V4_TRIAL_GAS.gs` | **격리 복사본 전용**: C:E 날짜·종류 열 전구간 정렬 검증 → 해당 날짜 A:O 구간만 읽음 → 원본/버킷 SHA-256 별도 저장 → 별도 요약 탭 저장값 재읽기 → `COMPLETE` 게시. 같은 날짜 반복 실행은 전체 그룹 대조 후 재사용. 부분 실패 시 `PREPARING`으로 고정하고 수동 검토 요구 |
| `experimental/usage-retention/HOJA_USAGE_V4_TRIAL_GAS.test.mjs` | 격리 복사 시트/운영 ID 차단·수동 승인·K1 빈 레거시 헤더·0회 날짜·중단/재실행/변조 테스트 |

요약 탭(**아직 실제 GAS 프로젝트에서 생성/운영 실행하지 않음**):

- `HOJA_V4_DAILY_MANIFEST`: `date,generation,status,sourceStartRow,sourceEndRow,sourceRowCount,publicStarts,contentDigest,bucketCount,createdAt,verifiedAt,sourcePrefixEndRow,bucketDigest`
- `HOJA_V4_DAILY_BUCKETS`: `date,generation,dimension,dimensionKey,displayLabel,count`

`sourcePrefixEndRow`는 **그 날짜까지 원본이 확정된 마지막 실제 행 번호**다. 0회인 날에도 직전 날짜의 마지막 번호를 보존한다. 추후 관리자 화면에서 마지막 확정 행 다음(미집계분)만 읽는 데 사용할 기준점이다.

원본과 버킷은 **별도의 SHA-256**으로 보증한다. 원본에는 이벤트 ID가 있어도 요약 표에는 SHA 해시, 날짜, 집계값만 남는다. SHA 형식만 검사하지 않고, 요약을 소비할 때 실제 버킷을 다시 해시해 일치 여부를 검사하도록 V4 엔진에 필수 검증 인자를 추가했다.

## 4. 격리 복사본 시험 준비

1. 신규 Apps Script **시험 프로젝트**에 V4 CORE와 V4 TRIAL GAS만 연결한다.
2. 스크립트 속성 `HOJA_USAGE_TRIAL_SPREADSHEET_ID`에는 이미 생성해 둔 **격리 복사본** ID, `HOJA_USAGE_PRODUCTION_SPREADSHEET_ID`에는 **운영 원본** ID를 설정한다. 둘은 반드시 서로 달라야 한다.
3. 복사본의 `_HOJA_USAGE_TRIAL_ONLY!A1`에는 `HOJA_RETENTION_SANDBOX_V1` 표식이 있어야 한다.
4. `HOJA_USAGE_V4_TRIAL_WRITE_ACK=COPIED_SHEET_ONLY`를 직접 설정한 후 `hojaV4PreviewDailyTrialU1('2026-11-20')` 조회. 정확한 집계/해시 확인 후 `hojaV4WriteDailyTrialU1('2026-11-20')`로 **복사본에만** 집계 저장.
5. 기록 없는 `2026-11-21`도 날짜 전체 스캔으로 0건임을 검증한 뒤 COMPLETE로 게시할 수 있다. 같은 날짜 재실행 시 원본 범위와 SHA·버킷까지 동일해야 한다.
6. 오래된 `2026-09-23` 및 그 외 전체 기간까지 backfill, 날짜별 원본 PUBLIC·팀·학년·교과·조합 TOP20 합계를 구형 U2 결과·구형 U3 COMPLETE 롤업과 교차 검사한다.

현재 실제 Google Sheets 연결 API를 사용한 **이전 단계**의 2026-09-23/2026-11-20 표본 집계/조합 검증은 PASS. **신규 V4 GAS를 실제 Apps Script 엔진에서 실행한 시험은 아직 NOT RUN**이며 Node/GitHub 모의시험과 구분한다.

## 5. 최종 조회·압축 설계에서 아직 필요한 것

1. **전체 이력 시작 인증**: 최초 PUBLIC 날짜가 2026-09-23인 것은 현재 복사본에 대한 증거일 뿐. 운영 이전 전에 최초부터 어제까지 각 날짜(0회 날짜 포함)의 V4 COMPLETE, 버킷 SHA·원본 SHA, 단조로운 물리 행 범위에 대해 전수 대조하는 이력 인증서 필요.
2. **오늘 실시간 조회**: 앱 시작마다 EVENT_LOG 전체가 아니라 '마지막 확정일의 `sourcePrefixEndRow` 이후 신규 행'만 읽어 오늘의 **임시 집계**를 만든다. 오늘 데이터는 날짜가 계속 변하므로 COMPLETE 원본 삭제 대상이 아님. 신규 행 중 이미 종료된 날짜에 대한 지연 삽입이나 비정렬이 있으면 조회/보관을 HOLD하고 오류를 드러낸다.
3. **Project A/B 이중 조회 비교**: 실제 Project B 코드의 `requireUsageStatisticsAccessU3_`를 통과한 뒤 V4 응답을 변환하고, `getUsageStatisticsU2()`와 오늘/7일/30일/전체/시계열/모드/학년·교과·출판사/조합 TOP20을 충분히 비교. 기간/원본/해시가 하나라도 미확정이면 운영 전환 금지.
4. **운영 애플리케이션 속도와 잠금**: 별도 Project B `ScriptLock`만으로 Project A의 append를 보호할 수 없다. 최종 backfill 확정/오늘 접수 경계는 **Project A 내부의 동일 lock/append 프로토콜**에서 원자적으로 합의해야 한다.
5. **보관·복구**: 최근 30일 원본 유지, 31일~12개월은 검증된 일별 요약, 12개월 초과는 월 요약. 독립 백업/복구 및 전체 조회 전환 PASS 후에야 별도 승인으로 원본 삭제를 고려한다. 지금은 삭제 함수·자동 트리거가 **없다**.

**현재 단계:** 40-1 새 코어 + 40-2 사본 전용 집계기 코딩/모의시험. 실제 V4 데이터 backfill, 오늘 실시간 RPC 및 Project B 운영 배포는 다음 검증 단계.
