# SMQ Project A · R14-V2 C2/C3 실제 GAS 검증 및 백업 현황
검증일: 2026-10-20 (KST) · STEP 08 / 50% · **OPERATIONS / PROD HOLD · NO-GO**

## 0. 자료 출처와 신뢰 경계

- 이 보고서는 **사용자가 채팅에 제공한 Apps Script 실행 로그**와 이전 독립 시험 보고서, 보관된 C2 후보 소스 확인에 근거한다. 이 보고서를 만든 과정에서 **운영 배포본이나 Apps Script C3 편집기의 최신 전체 소스는 직접 추출·검증하지 않았다**.
- GitHub C2 후보: `review/r14-v2-c2-local-pass-20261020` / `archives/r14-v2/2026-10-20/C2_LOCAL_HOLD/SMQ_R14_V2_P0_C2_CANDIDATE_20261020.gs`; 기존 기록상 SHA-256 `aca55e961687b0618cc466647bee06e776f4fbdbaf03b98411429ad7a578ef46`. **후보가 운영에 적용된 것은 아니다**.
- C3 자료: `C3_TEST_HARNESS_USER_PASTE_PRE_REV2_20261020.txt` 는 20:45 KST 무렵 사용자 입력으로 확보한 **이전 시점의 원문 보존 사본**이다. `c3PrepareRev2Date`가 포함되지만 `c3Rev2A`, `c3Rev2B`, `c3Rev2Inspect` 전체는 **포함되지 않는다**. 이 파일을 최종 C3 GAS 편집기 소스, 실행 코드와 바이트 동일한 코드, 또는 제품용 코드라고 주장하면 안 된다.
- C3 시험용 Apps Script 프로젝트 ID: `1LZ5fnKjhzLdU1OXOBqUBv8nbcC91XyUk-V5NQz6p2fb4lcP0kmVYsM3I`. 격리 시험용 스프레드시트: `1GcSfmRUJ0rCzFNKu5eb1wekTstyFeM08ZJ-DL-Jombc`. TEST 자원만 사용하였다고 사용자 실행 로그와 사전 점검 결과가 나타낸다.

## 1. C2 실제 GAS — 동일 날짜 중복 COMPLETE 결함 (확인된 시험 실패)

- 2026-10-06을 대상으로 한 C2 실제 Google Sheets 경쟁 실행에서 같은 날짜의 `20261006-g000002`와 `20261006-g000003`가 모두 `U3S1_ROLLUP_V2 / COMPLETE`로 기록됨.
- 매니페스트와 일일 집계 결과에 중복 세대가 생성됨. **한 날짜에 복구 선점이 한 번만 허용되어야 하는 계약 위반**.
- 로컬 mock 13/13 및 20/20 PASS는 이 실제 GAS 실패를 무효화하지 않는다. 정확한 경쟁 조건/조회 일관성 원인은 **미확정**. 기존 C2 행과 로그는 수정·삭제·재사용하지 않는다.
- **C2 결과: FAIL / 운영 NO-GO**.

## 2. C3 실제 GAS — 실험별 증거 구분

### 2026-10-10 · 정방향
- V1 g1 FAILED 후 V2 g2를 한 워커가 선점한 동안 다른 워커는 해당 `PREPARING`을 확인하고 `RECOVERY_IN_PROGRESS`로 중복 생성을 건너뜀.
- 생성 결과: 해당 날짜 g2 COMPLETE / g3 없음. 실제 GAS **정방향 경합 경로 PASS**.

### 2026-10-11 · 역방향 첫 시도
- 의도는 B가 A의 pre-claim 대기 중 g2를 먼저 claim하는 것이었으나 실제 B 시작 시점에 A가 이미 g2 COMPLETE.
- g3 미생성, 최종 데이터에는 이상 없으나 **요구한 역순 경합 선행조건 자체가 불충족**. 이 사례는 역순 경쟁 PASS가 아니라 **NOT RUN (timing)**.

