# HOJA QUIZ 2.0 — Project A (current source)

**2026-11-20 기준 사용자 제공 최신 버그 수정 소스 하나만 유지합니다.** GitHub 소스 갱신은 Google Apps Script 자동 배포가 아닙니다.

## 현재 구성
- `Code.gs` — HOJA 2.0 서버, Project B 공용 문제 조회(읽기 전용), 독립 랭킹, 이용 기록. 2026-11-20 사용자 제공 소스 반영.
- `UsageRollupU3S.gs` — 기존 00:15 통계 집계/검증 유지.
- `appsscript.json` — 운영 프로젝트 매니페스트 (Sheets API v4 고급 서비스 포함).
- `versions/2.0.0/Game.html.parts` — **최신 게임 코드** 분할본 25개. 2026-11-20 사용자 제공 원본 (LF 정규화).
- `versions/2.0.0/SHA256_MANIFEST.json` — 전체 파일/개별 조각 검증.
- `versions/2.0.0/restore_game.py` — 현재 `Game.html` 복원 스크립트.
- `versions/1.0.0/` — 2026-10-28 기준 마리오 1.0 운영 원본 백업. **보존.**

**주의:** GitHub API 대용량 단일 파일 제한 때문에 `Game.html` 원문을 루트에 커밋하지 않았습니다. 25개 조각을 저장했으며, 다음 명령을 실행하면 루트에 7,208,766바이트 원본이 복원됩니다.

```sh
python3 versions/2.0.0/restore_game.py
```

성공 메시지에 표시되는 SHA-256은 `4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6`이어야 합니다. 복원 후 `Code.gs`, `Game.html`, `UsageRollupU3S.gs`, `appsscript.json`을 배포 자료로 사용합니다.

## 데이터/배포 안전
- 이 GitHub 변경은 운영 Apps Script/웹앱 배포/스프레드시트/트리거를 바꾸지 않습니다.
- `SMQ_USAGE_SPREADSHEET_ID` 속성, 기존 `EVENT_LOG` 및 U3S 자동 집계는 유지해야 합니다.
- 운영용 랭킹 스프레드시트는 별도이며 `HOJA_PROD_RANKING_SPREADSHEET_ID` 속성이 필요합니다.
- 과거 마리오 1.0 파일은 루트에서 제거했지만 `versions/1.0.0/`에서 복구할 수 있습니다.
- 이전 HOJA 2.0 R17S 조각은 이 저장소의 현재 트리에서 제거되었습니다. Git의 이전 커밋 기록 자체는 보존됩니다.
- 실제 GAS /dev 및 정식 배포 스모크 테스트는 별도로 진행해야 합니다.

## 게임 개발 전환 체크리스트 (2026-11-22)

[HOJA 게임 개발 전환 — 실행 체크리스트](docs/HOJA_GAME_DEV_CHECKLIST_20261122.md)를 최신 작업 기준으로 사용합니다. GAS 내장 문제은행, 두 싱글 모드 QR 입장, 랭킹 정책, 900초/스테이지당 풍선 6개 변경을 기록합니다. **현재는 구현 전 요구사항 단계이며 기존 운영본·원본 소스·배포 상태는 변경하지 않았습니다.**
