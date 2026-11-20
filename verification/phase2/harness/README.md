# Phase 2A 회귀 하네스 (진행 중)

기준: 41805cb의 게임 내용(Phase 1 원본 83e8ac1), 시험 전용 계측 추가. `baseline-trace.json`은 고정 기준 기록이다. 자동으로 갱신하지 않는다. 게임 변경 의도가 있다면 기존 기준과 차이를 검토한 후 별도 승인/기록으로 갱신한다.

## 실행

Node.js 18 이상, npm, Chrome과 jsDelivr 접근이 필요하다. Chrome 경로는 macOS 기본 설치를 사용하며 `CHROME_PATH`로 변경 가능하다. 기준 수집 환경: Node 24.21.0, Playwright 1.56.1, Chrome 157.0.8103.80, macOS. 브라우저·운영체제·Phaser 버전에 따른 수치 차이를 별도 조사해야 한다.

```
npm ci --prefix verification/phase2/harness
node tools/build_web.mjs
HOJA_TEST_PROBE=1 node tools/build_web.mjs
node tools/check_web.mjs
python3 tools/legacy_split.py check
python3 tools/check_phase1_baseline.py
node verification/phase2/harness/regression.mjs
# 신규 정본도 비교할 때:
node tools/build_current.mjs
HOJA_TEST_PROBE=1 node tools/build_current.mjs
HOJA_BUILD=current node verification/phase2/harness/regression.mjs
```

출력은 `results/last-run.json` (git 제외). 개별 실행: `HOJA_TEST_ONLY=network`, `replay`, `settlement`, `explore`. 기본 실행은 network·replay·settlement를 실행하며, 아직 미완료인 자연 경로 탐색은 `explore`로 별도 실행한다. 로컬 서버는 임의 포트의 loopback에만 바인딩하고 시험 후 종료한다. 외부 스크립트가 불안정하면 시간 초과/요청 실패로 실패한다. `network-evidence.json`은 2026-11-20 통과 당시 실제 요청·응답 기록이며 로컬 임시 포트만 마스킹했다.

## 재생 범위와 제약

- 시험 빌드에서만 세션 저장소로 맵 시드 314159를 주고, 각 프레임의 `Math.random`을 고정 PRNG로 바꾸고 Playwright 가상 시계, `performance.now`, RAF 시간 기준을 통제한다. 초기에 장면을 일시정지한 뒤 20초 가상 시각에 맞추고 Phaser 자동 루프를 멈춘 다음 16ms 단위로 게임을 직접 구동한다. 이 과정은 배포 빌드에 포함되지 않는다.
- 동일 이벤트(오른쪽·점프, 문제 답 숫자 키)를 실행한 두 기록과 기준 파일을 비교한다. 문항·보기·답·점수, 위치·속도·충돌, 모든 몬스터 상태, 시간 종료 플래그와 결산 지표를 기록한다. 문제 열기와 시간 종료는 시험 훅으로 유도한다. 플레이어·몬스터의 위치와 속도만 소수점 6자리로 정규화하고 나머지는 정확 비교한다. 원시 값은 결과 파일에 보존한다. 이는 정해진 단일 시나리오에 대한 회귀 시험이지 모든 맵·물리·키 조합의 증명이 아니다.
- 네트워크 시험은 선택한 배포 빌드에서 교사의 카트리지 선택·싱글 바로 플레이와 실제 생성 QR을 이용한 학생 시작을 게임 장면 준비까지 관찰한다. 교사·학생은 독립 브라우저 컨텍스트를 쓴다. 요청 주소·메서드·종류, 응답 상태, 실패, 페이지 오류를 수집하고 각 요청의 2xx 응답과 Firebase/운영 GAS 주소 및 로컬·jsDelivr 외의 외부 요청이 없음을 확인한다. 이후 전체 플레이·종료까지의 통신은 이 범위에 포함되지 않는다.
- 유도 FINISH: 문제를 직접 열어 정답 1·오답 1을 만들고, 시험 훅으로 과일 충돌을 유도한 뒤 4번째 지상 맵과 FINISH 문 위치로 이동한다. FINISH 확인 처리, 63점(문제 10·과일 5·시간 48), 종료·과일 정산 재호출 시 불변, 복습 전후 원래 응답 및 지표 불변, FINISH 랭킹 화면을 확인한다. `settlement-evidence.json` 참조. 이 유도 시험은 자연 경로로 완주했다는 증거가 아니다.
- 자연 경로: `HOJA_TEST_ONLY=explore`는 위치 이동 훅 없이 키를 반복한다. 기본 1200프레임, 쓰러짐 3회, 240프레임 정체 또는 벽시계 120초에서 중단한다(사망·문제 처리 프레임은 별도). 2026-11-20 시험은 지상 첫 맵에서 세 번 쓰러져 중단됐다. `natural-attempt.json` 참조. 이것은 탐색 전략의 실패이며 게임 결함 판정이 아니다. 네 지상 맵과 동굴 왕래 및 자연 FINISH는 NOT RUN이다.
