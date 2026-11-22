# Phase 4C — 기존 맵 검수 중간 기록

**상태: 미완료.** 기준 `develop` 커밋 `599ad311ade249d5b62f31b0f344de24afa37e3d`, GitHub 이슈 [#2](https://github.com/xkdtndbrwk111-prog/SMQ-Project-A/issues/2). 4C의 자연 플레이 필수 검수는 아직 완료되지 않았으며 4D·4E로 진행할 수 없다.

## PASS — 직접 재실행한 자동 검사

- 배포·시험 빌드, 배포판 정적 검사, 원본 무결성 및 Phase 1 기준 해시.
- 기존 결정적 trace, 교사·학생 QR와 HTTP 응답/운영 Firebase·Apps Script 요청 0, 유도 FINISH 63점, 중복 정산 방지 및 오답 복습 기록 유지.
- 고정 16ms 이동·무너지는 발판과 뗏목, 맵·동굴 해시, 자동 타일링·지상 배치 및 동굴 체크포인트 505개 시드의 기존 단위 시험.
- 별도의 **위치 유도 시험**으로 지상 세 부활점, 동굴 여섯 부활점, S 토관 왕복, 동굴 시야·컬링과 실제 사망 후 Enter 부활을 재확인. 이것을 자연 플레이 완주로 계산하지 않는다.
- 시험 빌드에서 시드 0, 1, 42, 999, 2026, 41805, 314159, 4294967295의 실제 생성 장면을 불러와 각 5개 맵을 계측했다. 각 시드에서 초원 20·가을 22·열대 24·겨울 24·동굴 5개 적, 맵별 출제 단위 5개를 확인했다. 조각 순서·반전과 재추첨된 실제 종류를 포함한다.

[시드별 후보 표](RISK_TABLE.md)와 [적·지형별 세부 계측 JSON](runtime-inventory.json)에 초기 위치·몸체·순찰 한계·근처 지형·발판·물·문항·꽃·부활점을 기록했다. 총 760개 초기 적 몸체 중 고체 내부는 0개였고, 물 위 X에서 지지면 없는 보행형은 0개였다. 체크포인트 근접 및 시작 높이에서 순찰 지지면이 끊겨 보이는 표본은 후속 실제 행동 확인 후보이며 결함 확정이 아니다. 비행형·점프형, 높은/낮은 발판과 가장자리 회전은 단순 X 표본만으로 판정할 수 없다.

### 실제 플레이 우선 확인 후보

시드 314159 초원에서는 MARTIAN `(688, 880)`의 선언 범위 `576~752` 중 `736·752`에서 시작 높이 지지면이 표본상 없었고, JUMPY `(1856, 880)` 범위에도 같은 종류의 공백이 있다. MARTIAN은 가장자리 회전 처리가 있으며 JUMPY는 점프형으로 선언 범위만으로 이동을 설명할 수 없다. 열대 JUMPY `(1184, 880)`와 겨울 ROBOT `(2512, 736)`에도 표본 공백이 있어 실제 진행 중 확인이 필요하다. 모두 위치 기반 후보이며 실제 낙하·불공정 사망은 아직 재현하지 못했다.

## FAIL — 제한된 실제 입력 시도의 도착점 미도달

- 배포판을 Chrome에서 직접 D·마침표·Enter로 조작했다. 초원 첫 구간에서 이동과 점프, 쓰러짐 후 Enter 계속하기를 확인했고 3회 사망 후 시도를 중단했다. 이 수동 시도에서는 맵 시드를 수집하지 못했고 사망 원인을 확정할 수 없다.
- 별도로 시드 314159에서 브라우저 키 입력을 미리 정한 순서대로 보냈다. 위치·스테이지 강제 이동, 무적, 시각 조작 없이 실행했으며 최대 80개 동작·90초·3회 사망 중 먼저 도달하면 중지한다. [입력 및 결과](natural-keyboard-attempt.json)와 [시작 화면](screenshots/natural-start.png), [중간 화면](screenshots/natural-progress.png), [종료 화면](screenshots/natural-stop.png)을 보존한다. 이것은 사람이 실제 기기를 조작한 시험이 아니라 브라우저 자동 키 입력이다.
- 마지막 키 입력 시도는 초원 맵에서 사망 3회(enemy, enemy, enemy)로 종료되어 완주하지 못했다. 최대 관측 X는 1485.4px, 종료 시 점수 0점·문항 0개였다. 입력 실패나 난이도 문제일 수 있으며, 이 결과만으로 맵·적의 버그를 확정하지 않는다. 재현이 확정된 결함이 없어 게임 소스·적·지형은 수정하지 않았다.

## NOT RUN / BLOCKED

- **NOT RUN:** 지상 4계절 시작→각 끝의 전체 자연 플레이, 동굴 주요 경로의 자연 이동과 자연 왕복, 각 3+6 체크포인트에서 실제 경로로 접근한 사망·부활 전수 확인, 실기기·학교망. 기존 유도 시험 통과로 대체하지 않는다.
- **BLOCKED:** Phase 4C의 필수 자연 플레이 게이트가 미완료이므로 Phase 4D 기믹과 Phase 4E Maker 구현은 시작하지 않았다. 원본 기준 trace는 갱신하지 않았다.

## 재실행

`node tools/build_current.mjs` → `HOJA_TEST_PROBE=1 node tools/build_current.mjs` → `node verification/phase4c/inventory.mjs` → `node verification/phase4c/natural-smoke.mjs` → `node --test verification/phase4c/inventory.test.mjs`. 시험 빌드의 계측은 게임 상태나 난수를 변경하지 않으며, 0번 시드도 명시적으로 전달한다. 게임 시각은 자연 키 입력 시험에서 실제 시간으로 흐른다. 키 타이밍은 실행 환경에 따라 결과가 달라질 수 있다.

기존 회귀는 `HOJA_BUILD=current node verification/phase2/harness/regression.mjs`, `node --test --test-concurrency=1 verification/phase2c/production-cave.test.mjs verification/phase4b/browser.test.mjs verification/phase4b_cave/browser.test.mjs`, `node tools/check_web.mjs dist-current`, `python3 tools/legacy_split.py check`, `python3 tools/check_phase1_baseline.py`로 확인했다. 단계 간 실행 시 기존 단계의 기준 캡처는 보존한다.

## 2026-11-22 후속 검증 — 미완료 유지

- **PASS:** 절벽 브라우저 시험 입력은 정상 전달됐으며 기존 시험의 플레이어가 적과 충돌해 쓰러진 것이 시간 초과의 원인이다. 게임 코드를 바꾸지 않고 안전한 시작 위치와 실제 브라우저 A키를 사용해 절벽 충돌·사계절 지면/공중 발판·숨은 통로 진입까지 재실행했다. [원인 및 배경·뗏목 시험](PARALLAX_WATER.md).
- **FAIL:** 열대 뗏목 정지 그림이 수면 위 16px에 떠 있다. 기존 몸체와 물 판정을 보존하면서 자연스럽게 연결하는 시각 보정은 아직 적용하지 못했다.
- **FAIL (자동 키 입력 자연 시도):** 314159 시드에서 정상 키보드 입력으로 초원 x≈1443까지 이동했으나 적 사유 3회 사망으로 중단했다. 위치 이동·강제 전환·무적은 사용하지 않았다. [입력과 상태 기록](natural-keyboard-retry.json), [시작](screenshots/natural-retry/natural-start.png), [중간](screenshots/natural-retry/natural-progress.png), [중단](screenshots/natural-retry/natural-stop.png). 수동 사람 플레이와 자동 입력을 혼동하지 않는다.
- **NOT RUN:** 사람이 직접 수행한 사계절 및 동굴 전체 자연 완주와 자연 경로로 모든 부활점·기믹·문항·꽃·FINISH 확인, 다른 시드의 비열대 뗏목, 학교망·실기기.
- **BLOCKED:** Phase 4C 자연 완주 게이트는 미완료이며 Phase 4D·4E는 착수하지 않는다.
- **PASS — 추가 회귀:** 원본 및 Phase 1 해시, 26개 입력·몬스터·스프링·뗏목·이동/무너짐 발판·지면·장식·동굴 지형 단위 시험, 배포판 정적 검사, 결정적 trace, QR·HTTP, 유도 FINISH/63점·중복 정산·오답 복습, 개인전 데이터 집계, 지상 체크포인트·토관 S키 왕복, 동굴 여섯 체크포인트 유도 시험, 물 수면 접촉 및 화면 아래 사망 규칙. 절벽 전체 시험은 수정 후 세 차례 통과했다.
- **BLOCKED — 개인전 실제 에뮬레이터 네트워크:** 기존 `demo-hoja-phase3a` Firestore 프로세스가 127.0.0.1:18080을 이미 점유해 새 격리 시험 인스턴스를 시작하지 못했다. 기존 프로세스나 안전 가드를 변경하지 않았다. 개인전 데이터 단위 시험은 PASS이나 실제 교사·학생 개인전 네트워크 재실행은 NOT RUN이다.
