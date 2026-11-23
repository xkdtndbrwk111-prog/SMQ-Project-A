# Claude Code 실행 지시서 — R7 대기 없이 승인 정본 게임 연동 (40-6 F)
날짜: 2026-11-23 / 구현 Claude Code, 독립 감수 GPT-6.
상태: **개발용 격리 시험만 허용 / 교사 배포 승인 아님 / 운영 배포 금지**.

## 0. 시작점과 우선 정책
- 저장소: `xkdtndbrwk111-prog/SMQ-Project-A`. 개발 브랜치 `work/usage-v4-40-6-u-20261123`와 Draft PR #6. 최신 HEAD를 먼저 확인하고 40-6 기준 브랜치 `work/unified-quiz-renderer-20261122`의 최신 7절, `docs/HOJA_USAGE_V4_40_6_CLAUDE_NEXT_STEPS_20261123.md`, `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md`의 40-6N/O, Claude 작업 로그를 읽어 충돌 없는 분기·머지로 진행.
- 정본 공급원: `xkdtndbrwk111-prog/HOJA-QUESTION-BANK` 승인 저장소, **pin `9573f91d2845a9667e2540df051f499d937dd94a`** (새 upstream commit 발견 시 승인 없이 자동 교체하지 말고 drift 보고). 승인 23개 단원·732문항(영어12/사회5/수학6). 승인 effective 콘텐츠·이미지·태그·overlay·SHA를 이미 수집한 A단계 빌더(`approved_catalog_normalizer.mjs`, `build_approved_index.mjs`, `generated/approved-source-index.json`)를 재사용.
- 현 `approved-catalog/deployment/active-deployment.json`은 entries **0**이며, 미디어 공개 권리 확인도 23/23 HOLD다. **이 값을 변경해서 실제 게임 운영에 카트리지를 활성화하거나 교사 배포 승인을 가짜로 생성하지 마라.** 별도 QA용 catalog/fixture는 격리·오프라인에서만 사용하고, 배포본으로 섞일 수 없도록 빌드 타입/해시·CI 게이트를 둔다.
- R6 패치 클라이언트 경로는 실 GAS 40/40(테스트 게임 페이지에서 `track()` 호출), 서버 재시도 없는 40 동시 기록은 19/40; R7 KST 자정 seal은 NOT RUN. **R7을 기다리지 말고 이 지시서 F를 먼저 개발**한다. 운영 승인은 별도다.

## 1. 기존 승인 A/C/D 통합 렌더러만 재사용 — 새 렌더러 개발 금지
다음은 **이미 있는 소스**다. 우선 직접 읽고 연결 위치를 파악하고, 과거 시험 증거와 실패 사례를 보존하라.
- `experimental/unified-quiz-renderer/HOJA_APPROVED_RENDERER_BRIDGE.html`: 원본 교사 승인 A/C/D 스타일/배치 계산 보존. `HOJA_APPROVED_RENDERER.load()/show()/stable()/embed()`, 답변 capture 및 교사 주관식 판정 메시지 계약 사용.
- `HOJA_UNIFIED_FRAME_HOST.mjs`, `HOJA_TEAM_APPROVED_BINDING.mjs`, `HOJA_ARCADE_APPROVED_MAPPING.mjs`, `HOJA_ARCADE_APPROVED_RUNTIME.mjs`, `HOJA_REVIEW_SESSION.mjs`: 승인 문항 원본 메타데이터/3지선다 재매핑/점수·오답 복습/아케이드 통신. 승인 렌더러에 없는 문항일 때 무단 텍스트 fallback 금지.
- `experimental/unified-quiz-renderer/game-trial/build_trial.py`과 `game-trial/part-01..25.txt`: **시험용** 7MB 게임 재조립 경로. 기존 운영 `versions/2.0.0/Game.html.parts/*`나 루트 Game.html/Code.gs/main은 변경하지 말 것.
- `experimental/unified-quiz-renderer/gas-test/HOJA_QB_EMBEDDED_API.gs`, `HOJA_QB_UNIT_S6U31.gs`, `HOJA_QB_UNIT_S6U32.gs`: 사회6 2개 단원/64문항 내장 조회 시험판을 비교·일반화할 참고 자료. 이 소스의 `Code.TEST.gs`는 무기록 전용이므로 40-6 V4 통합 번들에 무검토 복사 금지.
- `experimental/usage-v4-unified/build_unified_gas.py`: 패치한 단일 GAS 시험 번들 생성기. 기존 telemetry 한 블록만 변경하던 검증 계약을 깨지 말고 A/C/D 패치와 **한 가지 재현 가능한 격리 빌드**로 조립. 기존 7MB 게임 리소스 변경 최소화, 수정 전후 정확한 diff/SHA 보고. 렌더러와 오디오/키보드 리스너 중복 삽입 금지.

