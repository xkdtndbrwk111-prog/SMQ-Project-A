# HOJA 정본 카트리지 소프트 코딩 후보 — 2026-11-23

**정본 출처:** `xkdtndbrwk111-prog/HOJA-QUESTION-BANK`의 `approved/catalog.json` 및 각 교사 승인 manifest/승인 effective 콘텐츠. **기존 61일 EVENT_LOG 및 구형 카트리지명 정리 작업은 신규 분류에서 제외**.

## 사용자 확정 정책
- 이름·개별 카트리지 ID는 **코드에 하드코딩하지 않음**. GitHub 승인 색인을 빌드 시 읽어 자동 분류. 추후 추가 단원도 `approved/catalog.json`만 갱신하면 새 단원이 자동 발견됨.
- 소프트 코딩 기본 분류: **영어 = 학년·출판사·저자·단원**, **그 외 교과 = 학년·학기·교과·단원**. 실제 원본 manifest에서 수집하고 이름의 하이픈/숫자 정규식으로 임의 추측하지 않음.
- 원본 형식 차이는 승인 카탈로그 구조에 따라 처리: 영어 묶음 `units`, YBM `unitCounts`+문항 `questionId`, 사회 등의 `subjects.*.paths`, 수학 등의 `subjects.*.manifest.units`.
- 현 상태 `approved/catalog.json`은 **23단원 / 732문항**(영어 12/384, 사회 5/161, 수학 6/187), 모든 `gameDeployment=NOT_DEPLOYED`. 승인 완료와 게임에서 사용 가능함을 절대 혼동하지 않음.
- 표준화 코드가 반환하는 임시 `N학년 과목 N단원`은 분류용 fallback임. **게임에 노출할 정식 단원명은 승인 ZIP 안의 effective 카트리지 메타데이터에서 검증해 채울 것**. 이름 미검증이면 배포 차단.
- 실제 게임 탑재 항목은 별도의 명시적 배포 manifest에서 승인 ID와 effective SHA-256을 pin해야 함. 게임 런타임은 검증된 **내장 활성 카탈로그**를 읽으며 GitHub·Google Sheets 조회 금지.
- 원본 SHA/미디어 오버레이·문항 레이아웃의 승인 상태, 외부 공개 미디어 권리 조건 검증 필요. 영어 천재 5학년 10단원 q21 시계 오버레이 누락 금지.
- 신규 게임 이용량 통계는 **활성 정본 ID**에만 연결. 구형 61일 17,670회는 이력 검증 자료로 보존하되 새 정본 사용량에 합산 금지.

## 작업 범위
- `experimental/usage-v4-unified/approved-catalog/approved_catalog_normalizer.mjs`: 정본 승인 색인 동적 변환, 중복/수량 검사, 배포 게이트.
- `experimental/usage-v4-unified/approved-catalog/approved_catalog_normalizer.test.mjs`: 예시로 임의 승인 단원을 추가하더라도 소스 코드 수정 없이 자동 분류되는 회귀시험.
- **현재는 빌드 타임 normalizer 코드 시안**. 실제 HOJA-QUESTION-BANK 파일 I/O 어댑터, ZIP 내용 해시 검증, 승인 effective 오버레이 적용, 단일 GAS 내장 로더·기록/공개 통계 연동 및 CI/실 GAS 시험은 아직 NOT RUN. Claude Code가 PR #6에 연결해야 하며 승인 전 병합 금지.
- 이전 `work/usage-v4-40-6-label-normalization-20261123`의 레거시 이름 정규화는 SUPERSEDED. 단일 GAS의 동시 시작 R6 10/40 PASS, 30/40 FAIL은 여전히 운영 전환 BLOCKER.
