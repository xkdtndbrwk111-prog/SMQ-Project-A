# Phase 1A 검증 기록 (2026-11-20 12:36)

## 무손실 분리·재결합 (python3 tools/legacy_split.py check)
PASS rejoin: 7208766 bytes, sha256 4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6
PASS decoded arcade.html: 1260448 bytes
PASS decoded tutorial.html: 618877 bytes
PASS decoded tutorial_arcade_delta.json: 11677 bytes
PASS decoded team_portraits.json: 2413625 bytes
ALL PASS

## 아케이드 조립 동등성
- 빌드 조립: 1962395 bytes, sha256 c4ff17000c03655461ed2abb90a7f0a762e48b2dd04e7a51324d9d5b5a2adb74
- 원본 실행 조립: 원본 Game.html(SHA-256 4ac5c4ef…)을 로컬 정적 서버로 열고 시험 카트리지 A를 넣은 뒤 HOJA_GAMEPLAY.launch('arcade','spring')가 만든 iframe srcdoc: 1962395 bytes, sha256 c4ff17000c03655461ed2abb90a7f0a762e48b2dd04e7a51324d9d5b5a2adb74
- 결과: PASS (바이트 동일)
