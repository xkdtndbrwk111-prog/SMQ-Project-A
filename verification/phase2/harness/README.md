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
```

출력은 `results/last-run.json` (git 제외). 개별 실행: `HOJA_TEST_ONLY=network` 또는 `HOJA_TEST_ONLY=replay`. 로컬 서버는 임의 포트의 loopback에만 바인딩하고 시험 후 종료한다. 외부 스크립트가 불안정하면 시간 초과/요청 실패로 실패한다. `network-evidence.json`은 2026-11-20 통과 당시 실제 요청·응답 기록이며 로컬 임시 포트만 마스킹했다.

## 재생 범위와 제약

- 시험 빌드에서만 세션 저장소로 맵 시드 314159를 주고, 각 프레임의 `Math.random`을 고정 PRNG로 바꾸고 Playwright 가상 시계, `performance.now`, RAF 시간 기준을 통제한다. 초기에 장면을 일시정지한 뒤 20초 가상 시각에 맞추고 Phaser 자동 루프를 멈춘 다음 16ms 단위로 게임을 직접 구동한다. 이 과정은 배포 빌드에 포함되지 않는다.
- 동일 이벤트(오른쪽·점프, 문제 답 숫자 키)를 실행한 두 기록과 기준 파일을 비교한다. 문항·보기·답·점수, 위치·속도·충돌, 모든 몬스터 상태, 시간 종료 플래그와 결산 지표를 기록한다. 문제 열기와 시간 종료는 시험 훅으로 유도한다. 부동소수점 수치는 소수점 6자리로 정규화하고 원시 값은 결과 파일에 보존한다. 이는 정해진 단일 시나리오에 대한 회귀 시험이지 모든 맵·물리·키 조합의 증명이 아니다.
- 네트워크 시험은 배포 `dist`에서 교사의 카트리지 선택·싱글 바로 플레이와 실제 생성 QR을 이용한 학생 시작을 게임 장면 준비까지 관찰한다. 요청 주소·메서드·종류, 응답 상태, 실패, 페이지 오류를 수집하고 Firebase/운영 GAS 주소와 로컬·jsDelivr 외의 외부 요청이 없음을 확인한다. 이후 전체 플레이·종료까지의 통신은 이 범위에 포함되지 않는다.
- 아직 자연 이동의 네 지상 맵과 동굴 왕래·FINISH, 과일이 있는 중복 정산, 오답 기록의 전체 불변 조건 및 정상 완주 랭킹은 별도로 검증해야 한다.
