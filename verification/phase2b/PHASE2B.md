# Phase 2B — 신규 웹 정본 전환 및 검증 (2026-11-20)

기준: develop `3d519d1b79f7c1427fd52932c255f2f3dfaff2de`의 배포 빌드. Phase 2A CONDITIONAL PASS를 수용하고 신규 웹 정본만 물질화했다. 엔진·게임 로직·맵·물리·점수·시간·UI·조작과 운영판은 변경하지 않았다. Phase 2C는 착수하지 않았다.

## 파일과 빌드

- `web/current/index.html`, `play.html`, `arcade.html`: 기존 패치 적용 결과의 교사·학생 페이지와 아케이드 HTML을 직접 수정 가능한 정본으로 보존. 현재 공통 부분은 두 HTML에 중복되며 본격 모듈 분리는 아직 하지 않았다.
- `web/current/js/`, `cartridges/`, `vendor/`: 기존 빌드가 복사하던 실행 파일·내장 문제·QR 라이브러리의 신규 정본. 이전 `web/js`, 루트 `cartridges`는 기존 빌드 경로를 보존하기 위한 별도 복구용 입력이다.
- `node tools/build_current.mjs` → `dist-current/`; `HOJA_TEST_PROBE=1 node tools/build_current.mjs` → `dist-current-test/`(시험 전용, 배포 금지). 출력 경로는 고정되고 예상하지 못한 기존 파일이나 링크가 있으면 덮어쓰기를 거부한다. 시험 훅은 `tools/current-test-probe.mjs`에서 시험 빌드에만 주입한다. 기존 `tools/build_web.mjs`와 12개 패치, `legacy/`, `versions/`는 유지된다.
- 기준 파일 내용이 그대로면 기존 QR 게임 버전 `9fa20fcd03`을 유지한다. 현재 소스 실행 파일을 바꾸면 전체 파일 이름·해시와 아케이드 내용을 바탕으로 새 게임 버전을 생성한다. `BUILD.json`의 source·patches는 최초 Phase 1 출처를 보존한 정보이며 신규 빌드가 실제로 legacy나 패치를 읽는다는 뜻이 아니다.

## 재현 명령

```sh
npm ci --prefix verification/phase2/harness
node tools/build_web.mjs
HOJA_TEST_PROBE=1 node tools/build_web.mjs
node tools/build_current.mjs
HOJA_TEST_PROBE=1 node tools/build_current.mjs
node tools/compare_builds.mjs
node tools/check_web.mjs dist
node tools/check_web.mjs dist-current
python3 tools/legacy_split.py check
python3 tools/check_phase1_baseline.py
node verification/phase2/harness/regression.mjs
HOJA_BUILD=current node verification/phase2/harness/regression.mjs
```

Chrome과 jsDelivr 접근이 필요하다. `CHROME_PATH`로 Chrome 경로를 지정할 수 있다. 두 빌드의 비교는 기준 시점의 동등성 검사이므로, 이후 신규 정본을 의도적으로 고치면 차이가 보고되는 것이 정상이다. 기준 `baseline-trace.json`은 갱신하지 않았다.

## PASS

- 기존/신규 배포 파일 목록 11개 동일. `BUILD.json`은 생성 시각 `builtAt`만 제외하고 나머지 메타데이터 일치, 나머지 10개는 바이트 단위 일치. 시험 아케이드도 이전/신규 바이트 일치. `tools/compare_builds.mjs`로 재검증 가능.
- 물질화한 HTML의 기존 줄 끝 공백도 바이트 일치를 위해 보존했다. 따라서 이 파일들을 새로 추가한 `git diff --check`는 해당 공백을 지적한다. 나머지 변경 파일의 `git diff --check`는 통과했고 스테이징된 정본 11개 파일도 작업 파일과 바이트 일치한다.
- 기존과 신규 각각 27개 정적 검사, 원본 재결합 및 기존 11개 파일 기준 해시. 배포판에 시험 훅 없음.
- 신규 정본과 세 빌드 도구만 둔 격리 폴더에서 배포·시험 빌드를 생성해 각 파일과 메타데이터를 비교했다. legacy·원본 조각·패치를 읽지 않고 재현했다.
- 두 빌드 각각 고정 시드·난수·가상 시각·16ms 프레임·동일 키 입력의 기존 기준 trace와 비교. 위치/속도는 소수점 6자리, 점수·문항·선택·정답·시간·이벤트 등 나머지 값은 정확 비교. 지정된 Chrome 환경의 단일 시나리오다.
- 두 빌드 각각 유도 FINISH 63점(문항 10·과일 5·시간 48), 정산 재호출 시 불변, 오답 복습 전후 원래 기록·지표 불변, FINISH 랭킹 화면. 위치/맵/과일은 시험 훅으로 유도했으며 자연 완주가 아니다. `legacy-settlement.json`, `current-settlement.json`에 증거 보존.
- 두 빌드 각각 교사·학생을 독립 브라우저 컨텍스트로 분리해 교사 싱글/생성 QR 학생 입장부터 게임 장면 준비까지 실제 요청 검사. 교사 8건·학생 7건씩 HTTP 200, 실패/페이지 오류 0. 로컬·고정 Phaser jsDelivr 외 요청과 Firebase·운영 Apps Script 요청 0. `legacy-network.json`, `current-network.json` 참조.
- 신규 정본의 학생 JS를 임시 변경했을 때 게임 버전이 바뀌고 복원 후 기존 버전 및 두 빌드 일치가 복구됨. 출력 폴더의 예상 외 파일은 보존하고 빌드를 중지하는 것과 잘못된 시험 모드의 실패를 확인했다.
- 과거 자연 탐색은 재현 자료로 유지하되 방문한 맵 번호의 개수만으로 PASS가 나지 않도록 했다. 동굴 진입·복귀 및 지상 전환 이벤트를 확인하는 회귀는 후속 단계다.

## FAIL / NOT RUN

- FAIL: 최종 검증에서 남은 실패 없음. 시험 하네스 개발 중 시험 서버 루트 처리 오류와 `networkidle` 대기 시간 초과가 발생해 수정하고 전체 시험을 재실행했다.
- NOT RUN: 자연 지상 4맵 및 동굴 왕래 전체 완주·FINISH, 실기기, 게임 시작 이후 종료까지 전체 네트워크, 모든 입력/시드/플랫폼. Phase 2A의 한정 탐색 실패는 기존 기록으로 보존하며 이번에 재실행하지 않았다.

## 감독 검토 요청

파일 정본 경계, 바이트 동등성·회귀 증거, 빌드 버전 정책 및 시험 전용 훅 격리를 검토해 주세요. Phase 2C의 기능별 모듈 분리는 감독 검토 이후 별도 지시에 따라 진행한다.
