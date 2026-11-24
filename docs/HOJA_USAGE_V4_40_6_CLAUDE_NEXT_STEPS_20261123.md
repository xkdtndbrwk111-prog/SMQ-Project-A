# Claude Code 실행 지시서 — 40-6-U 다음 작업 (승인 정본 소프트 코딩 + 사용량 통계 안정화)
**발행:** 2026-11-23 KST · **소유:** Claude Code 구현 / GPT-6 독립 감수
**상태:** 개발 지시만 확정. 신규 코드·실 GAS 재시험·운영 배포 승인 아님.
**우선순위:** 기존 [40-6 통합 정본](HOJA_USAGE_V4_40_6_UNIFIED_A_CLAUDE_DIRECTIVE_20261123.md) **최신 7절**과 이 문서를 함께 따른다. 이전 구형 Sheets 카트리지명 복원/관리자 통계 로그인/Project B 연동 지시는 SUPERSEDED.

## 0. 시작 전 반드시 읽기
1. `xkdtndbrwk111-prog/SMQ-Project-A` 기준 `work/unified-quiz-renderer-20261122`, 개발 `work/usage-v4-40-6-u-20261123`, Draft [PR #6](https://github.com/xkdtndbrwk111-prog/SMQ-Project-A/pull/6), `docs/HOJA_USAGE_V4_40_6_CLAUDE_WORKLOG_20261123.md`, 중앙 `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md` 40-6H~40-6M.
2. `xkdtndbrwk111-prog/HOJA-QUESTION-BANK`의 `approved/catalog.json`, `approved/README.md`, 영어 출판사별 manifest, 사회 5개 단원 manifest, 수학 상위 및 6개 단원 manifest와 승인 ZIP/effective 자료. 실제 최신 commit SHA를 고정하고 파일 SHA 및 최종 교사 승인 내용과 대조한다.
3. 별도 후보 브랜치 `work/usage-v4-approved-catalog-index-20261123` @ `969cdec1c257bd1dc25a86c9353368baac638be8`의 `experimental/usage-v4-unified/approved-catalog/approved_catalog_normalizer.mjs` 및 `approved_catalog_normalizer.test.mjs`. **정본 구현이 아닌 검토할 초안**이다. 실제 테스트를 실행하고 결함을 수정해 Claude 개발 브랜치로 선별 반영한다.
4. 과거 표기 변환 브랜치 `work/usage-v4-40-6-label-normalization-20261123`는 **병합 금지**. 구형 이름 77개와 251개 조합의 정규화 작업은 중단.

## 1. 사용자 확정 정책 — 변경 금지
- **Project A 단일 Apps Script**에서 게임 기록·일별 V4 검증 집계·공개 통계 조회 UI 제공. Project B GAS를 새로 만들거나 연결하지 않는다.
- 기존 교실매니저는 새 통계에서 제외한다. **실제 제품/파일·사용자 데이터 삭제는 미승인**이다.
- 누구나 로그인 없이 **비식별 PUBLIC 집계만 열람**할 수 있다. 원본 EVENT_LOG/개별 eventId·학생/교사/학교 ID·시트 ID·비밀/관리 기능 노출 금지.
- 앞으로 게임에 사용하는 카트리지는 **GitHub HOJA-QUESTION-BANK/approved의 교사 승인 정본만**이다. 구형 구글 Sheets 공개 카탈로그와 과거 EVENT_LOG 카트리지명으로 새 카트리지를 조립하거나 이름을 매핑하지 않는다.
- **카트리지 이름/ID/승인 단원 목록을 코드에 하드코딩하지 않는다.** 앞으로 단원 추가 시 GitHub catalog/manifest 메타데이터 기반으로 발견·분류된다.
- `teacherApproval=APPROVED`는 **게임 운영 배포 승인이 아니다**. 현재 승인 정본 23개 단원·732문항은 `gameDeployment=NOT_DEPLOYED`. 실제 게임에서 선택할 수 있는 목록은 별도 배포 manifest에서 교사 배포 승인과 콘텐츠 SHA로 명시적으로 활성화한 항목만.
- 이전 61일 기록 17,670회(구형 게임)는 감사·V4 회귀 시험용으로 **원본 보존**, 신규 승인 정본 카트리지 통계와 혼합 금지. 별도 신규 스키마/소스 구분·집계 경계의 설계와 시험이 필요하다.

## 2. 구현 단계와 순서

### A. 정본 인덱스 자동 생성 (먼저 착수)
- 실제 승인 `approved/catalog.json` → 하위 승인 manifest → 단원별 승인 데이터로 이어지는 **빌드 타임 어댑터**를 구현한다. 코드에 특정 학년 단원명, 영어 제목, 카트리지 ID의 고정 배열을 넣지 않는다.
- 과목별 형식 차이를 **스키마에 의해** 처리한다.
  - 영어 천재(함순애): 묶음 manifest `units[]`; 최종 사용 데이터에는 `release/approval.json`과 `release/media-overlay.json` 적용. 특히 5학년 영어 10단원 q21 시계 삽화 수정이 적용돼야 한다.
  - 영어 YBM(김혜리): 묶음 manifest `unitCounts`, `g5u10` 등 단원 `questions.json`의 실제 `questionId`; 승인 `questions.approved.json`, `tags.approved.json`, `images.approved.json`을 우선.
  - 사회: `subjects.social.paths` → 단원별 manifest `id`, ZIP의 `effective/cartridge.json`, `effective/assets/`; 승인 배치 태그.
  - 수학: `subjects.math.manifest` → `units[]` → 개별 manifest/승인 ZIP `effective/` 및 presentation 배치 태그.
  - 이후 과학 등은 `approved/catalog.json`에 신규 과목이 생겼을 때 일관된 확장 규칙으로 처리. 알 수 없는 스키마를 임의 추측/조용히 누락하지 말고 진단 후 fail-closed.
- 출력 공통 레코드 제안: `{cartridgeId, grade, semester, subject, publisher, author, unit, subunit, approvedTitle, sourceRepo, sourceCommit, releaseId, sourceSha256, effectiveSha256, mediaOverlayDigest, approvalStatus, deploymentStatus}`.
- **정식 제목은 승인 effective 콘텐츠의 제목을 추출**하고 임시 `N학년 과목 N단원` fallback은 내부 분류 확인에만 쓴다. 원본 이름 문자열 정규식으로 승인 여부를 판정하지 않는다.
- SHA-256 재계산, 문항 수(현재 23/732), ID 중복, 파일 누락, 이미지 오버레이, 승인 태그·미디어 권리 상태를 보고한다. 미디어 공개 권리 미확인은 자동 승인으로 변환하지 말고 별도 HOLD.
- 자동 생성 결과/잠금 파일(정본 source commit·manifest SHA·빌드 산출물 digest)을 저장하고 CI에서 새 단원이 추가될 때 기존 목록을 수정하지 않아도 자동 발견됨을 입증한다. **GitHub를 게임 매 시작 때 읽지 않는다.**

### B. 실제 게임에 설치할 카트리지 분리
- 승인 **source index**와 게임에 내장할 **active deployment manifest**를 분리한다. 승인 23개가 전체 공개/게임 가능으로 갑자기 활성화되면 FAIL.
- 별도의 명시적 교사 배포 승인, 실제 effective 콘텐츠 SHA, 권리·게임 렌더러/문항검증 게이트를 만족하는 ID만 활성 목록에 포함한다.
- Project A의 게임 선택·질문 로드·`recordUsageStartU1()` 입력 검증은 동일한 **내장 active ID→승인 메타데이터**에서 일치하도록 한다. 기존 `hojaPublicSheets_()` 매번 외부 카탈로그 호출을 제거하는 방향으로 변경하되 게임 기존 계약을 깨뜨리지 않는다.
- 신규 승인 단원을 추가한 테스트 fixture로 빌드만 갱신 → 소스 파일 수작업 수정 없이 인덱스에 나타남 → 배포 manifest 없으면 비활성 → 승인 후에만 사용 가능함을 확인한다.

### C. V4 통계의 신규/구형 기록 경계
- 신규 approved `cartridgeId`는 **카트리지명 문자열이 아니라 안정 ID**로 집계한다. 여러 카트리지 조합은 ID 정렬 기반으로 A+B/B+A 동일 그룹 처리. 표시는 승인 제목을 기반으로 한다.
- 기존 EVENT_LOG 15열의 구형 61일 기록·재전송 2건·일별 SHA 인증은 변경/삭제하지 않는다. 신규 통계가 과거 17,670회를 신규 approved 콘텐츠 이용 횟수로 섞지 않도록 `sourceSchemaVersion` 또는 동등한 명시적 신구 구분·migration-free read 설계를 제출한다.
- 통계 공개 응답은 고정 allowlist, 임의 Sheets 조회 및 식별자 노출 금지, 오류 시 UNAVAILABLE(숫자 0으로 위장 금지). 게임 시작 RPC는 제한된 PUBLIC append만 허용.
- 구형 카트리지 이름 복원/매핑·옛 251조합 정상화는 **새 설계의 성공 기준에 포함하지 않는다**.

### D. **최우선 운영 차단 문제** R6 데이터 유실 해결
- 기존 실 GAS R6는 동시 익명 시작 **40건 중 성공 10, 실패 30** (ScriptLock timeout 13 + Sheets API 429 17). 원본 행 추가 +10만 확인됨. 운영 전환 HOLD.
- 변경 전후 RPC별 처리시간·Sheets API 호출수·ScriptLock wait/hold 시간을 비식별 계측. 승인 active 내장 카탈로그로 호출량을 줄이고, 잠금 안의 manifest 전체 확인·TextFinder·flush/readback 비용을 안전하게 최적화한다.
- **클라이언트 Game.html에 같은 eventId 유지 + 제한된 지수 백오프 재시도**, 영구적인 입력 오류와 일시적 429/락 오류 구분, 최종 실패 표면화 또는 신뢰 가능한 복구 경로를 구현한다. 성공 응답이 유실된 재전송도 중복 저장 0이 되게 한다. 단순 잠금시간 연장만으로 해결 주장 금지.
- **격리된 실제 GAS + 별도 쓰기용 사본**에서 익명 40건 이상 동시 시작+공개 통계 폴링 재시험: 최종 고유 시작 **40/40, 중복 0, 유실 0**을 응답/원본 행/commit watermark/통계로 교차 증명. 429/lock timeout이 일시 발생하더라도 사용자 기록이 결국 복구되는지 확인.

### E. R7 및 안전성·회귀
- R7 KST 자정 전후 seal/COMPLETE 및 지연/순서 뒤바뀐 행, 0회 날짜, 검증 사본 SHA, 비정상 부분 행, 미봉인 날짜 fail-closed 시험.
- 익명 통계 열람은 로그인 없이 가능하지만 관리·원본 추출/수정·트리거 RPC가 소유자 권한으로 노출되는지 실 GAS 공격 관점 시험. 구형 루트 `UsageRollupU3S.gs`의 `_` 없는 함수 노출 위험은 **현재 운영 배포와 분리해 검증**하고 신규 번들에 이식하지 않는다.
- 게임 QR·문항/오답·랭킹·싱글/팀전, 데스크톱/모바일, lazy public stats UI, XSS/개인정보/응답 캐시·rate limit을 시험한다.
- **구분 보고:** Node/mock PASS ≠ Google Sheets 복사본 SHA PASS ≠ 실제 Apps Script PASS ≠ 익명 실브라우저 E2E PASS. 실제 시험 못 하면 NOT RUN.
- GitHub Actions CI가 실험 폴더에만 있는 상태라면 실제 워크플로를 합법적으로 활성화해 실행 증거 URL/성공 여부를 제출할 것. 운영 GAS 배포와 구분.

## 3. 커밋·보고·독립 감수 규칙
- 작업용 브랜치 `work/usage-v4-40-6-u-20261123`에서 단계별로 별도 커밋. 최신 베이스와 PR 상태 먼저 확인해 다른 작업을 덮어쓰지 말 것.
- 단위별 커밋과 `docs/HOJA_USAGE_V4_40_6_CLAUDE_WORKLOG_20261123.md` U-APPROVED-CATALOG / U-R6-FIX / U-R7-VERIFY 섹션을 append한다. 매 단계 수정 파일, 커밋 SHA, 승인 콘텐츠 검증·시험종류·PASS/FAIL/NOT RUN, 데이터 유출 여부, 남은 위험을 기록한다.
- GPT-6가 `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md`에 독립 감수한다. **Claude 자기 판단으로 중앙 PASS/운영 승인 처리 금지**.
- PR #6은 검수 완료 전 Draft 유지. **운영 변경·배포·merge는 사용자 별도 승인까지 HOLD**.

## 4. 절대 금지
`main`, `versions/2.0.0`, 루트 운영 후보 `Code.gs`, 실제 운영 Project A/B GAS, 원본 EVENT_LOG/랭킹, 기존 교실매니저 실제 삭제, 원본 보관·삭제 트리거/운영 데이터 리셋을 무단 변경하지 마라. GitHub/CI 로그·PR에 학생 이름/개별 eventId·시트 ID·API 키·OAuth 토큰·운영 URL 등 비밀값을 남기지 마라. 과거 승인 목록을 운영 카트리지로 임의 승격하지 마라.

## 5. 제출 형식
1. **A 산출물:** 23개/732문항 승인 인덱스 + 정식 제목 확인 상태 + 신규 단원 자동 발견 시험 + ZIP 해시/오버레이 검증.
2. **B 산출물:** 교사 배포 manifest 게이트 + 내장 active catalog 게임 연결(미승인 ID 거부) + 구형 기록과 신규 approved 통계 분리.
3. **D 산출물:** R6 수정 diff + mock/CI/실 GAS 40/40 증거 + 재전송/중복/429/락 로그.
4. **E 산출물:** R7 자정·익명 보안/원본 무결성·게임 회귀 증거.
5. 최신 commit SHA 및 PR 링크, 작업 로그 갱신; 실험·미실시 여부를 정직하게 표기.

**이 문서를 읽은 즉시 A 단계부터 진행하고, A를 마친 뒤 B 및 D(유실 해결을 병행)와 E를 진행하라. 최종 운영 승인 없이는 실제 배포하지 마라.**


## 최신 후속 지시(2026-11-23): R7 대기 중 승인 정본 실제 게임 연결
- 신규 정본 문서: [HOJA_USAGE_V4_40_6_APPROVED_GAME_INTEGRATION_CLAUDE_DIRECTIVE_20261123.md](HOJA_USAGE_V4_40_6_APPROVED_GAME_INTEGRATION_CLAUDE_DIRECTIVE_20261123.md).
- **중요**: 별도 승인 A/C/D 통합 렌더러를 게임 싱글/아케이드/팀전/오답 복습에 연결하는 F단계가 우선. 기존 R7 자정 실제 GAS 시험은 잔여 항목으로 유지하고 대기하지 않음.
- 40-6O의 approved 영문 cartridgeId가 현재 telemetry client의 숫자 ID 필터에 걸려 무기록되는 문제를 F3에 포함. 운영 활성 0개·미디어 권리 HOLD는 그대로 유지. 


## F 이후 반드시 이어야 하는 미완료 검증(G 단계, 2026-11-23)
[현재 미완료 사항 40-6Q](HOJA_GAME_DEV_CHECKLIST_20261122.md) Q01–Q12와 [F 지시서 7절](HOJA_USAGE_V4_40_6_APPROVED_GAME_INTEGRATION_CLAUDE_DIRECTIVE_20261123.md)을 우선. F 단계에서 고친 항목도 실 GAS/실게임 증거가 없으면 다음 G로 이월한다.
- **G1:** 재시도 없는 40 동시 19/40 한계 + 80~120 burst, 페이지 닫기·새로 열기·로컬 저장소 차단·재전송 유실·오류 알림 및 test harness assert.
- **G2:** KST 자정 R7 실제 GAS seal/늦은 이벤트·in-flight 날짜·0회 날짜·SHA, R8 캐시 hit 상태 무결성/TTL 검증.
- **G3:** 익명 통계 allowlist/관리 RPC deny, 승인 A1/구형 U3S1 시대 분리 실기, 23개 미디어 권리 확인과 배포 승인 0개 유지.
- **G4:** 최신 GitHub CI pinned 정본 drift 복구, 실 버튼 E2E·싱글/팀전/아케이드·랭킹·오디오·85인치 전자칠판(불가시 NOT RUN). 운영 전환은 별도 사용자 승인.
