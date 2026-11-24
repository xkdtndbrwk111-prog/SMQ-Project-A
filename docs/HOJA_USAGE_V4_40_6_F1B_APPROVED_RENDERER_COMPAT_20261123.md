# Claude Code F1-B → F2 실행 지시 — 승인 콘텐츠 불변, 공용 렌더러의 표현 호환성 확보
**날짜:** 2026-11-23 KST · **기준:** PR #6 `408ce4eeb4b6426401be70de4928649352f68ac6`, 승인 콘텐츠 `HOJA-QUESTION-BANK@9573f91d2845a9667e2540df051f499d937dd94a`
**범위:** 격리 QA 개발·시각 검증만. 교사 승인 정본/운영 GAS/원본 데이터/미디어 공개 허가/실제 배포 승인 변경 금지.

## 1. F1 독립 감수 및 정확한 상태
- 제출된 F1 산출물: 23단원 732문항 중 **READY(패키지화·기존 renderer 화면 표시)** 16단원/498문항, **BLOCKED** 7단원/234문항. 그림 107개, mock GAS 지연 로드, 498문항 × 3해상도 오프라인 Chromium 렌더에서 빈 화면/이미지 누락/JS 오류 0.
- CI [run 45111578375](https://github.com/xkdtndbrwk111-prog/SMQ-Project-A/actions/runs/45111578375) success는 **mock/fixture와 정적 검증**이며 외부 approved checkout + drift check는 token secret 없어 **SKIPPED**. 23단원 실제 게임 버튼 흐름/실 GAS/실전자칠판/승인 HTML과 픽셀 동일성은 **NOT RUN**.
- `approved-content-report.json`의 `READY`는 **패키지 데이터 렌더 가능**이라는 뜻이지, 승인 HTML을 픽셀 수준으로 재현하거나 **게임 탑재·배포 가능**하다는 의미가 아님. 출시 active catalog는 `entries:[]`, 미디어 공개 권리는 23/23 HOLD.

## 2. 기술 구현 방향 — 재승인 정본을 새로 만들기보다 무손실 호환 변환
1. 이미 교사 승인한 **문항 본문·정답·보기·이미지·시계 오버레이·교사 배치 결정은 수정하지 말 것**. 전부 출처 commit SHA와 archive/asset SHA를 추적.
2. 승인 자료의 서로 다른 presentation 스키마를 빌드 시 **버전 식별 어댑터**로 공통 `rendererQuestion`에 무손실 변환. 새 과목/단원명/ID 하드코딩 금지. 변환이 해석상 모호하면 문항 단위 `BLOCKED_VISUAL_REVIEW`; 그 단원 전체를 거짓 PASS 처리하지 않는다.
3. 기존 단일 A/C/D 렌더러의 선택지·레이아웃/measureAndFit/fitContent 원본 로직은 해시로 보호. 표현이 불가능한 부분만 QA 브리지에 **부가 기능/선택적 `media[]`**로 구현하고, 기존 단일 `image` 문제는 변경 전후 DOM·픽셀·정답 클릭 동작이 완전히 동일해야 한다. 새로운 모드별 렌더러나 그림 합성·삭제·자동 대체 금지.
4. 새로 작성된 화면의 **시각적 동등성 검증은 교사 승인 콘텐츠 자체를 재승인하는 작업과 구분**. 승인 presentation이 없는 항목은 콘텐츠 교차검증 후 QA 화면 미리보기를 제공하고, 교사에게는 **새 배치의 시각 검토**만 요청할 수 있다. 승인·공개 권리 미확정일 때 운영 등록 금지.

## 3. F1-B1 영어 천재 6개 / 201문항
- 승인 ZIP 내 **최종 presentation v3**는 `DATA_ORIGINAL/DATA_CONCISE`가 아니므로 `PRESENTATION_NOT_RENDERER_V2`로 6개 전부 BLOCKED. 각 단원 문항은 승인 `release/approval.json`, nested `cartridge.json`과 `release/media-overlay.json`을 대조하며 최종 display와 실제 정답의 일치를 보장.
- 5학년 10단원 q21: **학교 그림과 시계 그림 두 장**, 노출 순서·caption/문항 블록과의 연결·가로/세로 배치를 유지해야 함. 기존 `image` 호환성을 유지한 `media[]`(배열, 출처 assetId, 순서, alt, 배치 힌트) 등으로 공동 렌더러를 최소 확장. 원본 두 이미지를 한 장으로 합성하거나 둘 중 하나만 표시하면 FAIL.
- 201문항 각각 ID/유형/원본 4지 보기·게임 3지 선택 매핑/정답·오답, 승인 최종 HTML과 렌더 비교(특히 q21) → 전수 수치 보고. 콘텐츠 손실이 한 건이라도 있으면 해당 문항 및 영향을 받은 단원은 HOLD.

## 4. F1-B2 사회5 2-2 / 33문항
- 승인 manifest `soc5-s2-u2-2-common`은 teacherApproval APPROVED·mediaRights PENDING_Q07, **별도 공통 renderer-v2 presentation이 없음**. 승인 `effective/cartridge.json`, 승인 이미지·블록/배치 오버레이와 정답 매핑으로 rendererQuestion을 **결정론적 생성**.
- 필수 문항 정보 없는 부분은 창작 금지. 한 문항에 지문·지도/표/이미지가 복합이면 block order·지문/보기 구획을 보존. **시각 승인 화면 기준본 없는 경우 원본 효과적인 데이터의 충실성과 QA 배치 검토**를 분리 표시. 새 QA 미리보기 캡처를 교사에게 제시하기 전 운영 READY 승격 금지.
- q07 교사 시각 승인 사실과 **외부 공개 미디어 권리 PENDING_Q07**을 구분. 자료를 SMQ 공개 저장소/운영 번들에 허가 없이 복제 금지.

## 5. F2 병행할 16개 READY의 시각적 미완료 3종
- **수학 6단원/187문항:** `presentationScriptsNotInBridge`는 `hoja-math-priority-and-notation-v1`, `hoja-math-teacher-final-wrap-v4`. 원본 승인 HTML의 분수/기호 폰트 및 교사 지정 보기 줄바꿈 **4문항**을 기존 공용 렌더러의 옵션/브리지 어댑터에서 정확히 재현. teacherC 19문항, A120/C67, D0, 정답 위치 원본 유지. 실제 승인 HTML과 대표/전수 DOM·스크린샷 비교 제출.
- **사회5 3-1·3-2/64문항:** `renderTags: NONE_IN_APPROVED_SOURCE`, `unitMetaSource: APPROVED_INDEX_TITLE`, 원본 HTML renderer **v0.1.0-preview.2**와 현 브리지 **v0.2** 시각 동등성 NOT RUN. 이름·단원 태그 fallback을 승인 표현으로 표시하지 말고, 원본 display 64문항과 A/C/D·폰트·이미지 레이아웃 비교 후 출처를 명시.
- **YBM 6 + 사회5 2:** `presentationShaVerified=false`은 원문 발표 HTML 해시의 manifest-level 고정이 미확인임. pinned Git commit+실제 presentation content digest를 보고하고, title/이미지/정답이 이미 검증된 것과 **표시 파리티가 확인되었다고 주장하지 말 것**.

## 6. 실행·테스트·완료 기준
- 순서 **F1-B1 변환 어댑터 + 다중그림 QA 브리지 → F1-B2 사회5 효과적 데이터 변환 → F2 수학 표기·사회5 동등성 → F3 세 모드 실제 버튼 연결**.
- 현재 F1의 498문항 × 3해상도 회귀는 계속 PASS 유지. **23/732** 전체를 기존 정본 renderer DOM/픽셀/행동과 대조: `1920×1080`, `1280×720`, `1024×768`, `390×844`; 특히 2그림, 분수, 긴 보기 줄바꿈, C형 좌우 19/11, 사회5 두 전시 형식.
- F1-B 시험 전 콘텐츠 불변 check(IDs, answers, choice IDs/order, source content blocks, image bytes, SHA), rendering 2-image use, no JS error, no blank, correct capture once, short answer teacher judgment; 수치로 실패를 기록하며 단순 표시 성공만으로 APPROVED VISUAL PARITY PASS 불가.
- 새로운 QA 번들은 **미디어 권리 확인 전까지 개인/격리 프로젝트**에서만 실행하며 콘텐츠·이미지는 SMQ-Project-A repo에 커밋하지 않는다. release variant는 승인 active **0개** 및 콘텐츠 **0개**. GitHub Actions pinned approved checkout/drift SKIPPED 문제를 재현 가능한 빌드/명시적 증거로 보완.
- 그 뒤 싱글 문제풀이/아케이드/팀전·오답 복습 UI 버튼 E2E, 승인 영문 ID `HOJA_USAGE.track`의 숫자 ID 필터 수정, A1 실 GAS 새 시대 통계, R6 40/40 보호를 **각각 별도 테스트**로 수행. R7 자정·G 대규모 부하·브라우저 종료/복구·전자칠판은 계속 미완료로 승계.
- 각 커밋마다 `docs/HOJA_USAGE_V4_40_6_CLAUDE_WORKLOG_20261123.md`에 **Q번호/정본 출처 SHA/변환 결정/코드 SHA/mock·Chromium·CI·실 GAS 별도 PASS/FAIL/NOT RUN/남은 장애**를 기록. GPT-6만 중앙 체크리스트를 최종 독립 갱신. 오류 숨기기·승인 산출물 수정·운영 배포/PR merge 금지.

## 7. 운영 전환 절대 보류
Project A 단일 GAS, 익명 비식별 PUBLIC 통계, 교사 승인/배포 승인 분리, `main`, 루트 `Code.gs`/Game.html, `versions/2.0.0`, 운영 GAS/EVENT_LOG/랭킹, 자동 삭제/트리거/구 교실매니저 실제 제거 등 변경 금지. 미디어 권리 23/23 미확인, `active-deployment.json` entries 0 유지.