### 2026-10-12 · C3-REV2 역순 실물 경합
- 20:55:21경 A 먼저 시작, **선점 전 60초 대기**. B는 20:55:30 시작.
- B 20:55:32 `CLAIM_ALLOWED`, `NEXT_SEQ=2`, 20:55:33 `C3_SNAPSHOT_ENTER delayMs=90000`. B가 g2 PREPARING을 먼저 기록.
- 20:56:23 A 매니페스트 읽기에서 g1 FAILED + g2 PREPARING 확인, `CLAIM_DECISION=RECOVERY_IN_PROGRESS`; A는 신규 claim 없이 `skipped=true` 종료.
- 20:57:03 B snapshot 준비 종료; 20:57:07 B `C3_RESULT={generation:"20261012-g000002",status:"COMPLETE",skipped:false}` 후 종료.
- 20:59:57 `C3_REV2_INSPECT` 사용자 제출 최종 읽기 결과:

```json
{"date":"2026-10-12","baselineOk":false,"postOk":true,"rawRows":6,"dayEvents":2,"rows":[{"seq":2,"generation":"20261012-g000002","schema":"U3S1_ROLLUP_V2","status":"COMPLETE"},{"seq":1,"generation":"20261012-g000001","schema":"U3S1_ROLLUP_V1","status":"FAILED"}],"triggers":0}
```

- `baselineOk:false`는 시험 전 기준 상태를 더 이상 충족하지 않기 때문에 **사후 검사에서 예상되는 값**. `postOk:true`, g3 없음, 6 raw rows, 해당 날짜 2 events, 트리거 0.
- **C3-REV2 의도된 역순 경합 경로 PASS**. 다만 이 시험의 A는 실제 복구 함수 호출 전에 대기했고, **기존 C2 실패 경로를 완전히 동일하게 재현하거나 원인을 규명한 것은 아니다**.

## 3. 기존 운영 통계 영향 (코드/설계 기록 기준)

- 보관된 Project B `UsageU2.gs` 서버 `getUsageStatisticsU2()`는 `EVENT_LOG`의 `PUBLIC` 행을 직접 읽고 일별·누적 횟수를 산출하며, 집계표 `USAGE_DAILY_TOTALS`를 읽지 않는다.
- Project A의 `UsageRollupU3S.gs` 설계 헤더는 Shadow only / Project B reads raw EVENT_LOG / no statistics Source-of-Truth switch 명시.
- 그러므로 **C2 그림자 집계에서 중복 COMPLETE가 생겼다는 사실만으로 현재 Manager 통계가 두 배로 표시된다고 판단할 수 없다**.
- 주의: Project B 실제 운영 배포 버전과 보관 코드의 동등성, 원본 EVENT_LOG 자체에 중복 게임 실행 이벤트가 있는지는 이번 검토에서 직접 확인하지 않았음.

## 4. 보존·금지 사항 및 다음 게이트

- 기존 C1/C2 FAIL, UNKNOWN, PREPARING, EVENT_LOG, 기타 시험 증거 보존. 완료된 날짜를 재사용하거나 삭제·수정하지 않는다.
- PROD Google 계정/운영 GAS/Sheets/트리거/배포/Script Properties, GitHub main, 기존 archive/review 브랜치는 변경하지 않는다.
- 다음 게이트: **최종 C3 GAS 편집기에서 `Code.gs` 및 `C3TestHarness.gs` 전체 원문을 별도로 안전하게 내보내어** 실제 시험 이후의 함수와 해시를 확보, 새 파일로 추가 보관. 현재 PRE-REV2 파일을 최신 `Code.gs`로 이름만 바꿔 대체하면 안 된다.
- 제품 반영 및 원본 통계 삭제/집계 기준 변경은 별도 검증과 PO 승인이 있을 때까지 **HOLD**. C3 PASS는 C2 결함 수정 확정이 아니다.

최종 상태: **STEP 08 / 전체 50% 유지 · C3-REV2 검사 PASS · 원래 C2 재현 결함 미해결 · PROD/OPERATIONS NO-GO**.
