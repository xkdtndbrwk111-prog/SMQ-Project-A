# HOJA 사용량 요약 조회 전환 — Project A/B 39-6 시험 이식안

> 상태: **개발 브랜치의 읽기 전용 이식 준비**. Project A/B 운영 GAS 및 운영 Google Sheets는 수정·배포하지 않음. 원본 삭제/트리거 없음.
> 개발 브랜치: `work/unified-quiz-renderer-20261122`.
> 실 Google Sheets 검증: 기존 운영 시트로부터 새로 만든 **격리 복사본**만 사용. 복사본의 비공개 파일 ID/링크는 공개 GitHub에 기록하지 않음.

## 1. 왜 Project B가 원본 대신 요약을 읽기 전에 검증이 필요한가

기존 Project A `UsageRollupU3S.gs`가 가진 `USAGE_DAILY_TOTALS`,
`USAGE_DAILY_DIMENSIONS`, `USAGE_ROLLUP_MANIFEST`는 그림자 집계이며,
기존 Project B의 통계 UI는 `EVENT_LOG` 원본 읽기에 의존한다. 이를 변경하지 않고
원본을 삭제하면 통계가 손상된다.

구형 `USAGE_DAILY_TOTALS`에는 `team2Count`~`team6Count`만 있다. 실제
2026-11-20 기록에는 7명 팀 플레이가 7회 존재하지만, 구형 요약만으로는
`teamCount - (team2..6)` 잔여건수를 **정확히 7팀**이라고 증명할 수 없다.
새 요약 `teamCountsJson`은 2~7의 팀 구분을 모두 유지한다.

**가장 중요한 통계 의미:** 한 게임에서 단원 5개를 선택해도
`전체 플레이=1`, `학년·교과·출판사 사용=각 1`,
`선택 단원 합계=5`이다. 단원별 선택 합계를 사용해 학년별 플레이를
역산하면 다중 단원으로 인해 과다 집계된다.

## 2. 이식 구현 위치

| 파일 | 역할 |
| --- | --- |
| `experimental/usage-retention/HOJA_USAGE_RETENTION_CORE.js` | 고유 이벤트별 전체 시작, 단원 선택, 학년/교과/출판사별 **플레이 기준** 분류, 일별·월별 계산 |
| `experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_GAS.gs` | 복사 시트 이벤트를 날짜별로 읽어 결과 미리보기. 운영 ID 충돌 차단 |
| `experimental/usage-retention/HOJA_USAGE_RETENTION_TRIAL_WRITER.gs` | 복사 시험 시트만 대상으로 요약 기록, 세대별 읽기 재검증, 재실행/중단 가드 |
| `experimental/usage-retention/HOJA_USAGE_SUMMARY_READ_V1.js` | 기존 U3S `COMPLETE` 요약과 새 V1 요약을 함께 읽되 신뢰 검증·중복 기간 검증·누락 날짜 거부 |
| `experimental/usage-retention/HOJA_USAGE_SUMMARY_READ_TRIAL_GAS.gs` | Project A/B용 **읽기 전용 시험 래퍼**. 원본 `EVENT_LOG`를 열지 않음, 수동 복사본 표식 확인 |
| `experimental/usage-retention/*test.mjs` | 구형 팀 분류·날짜 누락·중복 세대·교과 합계·새 요약의 암호학적 게시 조건·원본 접근 금지 검증 |

새 복사본의 `HOJA_TRIAL_DAILY_FACETS` 탭에는 `generation,date,gameId,mode,dimension,dimensionKey,displayLabel,count` 필드를 사용한다. `GRADE`, `SUBJECT` 합계가 각각 해당 모드의 시작 수와 같아야 한다. `PUBLISHER`는 빈 정보를 제외하므로 같거나 작을 수 있다.

## 3. 실제 격리 복사본에서 확인한 집계 불변식