## 2. F1 — 정본 23단원의 실제 '문항+그림+태그' 내장 로더
- A단계의 진짜 승인 데이터로부터 각 단원마다 최소 `{cartridgeId,title,grade,semester,subject,publisher,author,questionCount,questions,images,tags,unitMeta,effectiveDigest}`를 생성하라. 문항의 `sourceQuestionId`, `rendererQuestion`, `familyId`, 정답 ID와 그림/배치/선택지 원본 인덱스를 보존한다. 승인 기록의 표기와 스키마를 우선하고 **필드를 이름으로 추측하여 무증거 보완하지 마라**.
- 영어 천재 5학년 10단원 q21 승인 시계 이미지 교체를 최종 표시 데이터에도 적용. 수학 19개 C형 교사 지정 배치 및 보기 줄바꿈, 사회의 approved effective/assets/layout-preferences, YBM 승인 questions/tags/images 등 출처별 계약 검사. 정본 삽화가 깨지거나 문항/보기/정답의 매핑이 어긋나면 fail-closed.
- **코드에 카트리지 ID·제목을 목록으로 하드코딩하지 않는다.** 과목별 읽기 어댑터는 허용하되 추가 단원이 approved catalog에 들어오면 자동 발견·분류되도록 fixture + 실제 source index로 증명.
- GAS 런타임 GitHub/Sheets 카탈로그 외부 조회 금지. 정본 콘텐츠 패키지와 활성 메타데이터를 빌드 시 생성하고, 시험용 loader에서 승인 ID→해당 단원의 내용만 지연 로드한다. 전체 732문항/그림을 앱 최초 화면에 무조건 렌더링하지 않는다. GAS 코드 크기·응답 시간·인라인 이미지 용량을 계측한다.
- **출시용 활성 목록과 미배포 QA 목록을 분리**. QA는 읽기 전용 로컬/격리 브라우저에서만 가능한 별도 빌드 구성이며, Project A 공개 운영의 승인 게이트에 영향을 주면 FAIL.

## 3. F2 — 세 게임 모드와 오답 복습을 실제 연결
1. **싱글 문제풀이:** 정본 카트리지 선택→문항 렌더→원래 지정 A/C/D 배치 및 그림→3지선다/ OX 입력→선택 즉시 정답·오답 판정과 다음 문제. 기존 단축키 입력 기능 복구/검증. 싱글 주관식 제외.
2. **싱글 아케이드:** 게임 화면에서 문제의 원본 렌더러를 iframe으로 띄우고, 게임 pause/resume, 문항 선택, 답 판정, FINISH 및 오답 풀이 연결. 기존 시간·풍선·랭킹 정책 손상 금지. 복습 전 완료/랭킹 성급 저장 금지. 인트로가 뒤에서 재생되어 효과음이 겹치지 않도록 상태 회귀 확인.
3. **팀전:** 기존 선택지 3개 셔플과 원본 4지 보기를 별도 보존하고 정답 매핑 검증. 주관식은 **교사 수동 정오 판정** 유지. 우승자 발표 이후 `stage===3`에서 오답 풀이 진입, 미출제 문제는 복습에 포함하지 않음. 기존 팀 점수·우승 결과·기존 종료 흐름 불변.
4. **전체 공통:** 싱글/아케이드/팀전/복습 모두 **원본 동일 A/C/D 렌더러**. 모드마다 새로운 미니 렌더러를 만들지 말 것. 3지선다, OX, SHORT, 그림 단원, 긴 선택지 자동 줄바꿈, C형 좌우/중앙 배치, 키보드·전자칠판 터치 검증.
5. **오디오/이벤트:** 게임 진행 중 중복 iframe/인트로 BGM·효과음, 키 이벤트 중복, 비활성 배경 게임 tick, 점수 이중정산·순위 중복 생성 방지.

