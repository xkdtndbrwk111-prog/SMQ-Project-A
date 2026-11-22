# Phase 4B 추가 — 동굴 자판기 두 곳과 토관 체크포인트

기준 `38a797ad8f8c0aaed96a8fa63348082a80c06d5a`. 개발 정본 `web/current/`. 배포판은 `node tools/build_current.mjs`, 시험 도구 포함 빌드는 `HOJA_TEST_PROBE=1 node tools/build_current.mjs`로 만든다.

## 동작과 배치

- 동굴은 4×4로 나누어 중앙 왼쪽 위 방(6번째)과 그 오른쪽 아래 방(11번째)에 자판기 하나씩 둔다. 지상과 같은 스프라이트, 불빛·흔들림 및 메시지를 재사용한다. 자판기 주위에는 기존 동굴 랜턴과 같은 따뜻한 광원을 넣었고, 기존 시야 마스크가 광원에도 적용된다.
- 동굴에는 토관 4곳과 자판기 2곳, 총 6개의 독립 체크포인트가 있다. 지상에서 진입한 토관이 최초 부활점이다. 동굴에서 토관 근처에 접근하거나 위에 착지하면 S를 누르지 않아도 토관이 활성화된다. 자판기는 가까이 접근할 때 활성화되며, 두 경우 모두 실제 X와 높이를 함께 검사한다. 마지막으로 활성화한 곳만 저장하며 같은 곳에 머무르는 동안 메시지는 반복되지 않는다.
- 부활은 기존 `caveRespawnAnchor`와 사망·Enter 계속하기·주변 적 보호 경로를 사용한다. 지상 체크포인트는 별도의 기존 상태에 유지하며, 동굴 재진입 시에는 새 진입 토관을 선택한다.
- 생성된 실제 충돌 지형의 4×4 가운데 두 방을 검사해 지지면·머리 공간·토관·꽃·문항·이동/특수 발판과 연결 가능한 빈 공간을 확인한다. 난수를 사용하지 않는다. 고체 바닥을 우선하며, 안전한 바닥이 없는 이전 고정 동굴에서는 움직이지 않는 일반 발판을 사용한다. 드문 배치에서는 겹침을 피하기 위해 동일한 자판기 그림을 1.5배로 표시한다(기본 2배). 지형이나 충돌체는 추가하지 않는다.

## 검증 및 캡처

- `screenshots/cave-map.png`: 시드 314159의 실제 충돌 지형을 바탕으로 시험 코드에서 그린 전체 지도. 초록 4개는 토관, 노랑 2개는 자판기다. 게임에 전체 지도 기능을 추가한 것은 아니다.
- `screenshots/cave-vending-1.png`, `screenshots/cave-vending-2.png`: 실제 동굴에서 두 자판기와 기존 시야 제한, 새 광원을 촬영한 화면.
- `seed-314159.json`: 각 토관·자판기 좌표와 주변 문항·꽃 기록.
- PASS: 생성 동굴 505개 시드(0~499, 999, 2026, 41805, 314159, 4294967295)의 두 중앙 방 지지면·충돌·연결성 후보 및 결정적 재현. 기존 고정 동굴에서도 양쪽을 실제 부활시켰다. 이 검사는 충돌 공간 연결을 확인하며 모든 점프 경로의 자연 플레이를 증명하지는 않는다.
- PASS: 시험용 위치 유도로 토관 4곳 각각의 진입 및 부활 좌표, 다른 토관 근접·토관 위 착지, 다른 층 구분, 자판기 두 곳의 순차 활성화와 토관 재활성화. 두 번째 자판기는 실제 사망 연출 후 Enter를 눌러 부활하고 즉시 재사망하지 않음을 확인했다.
- PASS: 지상 중간 부활점 분리, 기존 지상/동굴 토관 실제 입력 왕복, 배포용 동굴 컬링·시야 경로, 정적 검사와 원본·Phase 1 해시, 기존 결정적 trace·유도 FINISH/정산 및 싱글 QR/네트워크 검사.
- NOT RUN: 동굴 전체를 자연 이동으로 완주한 시험, 실기기·학교망, 실제 운영 서비스. 강제 위치 이동 및 생성 지형 연결 검사를 자연 완주로 보고하지 않는다.

시험: `node --test verification/phase4b_cave/geometry.test.mjs verification/phase4b_cave/browser.test.mjs`, `node --test verification/phase2c/production-cave.test.mjs verification/phase4b/browser.test.mjs`, `HOJA_BUILD=current node verification/phase2/harness/regression.mjs`, `node tools/check_web.mjs dist-current`, `python3 tools/legacy_split.py check`, `python3 tools/check_phase1_baseline.py`.