| 날짜 | 전체 | SOLO | TEAM | 단원 선택 | 학년/교과 요약 | 게시 상태 |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| 2026-11-20 | 581 | 443 | 138 | 663 | 각각 합계 581. 기존 `U3S` 학년/교과/출판사와 **그룹별까지 일치** | 구형 U3S COMPLETE / 새 실험본 CONNECTOR_COUNT_VERIFIED |
| 2026-09-23 | 414 | 316 | 98 | 414 (과거 단원 ID 미수집) | 각각 합계 414. 누락 단원 ID는 `LEGACY_UNRESOLVED` | 새 실험본 CONNECTOR_COUNT_VERIFIED |

11월 20일 기존 분류 집계와 새 분류 집계:
- 학년: 5학년 236, 6학년 305, 기타 40
- 교과: 영어 541, 기타 40
- 출판사: 천재(함) 435, YBM(김) 103, 비상 3
- 단원 선택: 전체 663 (다중 선택으로 전체 플레이 581보다 많음)

기존 U3S는 11월 20일에 `COMPLETE` 매니페스트와 SHA-256 원본
다이제스트가 존재한다. 새 CONNECTOR_COUNT_VERIFIED는 **건수·요약 행
읽기 검증만** 완료한 상태이며, SHA-256 동일성/실제 GAS 검증까지
이뤄진 `COMPLETE`가 아니다. 이를 운영 전환 증거로 오인하면 안 된다.

## 4. 조회 선택 규칙 (fail-closed)

1. 날짜별 가장 최근 U3S 세대가 `COMPLETE`, `needsRebuild=FALSE`,
   64자리 다이제스트 2개, 원본 건수/모드/학년·교과 차원 합계가 일치할 때만 구형 요약을 선택.
2. V1 세대가 `COMPLETE`이고 게시 체크섬 형식·건수·SOLO/TEAM 팀수·
   완료/미확인 비율·학년/교과 플레이 기준 분류가 일치하면 신형 요약 선택.
3. 날짜가 겹치면 두 출처의 전체·SOLO·TEAM·학년·교과·출판사 합계와
   U3S 단원 선택 합계를 대조. 불일치 시 조회 중단.
4. 실험용 `CONNECTOR_COUNT_VERIFIED`는 선택적으로 수량 미리보기만 허용.
   `authoritative:false`. **운영 통계 원천으로 승격 금지.**
5. 요청한 날짜 중 요약이 없는 날은 임의로 `0회` 처리하지 않는다.
   `completeCoverage:false`와 `gaps`로 돌려보낸다.
6. 신규 V1 요약에 정확한 단원 이름·원본 네임스페이스를 보관하지 않은
   과거 데이터는 ID만 보여 줄 수 있으므로, Project B의 기존 단원명 표시 UI와
   같은 수준의 완전한 호환은 **추후 label/namespace 데이터 계약 추가 전까지 미확보**.

## 5. Project B 실제 UsageU2.gs 코드 수령 후 추가 확인 (2026-11-23)

사용자가 GAS 프로젝트 내 `UsageU2.gs` 전체를 제공했다. 기존 외부 통계 프로젝트는 없다.

