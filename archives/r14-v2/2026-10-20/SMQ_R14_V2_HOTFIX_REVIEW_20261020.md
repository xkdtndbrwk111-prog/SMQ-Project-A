# R14-V2 P0 — 실제 GAS 자료형 핫픽스 소스 검증

- 확인일: 2026-10-20
- 범위: 사용자가 제출한 마크다운 붙여넣기본으로부터 `Code.gs` 본문을 복원하여 기존 P0 제출 원본과 대조
- 판정: **소스 동일성·한 줄 패치 확인 / 로컬 회귀 14/14 PASS / 운영 반영 HOLD**
- 출처: `붙여넣은 마크다운(20261020-032313).md` — 이는 Apps Script에서 직접 원격 추출한 소스가 아니라 사용자가 제출한 텍스트임

## 1. 정본 비교

- 비교 기준: `UsageRollupU3S_R14_V2_P0.gs` 1342줄, SHA-256 `a699b58388987fc937106866dd7e5304fcb78928d29c992b2d6de66ee52224b4`
- 붙여넣기 복원 결과: 1342줄, 46,361바이트 (UTF-8), SHA-256 `9dc15aa31299e1e78cadf8e0a1c8e59bbea5b7f35340ef342e6e033866009266`
- 대조 내용: **한 줄 치환 이외 원본과 바이트 단위로 완전히 동일**; 치환을 역으로 적용하면 원본 SHA-256과 정확히 일치함
- 복원 처리: 붙여넣기 UI가 추가한 HTML 엔터티, Markdown 이스케이프, 인위적 빈 줄만 원복. 이 과정은 일반 GAS 소스에 적용할 지침이 아니라 해당 첨부문서 전용 복원 절차임

```diff
-    String(r[15]||'').toUpperCase()==='FALSE' &&
+    String(r[15]).trim().toUpperCase()==='FALSE' &&
```

원인: Sheets `getValues()`가 `needsRebuild` 열을 문자열 `FALSE`가 아닌 JavaScript 불리언 `false`로 반환. `false || ''`가 공백으로 평가되어 검증에 실패함.

## 2. 로컬 회귀시험

- 수정본 구문 검사 (Node.js `.js` 임시 복사본): PASS
- Codex 원래 회귀 13건: **13/13 PASS**
- 추가 `GAS-BOOL-01` (V2 manifest `FALSE`를 불리언 false로 강제하는 Sheets 동작 모사): **PASS**
- 전체: **14/14 PASS**
- 새 추가 시험을 수정 전 P0 구현에 적용한 반증(control): 의도한 `USAGE_ROLLUP_RECOVERY_MANIFEST_READBACK_MISMATCH` 재현, 실패 종료 (기존 실물 GAS 오류 메시지와 코드 동일)
- 테스트는 로컬 mock 기반. 실제 GAS 검증과 독립된 증거이며, 테스트 자체가 동시성/실제 RPC 제어 검증은 아님.

## 3. 사용자 보고 실물 GAS 시험 증거

- Preflight PASS: 시험 계정·시트 속성 확인, content SHA-256 변화 검출
- 시트 생성 PASS: 3개 rollup 탭
- D-01 PASS: `__proto__` duplicate => V1 FAILED, raw unchanged
- D-02 첫 실행 FAILED: Sheets boolean coercion로 매니페스트 검증 불일치
- D-02R PASS: g3 V2 COMPLETE, 2행 COUNT_ALL / SOLO1 TEAM1 / parity PASS
- D-03 PASS: `ALREADY_RECOVERED` / 신규 행 0 / parity PASS
- D-04 PASS: 40 PUBLIC, 중복 ID 2종, V1 FAILED => V2 g2 COMPLETE / SOLO20 TEAM20 / parity PASS / raw unchanged

위 항목은 사용자 제공 실행 로그에 근거하며, 본 검토가 실제 시트를 직접 원격 조회/감사한 것은 아님.

## 4. SHA-256

| 항목 | SHA-256 |
|---|---|
| 기존 P0 GS | `a699b58388987fc937106866dd7e5304fcb78928d29c992b2d6de66ee52224b4` |
| 수정본 GS / TXT | `9dc15aa31299e1e78cadf8e0a1c8e59bbea5b7f35340ef342e6e033866009266` |
| unified diff | `2a0b1fda1f03b8bab744f2bbabdc4b4d96abd1e5a38ead29418555459c6f61d7` |
| 회귀 14건 JSON | `cb5444401db916ac2ba5ff99eb4baf917da2b93addf4927952f64dd763ae5c34` |

## 5. 운영 안전 판정

- **원본 P0 정본은 유지**하고 위 핫픽스를 새 후보로 별도 보존
- 기존 A6, 운영 A/B, GitHub, Notion 변경 없음 (본 소스 검토에서)
- 미검증: 실제 동시 호출/경합, 실제 GAS 장애 주입, RPC 권한 경계, 운영 연동
- 임시 사전 검사 및 합성 데이터 생성용 함수들은 배포 코드에 혼합하지 말 것
- STEP 08·50% 유지, 운영 반영 HOLD