## 4. F3 — 승인 ID의 게임 사용량 기록까지 하나의 연결로
- 40-6O에서 확인한 **중요 버그 수정 필수:** `experimental/usage-v4-unified/gas/UsageTelemetryClient.html`의 `track()`가 `/^[0-9]{1,11}$/`만 허용해 **영문을 포함한 승인 ID를 조용히 무시**한다. 구형 숫자 ID와 신규 승인 ID를 시대/배포 게이트에 맞게 분리하고, 실제 시작 시 **approved A1** 기록이 발행되며 이전 구형 61일 기록과 섞이지 않도록 고쳐라.
- 승인 era에서 서버의 `recordUsageStartU1()` + 클라이언트 텔레메트리 + 게임 화면 로더가 **동일 active catalog**를 사용해야 한다. 조합은 승인 ID 정렬 및 제목 allowlist. 미승인 ID, 비활성 ID, 이름 위장, 스키마 충돌, 원본 eventId 유출은 차단.
- 같은 eventId bounded retry 및 watermark 원자성은 이전 R6 PASS를 회귀 테스트로 보존한다. 자정 이후 진행 중 재시도는 시작시각/수신시각 정의를 먼저 확정하고 잘못된 날짜로 집계하지 않게 시험한다.
- 허가되지 않은 QA mock 플레이는 PUBLIC 운영 EVENT_LOG에 쓰지 말 것. **시험만을 위한 단독 사본과 test-only deployment manifest**를 쓰되, 운영 activation이나 미디어 권리 승인이 있었다고 주장하지 않는다. QA 기록이라면 시험 데이터임을 강하게 격리·표시한다.
- 승인 era 통계에서 구형 17,670회를 합산하지 않는다. 구형 실적을 별도 표시해야 하는지 아직 사용자 승인되지 않았으므로, **승인 era 화면에는 기본 숨김** 제안과 함께 설계/시험 근거를 제출. 원본 보존과 공개 화면 표시는 별개다.

## 5. F4 — 체계적 검증(자정 R7과 독립)
- **먼저** Node/mock/실 승인 콘텐츠 검사: 23단원, 732문항(객관식·OX·주관식), 각 단원 실제 정본 제목/그림/태그/승인 C형 배치/답 매핑, q21 오버레이·수학 줄바꿈, 새 단원 자동 추가, SHA/파일 누락·본문/이미지 변조 거부.
- 원본 승인 렌더러와 연결 화면 비교: 1920×1080, 1280×720, 1024×768, 390×844 및 전자칠판 85인치 터치 가능 범위. 변경이 없는 원본 A/C/D CSS 및 측정 로직은 해시로 고정. **실전자칠판 시험은 실제 기기가 없으면 NOT RUN**.
- Chromium에서 **실제 게임 버튼을 클릭하는 흐름**으로 싱글 문제풀이/아케이드/팀전 선택·문항 표시·판정·복습을 시험. 기존 R6 텔레메트리 함수 직접 40번 호출 시험은 게임 시작 버튼 전체 E2E가 아니다. 자동 스크립트가 40/40·중복0·watermark/집계 정합 등에 **단언(assert) 실패 시 비정상 종료**하도록 강화.
- 게임 시작 후 iframe/오디오/키보드 리스너 중복 0, 오답 복습의 이전 점수/우승 결과/랭킹 불변, SHORT 솔로 제외·팀 교사 판정 검증.
- 승인 active 0개인 운영 배포용 빌드는 승인 항목 0개로 동작(테스트/실기 롤아웃 없이 기존 게임 기능 유지). test-only QA 항목을 가진 빌드와 **산출물 해시 및 CI로 분리**.
- Github Actions CI에 정본 pin 및 드리프트/approval/active gate/test-only exclusion 검증. 이전 CI는 정본 checkout secret 미설정으로 일부 SKIPPED였으므로 본 단계에서 보완 또는 제한 명시. GAS 실제 엔진/게임 브라우저/Node(mock)의 PASS를 구분.

