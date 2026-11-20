# HOJA QUIZ 2.0 — 최신 소스

- 기준일: 2026-11-20
- 사용자 제공 현재 게임 소스 및 버그 수정본을 그대로 보관 (줄바꿈 LF 정규화).
- Game.html: 7,208,766 bytes, 25개 조각. SHA-256: `4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6`.
- Code.gs 및 UsageRollupU3S.gs: 사용자 제공본 반영. UsageRollupU3S.gs는 이전 LF 기준과 동일.
- appsscript.json: Sheets API v4 고급 서비스, Asia/Seoul, V8 및 기존 웹앱 설정 유지.
- 복원: 저장소 루트에서 `python3 versions/2.0.0/restore_game.py`.
- 이전 원본은 Git 커밋 이력에 보존. 1.0.0 보관본은 변경하지 않음.
- GitHub 보관용 갱신이며 Apps Script 배포 및 운영 데이터 변경은 하지 않음. 향후 신규 레벨/몬스터/시간 규칙 설계는 이 소스를 기준으로 별도로 진행.
