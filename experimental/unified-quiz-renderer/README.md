# HOJA 공통 퀴즈 렌더러 · 실험 브랜치
작성일: 2026-11-22 · 상태: **독립 소스·컨트롤러 검증 단계, 아직 게임에 통합되지 않음**

## 원본의 안전한 재사용
- `HOJA_APPROVED_RENDERER_BRIDGE.html`은 [사회 6학년 64문항 승인 정본 HTML](https://github.com/xkdtndbrwk111-prog/HOJA-QUESTION-BANK/blob/main/approved/social/grade6/semester2/HOJA_SOC6_64_APPROVED_REVIEW_R1_20261122.html)의 원래 `<style>`과 A/C/D 렌더링 코드를 **변경하지 않고**, 첫 번째 스크립트의 기존 `fillQuestionOptions();renderQuestion();` 뒤에 호출용 API만 추가한 파일이다. 기준 원본 Git blob `2487580c191e5037b57c972f4bcebfdeaba5d8ba`.
- `HOJA_APPROVED_RENDERER.load({questions,originalQuestions,images,tags,unitMeta,mode})`: 승인 문항 데이터를 교체. `show({questionId,mode,omitChoiceId})`: 문항 화면 선택. `stable()`: 2 rAF 후 측정값. `embed()`: 교사용 사이드바를 숨겨 게임 viewport로 배치. 클릭을 게임 호스트로 전달하려면 `HOJA_APPROVED_RENDERER_CAPTURE=true` 또는 호스트 명령 `capture` 사용.
- **원본 렌더러의 문제 화면/선택지 렌더링은 유지하지만 게임 점수, 정산, 답변 상태는 직접 변경하지 않는다.** 모드별 `choose()/verdict()`와 연결하는 중간 어댑터가 앞으로 필요하다. 첫 판은 승인 사회6 데이터 자체가 HTML에 포함돼 있으므로 게임용 경량화 작업 전까지 **시험/검토 전용**이다.

## 팀전 오답 복습
- `HOJA_REVIEW_SESSION.mjs`의 `teamWrongAnswerRows({questions,done,teams})`는 `state.done`에 있는 실제 오답만 고른다. 7팀 등에서 미출제된 풍선은 제외한다. 표시할 문항에 `rendererQuestion`이 없으면 조용히 텍스트로 대체하지 않고 실패한다.
- `createReviewSession()`은 무제한 반복 오답 풀이 및 완료 콜백 1회 조건만 관리한다. 기존 팀 점수/우승 결과/최초 정답 기록은 입력받아 변경하지 않는다. 주관식은 게임 호스트가 교사 판정 결과를 `mark(true/false)`로 전달해야 한다.
- 현행 `versions/2.0.0/Game.html.parts/part-22.txt`의 `fromServer()`는 문항 원본 시각 데이터를 유실하므로 **먼저 데이터 전달 구조 보완 필수**. `advanceFinal()`의 `stage===3`에서 우승 발표 후 「오답 복습 시작」을 연결한다. 단, 본 브랜치에서는 아직 실제 7MB HTML에 코드를 꽂지 않았다.

## 이미 실행한 독립 테스트 / 남은 검증
- 원본과 브리지 화면을 같은 조건에서 측정: **교사 C형 좌우 11문항 × HD/FHD/4:3 = 33개 비교, 차이 0**. 대표 5개 C형 FHD 카드 PNG 픽셀 완전 일치. 원본/브리지 양쪽 브라우저 JS 오류 0. 이는 로컬 시험 결과이며 실제 GAS 게임 통합 PASS를 뜻하지 않는다.
- 팀 오답 컨트롤러 로컬 Node 단위 시험 5개 PASS. 브랜치에 동등한 재실행 가능한 `review_session.test.mjs`를 수록. 명령: `node --test experimental/unified-quiz-renderer/review_session.test.mjs`.
- **미실시**: 7MB 게임의 싱글 아케이드/싱글 문제풀이/팀전 실제 버튼 및 정답 판정 연결, 팀전 우승 발표 후 실제 복습 오버레이, 복습 완료 전 랭킹 서버 저장 차단, GAS 실기기 및 전체 64×3 픽셀 회귀.
- 사용자 확정 정책: 모든 모드+복습에 **동일한 원본 A/C/D 렌더러** 적용. 팀전 우승자 발표 후 오답 복습, 팀 점수/우승 불변. 싱글 아케이드 단일 단원만 정상 FINISH+복습 완료 시 랭킹 허용. 싱글 문제풀이·팀전은 랭킹 없음.
- **운영본·`main` 변경 금지.** 본 브랜치를 그대로 병합하거나 GAS에 배포하지 않는다.

다음 작업: 승인 콘텐츠 `sourceQuestionId/contentBlocks/choiceBlocks/media/layout`을 단원별 원본 rendererQuestion으로 손실 없이 매핑 → 세 모드 질문 표시 어댑터 → 팀전 `stage===3` 후 오답 복습 트리거 → 실제 브라우저 실행과 GAS 시험판 검증.
## 2026-11-22 다음 개발 단위: 팀전 시각 메타데이터 보존(소스 추가)
- `patch_team_approved_metadata.py`: SHA-256 고정된 원본 7MB Game.html을 **별도 출력 경로**로 패치. 팀전 `fromServer()`에서 원본 `row`/카트리지 미디어/선택지의 원래 인덱스를 잃지 않도록 보존. 기존 7MB 스냅샷과 `main`은 변경하지 않음.
- `HOJA_TEAM_APPROVED_BINDING.mjs`: 교사 승인 문항의 그림·태그·C 배치와 정답 ID를 확인하고, 기존 팀전에서 섞은 3개 보기의 인덱스로 매핑. 승인 정본 데이터가 없다면 추측·텍스트 대체 금지.
- 단위시험: `node --test experimental/unified-quiz-renderer/team_binding.test.mjs` (7건), `python3 -m unittest discover -s experimental/unified-quiz-renderer -p 'test_patch_team_approved_metadata.py'` (3건).
- **미완료**: 이 데이터 경로는 아직 실제 7MB 게임 브라우저에 렌더러를 표시하지 않음. Apps Script 공용 로더에서 `row.rendererQuestion` 및 `images/tags/unitMeta`를 공급해야 실사용 가능. 개발 사본으로 패치→전체 세 모드 승인 렌더러 연결→팀전 우승 후 복습→브라우저 및 GAS 시험 순서 유지.

## 2026-11-22 공통 iframe 호스트 / 교사 주관식 판정
- `HOJA_UNIFIED_FRAME_HOST.mjs`와 `frame_host.test.mjs`: `embed/capture/load/show` 명령, 문항별 선택 단 1회 전달, 복습 재출제시 초기화. 점수·랭킹 판단은 기존 게임이 유지.
- `HOJA_APPROVED_RENDERER_BRIDGE.html`의 **연결 어댑터 부분만** 수정: SHORT의 정답 확인 클릭 시 답 공개; 교사 정오판정을 `teacher:true`/`teacher:false`로 호스트에 송신. 승인 A/C/D CSS·`selectComposition()/measureAndFit()/fitContent()` 원본 코드는 변경하지 않음.
- 로컬 Chromium iframe(srcdoc) 실제 브라우저: C형 좌우 q04(3보기)→A형 q01 전환, OX q23, 주관식 q29의 교사 오답 판정, 중복 답변 차단, 브라우저 JS 오류0: PASS. Node host 2개/팀 바인딩 7개/Python 패처 3개 단위테스트 PASS.
- 사회6 64문항 × HD/FHD/4:3 총 **192건 DOM 배치 측정값 일치**. 192장 픽셀 스크린샷 전수 비교는 미수행.
- **미완료:** 이 호스트를 실제 분할 7MB Game.html의 싱글 아케이드·싱글 문제풀이·팀전에 붙이는 작업, 우승자 발표 이후 팀전 복습 진입, GAS 실기기 및 랭킹 검증. 위 테스트는 독립 iframe 검증이며 7MB 게임 통합 PASS가 아니다.