## 6. 작업 순서·커밋·중단 조건
- F0: 기존 통합 렌더러·세 모드·로더 코드 진입점 목록과 계약을 작업 로그에 간결하게 기록.
- F1: 진짜 승인 데이터 → 23개 단원 내장 로더 구현 및 콘텐츠 불변성 테스트 (첫 커밋).
- F2: 싱글 문제풀이 실제 게임 버튼/판정 연결 (다음 커밋).
- F3: 아케이드 실제 문제/정답/복습 + 팀전/우승 복습 (단계별 분리 커밋).
- F4: 정본 ID A1 기록 누락 수정, 복구·공개 통계 분리 및 fail-closed 시험 (별도 커밋).
- F5: 회귀·Chromium·CI/성능·QA 증거. 진짜 실 GAS·QR·전자칠판은 시험 여부 구분.
- 각 단계마다 `docs/HOJA_USAGE_V4_40_6_CLAUDE_WORKLOG_20261123.md`에 변경 파일, git commit SHA, 원본 SHA/정본 수량, CI와 시험 종류, PASS/FAIL/NOT RUN, 미완료 사항 및 데이터 안전성 기록. Claude 자체 최종 승인 금지. GPT-6가 `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md`에 독립 판정.
- **최종 금지:** 운영 GAS, `main`, 루트 `Code.gs`/Game.html, `versions/2.0.0` 원본, 원본 EVENT_LOG·랭킹, 교실매니저 실제 제거, 운영 자동 트리거·원본 정리·공개 배포/PR merge. 미디어 권리 23/23 HOLD, 운영 승인 정본 활성 0개 상태는 유지.
- R7 자정 실 GAS seal은 **별도 보류 항목**, 이 F 단계의 시작을 막지 않는다. 우선 F1부터 착수하고, 테스트가 끝난 부분은 순차적으로 커밋해 GPT-6 독립 감수에 제출.


## 7. 미완료 작업 승계표 — F 현재 작업과 G 다음 단계 (필독, 2026-11-23)
**이전 단계의 미해결 검수 사항은 모두 중앙 체크리스트 [40-6Q](HOJA_GAME_DEV_CHECKLIST_20261122.md)의 Q01–Q12로 이월했다.** 본 지시서 F 작업이 성공하더라도 Q01–Q12를 자동으로 PASS 처리하지 않는다.

**지금 F0–F4 구현 및 제출:** Q01 승인 콘텐츠 23/732 내장 로더·이미지/태그/오버레이, Q02 배포 게이트(운영 active 0 유지), Q03 싱글·아케이드·팀전·오답 복습 동일 정본 렌더러, **Q04 승인 영문 ID `track()` 조용한 무기록 문제**, Q09 승인 A1/구형 U3S1 시대 구분 및 비식별 공개 통계(mock→격리 GAS), Q11 새 단원 드리프트/CI. 실제 클릭 E2E 및 검증 실패 시 자동 종료 테스트를 포함한다. **QA fixture에서만 승인 미배포 콘텐츠를 표시하고 운영 배포 manifest는 그대로 비워 둔다.**
**바로 다음 G 단계에 미리 예약된 미완료 게이트:** Q05 R6 실제 UI 흐름/실패 assert, Q06 서버 독립 19/40·80~120 동시 확장, Q07 즉시 탭 종료·저장소 거부·재접속/최종 실패 알림, Q08 자정 R7·KST in-flight 이벤트 날짜, Q10 익명 RPC·캐시 hit 상태 R8, Q11 현재 HEAD 실제 CI, Q12 전자칠판/QR·랭킹/오디오/게임 전수 회귀. **G 단계는 자정까지 대기하는 작업이 아니라 F 뒤 이어지는 QA**이며 R7 실 엔진만 자정 배포 창을 이용한다.
**별도 사용자/운영 승인 필요:** 미디어 권리 23/23 HOLD, 게임 활성 카트리지 배포 manifest 변경, 운영 배포/PR 병합 및 구형 통계 화면 표시 정책. 테스트 완료가 이 승인들을 대체하지 않는다.

Claude는 F 매 커밋마다 작업 로그에 `Q번호 | 현재 상태 | 구현 커밋 | 시험 유형/결과 | 다음 검증 또는 미완료 사유`를 추가하라. **미실행 항목은 다음 커밋으로 무조건 이월하고 삭제하지 말 것.** GPT-6가 독립 감사 후 중앙 40-6Q 뒤에 새 항목으로 판정한다.


