# Project A — R14-V2 C2 P0 격리 수정 후보 감독 보고서

작성: 2026-10-20 KST | **LOCAL PATCH PASS / REAL GAS NOT RUN / DEPLOYMENT HOLD**

## 1. Source of Truth

- 기존 GitHub 비공개 아카이브 기준 SHA-256: `9dc15aa31299e1e78cadf8e0a1c8e59bbea5b7f35340ef342e6e033866009266`. **원본 파일 변경 0.**
- 이번 C2 격리 후보 `.gs` SHA-256: `aca55e961687b0618cc466647bee06e776f4fbdbaf03b98411429ad7a578ef46`.
- 공식 운영 코드 및 기존 아카이브의 main / GAS / Google Sheets / A6 / 학생 데이터: 접근·수정·배포 없음.
- 최초 P0의 Google Sheets `FALSE` 자료형 핫픽스는 유지했다.

## 2. 최소 수정 내용

1. **F1 경합 수정**: `smqUsageWriteGenerationRowsU3S_` helper를 추가했다. V1/V2에서 공통 ScriptLock 아래 totals `appendRow`, dimensions `getLastRow()+1`, `setValues`, `SpreadsheetApp.flush`를 보호한다. 전체 raw snapshot 계산은 잠금 밖. 이미 생성된 manifest의 독립 행 갱신은 별도다. **서로 다른 GAS 프로젝트 ScriptLock 공유는 보장하지 않는다.**
2. **F2 UNKNOWN fail-closed**: V2 `smqUsageRecoveryClaimDecisionU3S_`에서 해당 날짜 매니페스트의 모든 status 값이 `FAILED`, `COMPLETE`, `PREPARING` 중 하나인지 검사하고, 미지의 값이 있으면 **신규 claim 이전 오류** `USAGE_ROLLUP_RECOVERY_UNKNOWN_MANIFEST_STATUS`를 발생시킨다. 기존 행 수정 없음. V1의 기존 guard/보호 자동 처리기는 불변.
3. **F3 ambiguous publication 개선**: V2뿐 아니라 V1도 모든 fallible prepublish 확인을 `PREPARING` 동안 수행한다. final status `COMPLETE` 쓰기/flush는 `FAILED`로 수정하는 catch 바깥에 배치했다. ACK/flush 예외는 각각 `USAGE_ROLLUP_RECOVERY_PUBLISH_UNKNOWN` 및 `USAGE_ROLLUP_V1_PUBLISH_UNKNOWN`를 반환하고, 영속 매니페스트는 자동 수정하지 않는다. 오류 응답만으로 성공/실패를 단정하면 안 된다.
4. **F4 stuck PREPARING**: 자동 해제·삭제·재시도는 구현하지 않았다. 읽기 전용으로 세대, status, cutoff, startedAt, 원본 행, digest, parity를 확인한 다음 **별도 PO 승인 후** 수동 reconciliation 한다. 이 잔여 기능은 현재 HOLD.

## 3. 실제 로컬 실행 결과

- 개발 환경 Node `v22.16.0`; 현재 Google 연결 없는 메모리 Sheets / VM / worker_threads / Atomics mock.
- 기존 13개 원본 P0 회귀 시나리오 **13 PASS / 0 FAIL**. 다만 새 안전 발행 계약 때문에 test harness의 예외 코드 예상 문자열 2개를 `PUBLISH_UNKNOWN`로 수정했다(원본 소스/테스트 증거는 보존).
- 독립 15개 시나리오 기반 확장 fork **20 PASS / 0 FAIL**. 원래 15개 시나리오의 후보용 기대 결과 수정, 새 V1/V2 교차 날짜 경합 시험 1개, V1 발행 fault 3개, V1 UNKNOWN guard 보존 시험 1개 추가. **15/15 또는 20/20은 새 GAS 시험이 아니다.**
- 포함 시험: 동일 날짜 8개 실제 로컬 worker, 다른 날짜 두 worker 동시 claim/snapshot barrier, dimensions 및 totals 쓰기 시 lock assertion, V1/V2 교차 실행, boolean `false`, `__proto__`, COUNT_ALL=40, idempotency, lock timeout, 최초 COMPLETE 쓰기 전 오류, COMPLETE 반영 후 ACK 유실, flush 오류, FAILED cleanup 오류, PREPARING claim ACK 유실, UNKNOWN 조합 등.
- 소스 구문 검사 `node --check < C2.gs` **PASS**.
- 원래 독립 15개 시험의 기대 FAIL 2건이 후보용 수정된 시험에서 PASS된 사실은 **local mock 범위에 한정**된다. 보관본 자체를 고쳐서 실패를 감춘 것이 아니다.

## 4. 남은 HOLD / 위험

- 아직 실제 Google Apps Script/Sheets/권한/RPC/익명 웹앱/트리거를 실행하지 않았다. 기존 사용자 실물 GAS D-01~D-04는 **이 C2 후보를 테스트한 것이 아니다**.
- 교차 GAS 스크립트 프로젝트에서 동일 Spreadsheet를 쓰면 ScriptLock이 공유되지 않으므로 이 패치만으로 안전하다고 할 수 없다. 정식 아키텍처에서 단일 writer 소유권과 실제 같은 스크립트 잠금 사용 여부를 확인해야 한다.
- 구글 Sheets `appendRow`, `getLastRow`, `flush` 실제 원자성/시간제한/외부 편집/여러 프로젝트 동시 기록 테스트가 남는다.
- V1/V2 발행 직전 검증과 마지막 status write 사이에 다른 출처의 시트 외부 변경은 이 패치가 방어하지 못한다. 통합 리뷰 필요.
- `PREPARING` 영구 잔류와 UNKNOWN 상태는 **자동 복구하지 않는다**. 운영자가 읽기 전용 실태 조사 후 승인하는 복구 절차 별도 필요.
- 운영 반영, main 병합, 기존 실험 리소스 수정, OAuth/배포/트리거 실행 = **HOLD**. STEP 08 / 50% 유지.

## 5. 파일과 검증 실행 방법

- `SMQ_R14_V2_P0_C2_CANDIDATE_20261020.gs`: 수정된 코드 (후보 전용).
- `R14_V2_C2_P0_Patch.diff`: 기존 핫픽스 코드에 대한 최소 변경.
- `r14_v2_mock_test.js`, `verify_cross.cjs`: 실행 가능한 격리 시험; `UsageRollupU3S_R14_V2_P0.gs`는 시험 스크립트가 읽는 동일 후보 사본.
- `original13_results.txt`, `extended20_results.json`: 실제 로컬 시험 출력.
- `SHA256SUMS.txt`: 제출 파일 무결성.

```
node r14_v2_mock_test.js > rerun13.json
node verify_cross.cjs > rerun20.json
```

두 명령은 작업 디렉터리가 해당 파일들이 위치한 폴더여야 한다. **로컬 작업만 허용**, 실제 GAS·Sheets에 붙여 넣거나 배포하지 않는다.

**최종 판정: C2 ISOLATED LOCAL PASS / REVIEW CANDIDATE ONLY / REAL GAS NOT RUN / PRODUCTION NO-GO.**
