# Phase 4A 지면·골인 시험 기록

기준: `2492bfb94754cc00095f66d818ffdd34ad3f9796`. 정본 `web/current/`, 배포 빌드 `node tools/build_current.mjs`, 시험 빌드 `HOJA_TEST_PROBE=1 node tools/build_current.mjs`. 시험 전용 이동·이전 지면 비교 스위치는 시험 빌드에만 있다.

## 사용처와 경계

| 대상 | 렌더링·판정 |
|---|---|
| 네 지상 계절의 일반 지면·연결 고지대 | 기존 생성기의 지면 사각형으로 높이 그리드를 만들고 GrafxKid 원본 16×16 계절 타일로 조립 |
| 공중 고정·이동·무너지는 발판, 뗏목 | 기존 에셋과 기능 유지 |
| 동굴 전용 지형 | 기존 동굴 렌더러와 충돌 유지 |
| 숨은 지하 입구 덮개 | 새 흙 타일을 사용한 비충돌 시각 레이어; 기존 진입·컬링 사용 |
| Maker 지형 | 임의의 격자 외 좌표를 허용하기 위해 기존 렌더러 유지 |
| 물 | 기존 물 판정은 유지. 보이는 물만 낮은 쪽 둑 높이에 맞추고 양쪽 둑 아래로 32px 연장. 기존 물 판정면은 그보다 16px 아래에 남음 |
| 지상 출구·마지막 목표 | 원본 집을 물리 몸체 없는 배경으로 사용. 기존 문 위치에서 W를 누르면 문이 열리고 기존 단계 전환 또는 FINISH 실행. 기존 말풍선 그림과 깜빡이는 COME IN 문구 사용 |

집의 방향은 기존 공중 발판과 적의 초기 위치에 덜 겹치는 방향을 선택하며, 이동하는 적이 향후 집 그림과 절대 겹치지 않는다는 보장은 없다. 기존 몬스터 이동·발판 및 충돌은 수정하지 않는다. 마지막 FINISH는 명시적 요청에 따라 기존의 추가 확인 없이 W 한 번으로 실행한다.

변경 파일: `web/current/arcade.html`, `web/current/js/world/ground-autotile.js`, `web/current/assets/{ground,goal,decoration}/`, `tools/check_module_order.mjs`, `tools/current-test-probe.mjs`, 이 폴더의 시험과 캡처. 네 계절 지면 및 집·장식은 제공받은 GrafxKid 원본이며 CC0 라이선스는 `web/current/assets/decoration/LICENSE.txt`. `catalog.json`에 원본 경로·시트와 스프라이트 크기·기준점·레이어를 기록하고 시작 시 장식 시트는 로드하지 않는다. 말풍선은 HOJA 기존 그림을 재사용했다.

## 시험 방법

- `node tools/check_web.mjs dist-current`; `python3 tools/legacy_split.py check`; `python3 tools/check_phase1_baseline.py`
- `node --test verification/phase4a/ground.test.mjs verification/phase4a/catalog.test.mjs`
- `node --test --test-concurrency=1 verification/phase4a/browser.test.mjs verification/phase4a/comparison.test.mjs verification/phase4a/goal.test.mjs verification/phase4a/maker-fractional.test.mjs verification/phase2c/cave-cover.test.mjs verification/phase2c/maker-production.test.mjs`
- `HOJA_BUILD=current node verification/phase2/harness/regression.mjs`

실제 게임의 고정 시드 화면에서 네 계절·물·기존 공중 발판과 지형 충돌 사각형을 확인한다. 합성 브라우저 타일 시험에서 6칸 상승·10칸 낙하·8칸 상승과 흙 내부 불투명도를 검사한다. 절벽 충돌은 캐릭터를 지정 위치로 옮긴 뒤 실제 입력을 주어 확인하고, 숨은 통로는 입구 위로 옮긴 뒤 중력으로 진입시켜 덮개가 옅어지는지 확인한다. 골인도 시험 훅으로 문 앞에 이동한 후 실제 W 입력을 보낸 유도 시험이다. 시험판의 구·신 지면 비교는 동일 시드 좌표와 충돌을 대조한다.

## 캡처

`./screenshots/{grassland,autumn,tropics,winter}.png`, 각 `-water.png`, 각 `-cliffs.png`, `hidden-entry.png`, `goal-exit.png`, `goal-finish.png`, `compare-old.png`, `compare-new.png`.

## 한계

자연 플레이를 통한 네 지상 맵과 동굴 전체 완주, 실기기·학교망·대규모 동시 접속, 외부 Maker/Lab의 실제 연동은 NOT RUN이다. 시험용 강제 위치 이동이나 합성 절벽 화면을 자연 완주로 보고하지 않는다. 실제 Firebase·GAS·Sheets, main 및 운영 배포는 변경하지 않는다.

## 이번 실행 결과

- PASS: 배포·시험 빌드, 배포 정적 검사와 시험 조작 미노출, 원본 무결성 및 Phase 1 기준 해시.
- PASS: 네 실제 계절 화면과 물 높이·경계, 기존 고체 충돌 영역, 공중 발판 아트, 합성 6/10/8칸 단차 및 불투명 흙, 지형·물 단위 시험과 지연 로딩 장식 카탈로그.
- PASS: 유도 절벽 접근 및 숨은 입구 중력 진입·덮개/물가 가림 복원, 두 단계의 집 문 W 입력과 FINISH, 기존/신규 지면의 동일 좌표 비교, Maker 가져오기·전환 및 비정렬 지형.
- PASS: 기존 600초 결정적 기준 trace 그대로 비교. 시각용 물 객체가 난수 순서를 변경했던 최초 실패를 수정하고 기준 파일 갱신 없이 재통과.
- PASS: 유도 FINISH 63점, 과일·중복 정산 방지·오답 복습과 랭킹 화면. 자연 완주는 아님.
- PASS: 데모 Firebase/Auth/Firestore 에뮬레이터와 독립 교사 1명·학생 3명 브라우저에서 두 카트리지 선택·QR 주소 입장·개인 게임·게임 중 발표·문항 분석·최종 발표; 20/25/30명 배치는 가상 데이터. 물리 QR 카메라 촬영은 아님.
- NOT RUN: 전체 맵 자연 플레이·완주, 학교망 및 실기기·실제 QR 카메라, 외부 Maker/Lab, 실제 운영 서비스.

브라우저에서 절벽 접근의 첫 자동 시험은 장면 시작 타이밍으로 실패했고, 입력 후 실제 이동을 기다리도록 시험을 수정해 단독 실행 시 통과했다. 기존 시험 조건이나 기준 trace는 삭제·갱신하지 않았다.