## 8. F1 제출 후 F1-B 시각 호환 작업 (2026-11-23)
F1 제출 HEAD `408ce4e`의 독립 검토 결과는 [별도 지시서](HOJA_USAGE_V4_40_6_F1B_APPROVED_RENDERER_COMPAT_20261123.md) 및 체크리스트 40-6R 참조. **기존 정본을 다시 만들도록 요구하는 대신**, 승인 presentation 버전별 무손실 변환 + 공용 A/C/D 렌더러의 최소 하위호환 확장으로 해결한다. 영어 천재 201문항/6단원, 사회5 2-2 33문항/1단원은 QA BLOCKED 유지하되 F1-B에서 풀 것. 수학 분수/4건의 선택지 줄바꿈과 사회5 3-1·3-2(승인 태그 없음)도 F2 필수 시각 파리티 과제.

**중요:** F1의 16/498 'READY'는 로컬 renderer-v2 표시 시험의 패키지화 통과이지 실제 승인 화면 시각 동일성·운영/미디어 배포 승인이 아니다. CI의 승인 source drift는 token secret 없어 SKIPPED, GAS 실게임 E2E NOT RUN. 교사 배포 승인/미디어 권리 23/23 HOLD 유지. F1-B→F2→F3 커밋별 증거와 잔여 실패를 40-6Q/R 상태로 이어가라.


## 9. F3-2 후속 실행 지시(40-6S, 2026-11-23)
중앙 [40-6S](HOJA_GAME_DEV_CHECKLIST_20261122.md)와 [PR #6 독립 감수](https://github.com/xkdtndbrwk111-prog/SMQ-Project-A/pull/6#issuecomment-7094565277)를 반드시 읽어라. 기존 F1-B 23/732 준비, F2 수학187·사회5 64 DOM parity, F3 smoke 23/23은 **코드/로컬 제출 범위의 PASS**이나 실질 게임 E2E·실 GAS·미디어 권리/배포는 HOLD.

**즉시 F3-2 착수:**
1. `gas/Code.gs` release 경로도 **실제 교사 배포 manifest에 활성화된 approved ID만 게임 LIST/GET·문항 로드·시작 기록·공개 통계에** 연결할 수 있도록 소프트 코딩. 현재 entries=0 유지하며 별도 synthetic test-only deployment fixture로 future active>0 시험. 승인 없이 실제 배포 목록을 채우지 말 것. 구형 Sheets 목록을 신규 정본 출시 UI에 섞지 말 것.
2. `game-trial/run_f3_all_units.sh`는 에러/NO_RESULT/arcade count 0을 실패 종료하지 않을 수 있다. 개별 모드 verifier의 종료코드 및 정확한 PASS 문구를 검증하고, 입력 23개/중복 ID 0/단원별 3모드 모두 PASS 아닐 때 **CI와 셸 프로세스 nonzero**. 실제 승인 원본 pin 재생성 검사는 private qbank secret 없음으로 SKIPPED이므로 별도 과제로 유지.
3. 진짜 게임 **시작 화면 카트리지 선택→싱글 판정→종료**, **팀전 주관식 교사판정·우승 발표→오답 풀이**, **아케이드 실제 Phaser 풍선·FINISH·오답→랭킹**을 *직접 UI 클릭·키보드·터치* 기반 Chromium으로 테스트. 그림보기 22문항 레거시 내부 대체 이름표/3지 셔플의 표시·정답·접근성·복습 혼선 방지 및 전자칠판 최소 해상도 UI 시험 포함. iframe/오디오/게임 tick/이중 정산 누수 금지.
4. 교사 확인용 **격리 QA 미리보기**를 기존 23/732 정본에서 생성하되 콘텐츠·그림을 SMQ 공개 GitHub·운영 사이트/번들에 업로드하지 말 것. 원본 approved presentation 없는 사회5 2-2와 형식 변환된 천재 영어 6개 단원의 234문항에 대해 전수 네비게이션·스크린샷 비교·차이 체크 옵션 제공. 교사 확인을 배포/미디어 공개권 승인으로 간주하지 말 것.
5. Q04 mock A1 telemetry PASS를 **실 approved GAS E2E와 구분**하고 F4에서 격리 GAS 시험, Q05~Q12 G 후속 검증을 준비. QA_TEST_ONLY 속성 플래그 외 격리 프로젝트 identity·재배포 방지; release contents 0/active 0을 CI에서 검증.
6. 40-6Q/R/S의 **모든 미완료 항목**을 작업 로그 `Q번호 | 상태 | SHA | mock/CI/Chromium/실 GAS | 남은 과제`에 이월하고 독립 검수 전 완료로 닫지 마라. 운영/원본/배포/PR merge 금지.