- 기존 호출 지점은 `getUsageStatisticsU2(creatorToken)`이며 반환 키는 `generatedAt,accessRole,scope,totals,daily,mode,teamCount,repositoryKind,grade,subject,publisher,topCartridges`.
- **권한 검사 변경 금지:** 현재 `requireUsageStatisticsAccessU3_`에서 OWNER 또는 **유효한 GOOGLE CREATOR 세션 + 현재 Registry CREATOR 상태**만 허용한다. EDIT_CODE만 있는 세션, PENDING/BLOCKED/만료/철회 상태는 거부. 통계는 HOME/bootstrap에 연결하지 않고 별도 lazy RPC 유지.
- 기존 Project B는 `EVENT_LOG` A~K/I 데이터를 직접 읽고, 기간별 오늘/7일/30일/전체·날짜 시계열을 계산한다. 구형 `teamCount`는 2~6팀만 그려서 실 데이터의 7팀이 누락된다.
- 기존 `topCartridges`는 원본 I열 **다중 단원 합친 문자 그대로** 하나의 그룹으로 세며, 새 문제은행의 개별 단원 ID 선택 수와 다르다. 오래된 U3S `CARTRIDGE`만으로는 이 항목을 정확히 복원할 수 없다.
- `HOJA_USAGE_RETENTION_CORE.js`에 `CARTRIDGE_COMBINATION` **플레이당 1건** 분류를 추가하고 일별·월별로 남김. 시험용 `HOJA_TRIAL_DAILY_FACETS`도 동일 dimension을 허용.
- 실 Google Sheets **격리 복사본**에서 2026-11-20 581건·2026-09-23 414건의 조합별 COUNT 요약을 기록해 원래 I열 문자열별 그룹 수와 **전 그룹 정확히 일치**를 확인함. 11/20은 고유 조합 이름 53개, 게임모드까지 분할한 요약 60행. 9/23은 이름 38개, 모드 분할 59행. 두 날짜의 누적 조합 건수는 각각 원본 581/414와 동일.
- `HOJA_PROJECT_B_USAGE_SHADOW_V1.js`는 **이미 승인된 요약만** 받아 기존 U2 응답 형태의 `preview`로 변환. SOLO/TEAM, 일별, 학년·교과·출판사, 단원 조합, 7팀 및 옛날 미분류 인원수를 구분. 요약에 없는 오늘/7일/30일은 숫자를 꾸며내지 않고 `null`로 표시, **원본의 전체 기간 시작점이 검증되기 전 `totals.all=null`** 유지.
- `HOJA_PROJECT_B_USAGE_SHADOW_TRIAL_GAS.gs`는 신설 **병렬 시험 함수** `getUsageStatisticsU3ShadowTrial(creatorToken,dateKeys,asOf)`를 제공한다. 기존 `getUsageStatisticsU2` 교체/수정 없음. Project B 현행 `requireUsageStatisticsAccessU3_`를 함수 첫 단계에서 호출한 뒤에만 복사본 요약 조회. `productionSwitchAllowed:false` 고정.
- 실제 GAS 프로젝트 실행·실제 Manager HTML 통합·전체 기간과 최신 날짜 보완은 **NOT RUN**. 실 시트 접근 시험은 Google Sheets API로 수행한 격리 사본 재읽기이며 GAS 실행으로 표기하면 안 된다.
- **현 단계는 39-6 shadow 준비에 해당**. 모든 필드를 원본과 동등하게 재현하지 못한 상태에서 `getUsageStatisticsU2`를 대체하지 않는다. 원본 행 삭제·운영 보관 트리거 설치 금지.

## 6. 운영 전환 전 남은 조건

- **Project B `UsageU2.gs` 실제 함수 소스는 확보했지만**, 현재 연결된 GitHub에는 Project A만 있어서 Project B의 GAS 배포본 자체는 수정하지 않았다. 관련 구현은 Project A 개발 브랜치의 격리 이식 코드로만 보관.
- 별도의 Apps Script 시험 프로젝트에서 `hojaUsageSummaryReadTrialU1()`을 실제 실행하고, 복사 시트 조회 결과·작업 시간·날짜 누락·실행 한도 검증.
- Project B 실제 reader 호출 경로를 확보하여 새로운 출력 스키마를 매핑하고, 기존 원본 조회와 7일 이상 **그림자 비교**. 비교 불일치·누락 시 기존 원본을 유지.
- 신규 단원명/namespace 표시 계약과 팀 7명 기록을 끝까지 보존하는 일별/월별 요약.
- 날짜별 모든 원본의 SHA-256·매니페스트 재빌드 검증, 독립 백업 및 중단/복구 실험, Project A/B 모두 요약 리더로 전환한 뒤에만 데이터 삭제 승인 논의.
- **현 단계에서는 Apps Script 운영 배포, 원본 행 삭제, 사용자 개인정보 수집 없음.**
