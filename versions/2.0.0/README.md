# HOJA QUIZ 2.0.0 — 공식 소스 보관 (R17S)
- 승인/기준일: 2026-10-28 KST
- 제품: HOJA QUIZ 2.0 (기존 SUPER MARIO QUIZ 1.0의 후속)
- 승인 근거: 사용자 R17S 실제 플레이 결과 현재 문제 없음 보고
- 정본 프런트엔드: **Game.html**, 7,163,576 bytes, SHA-256 `8ef1856efe8380d97e22e183e66b8b1771b04ca3de9457128646c74681d3c9d0`
- 로컬 아카이브 출처: 2026-10-28 R17S Game.html 전체 교체용 TXT
- 구현: 기존 Phaser 아케이드 소스 1회 보관, 튜토리얼 Stage 0 차이 패치로 복원; 공용 감정 WebP 30개, MP3 12개, 걷기 스프라이트 2개 재사용
- 원본 R17R은 최적화 전 복구 기준으로 별도 보존; 운영 배포 변경 없음

## 소스 복원
GitHub API 단일 대형 요청 제한으로 Game.html의 **전체 텍스트를 16개 Git blob으로 저장**했습니다. 조각 모두 저장되어 있으며 원본 손실 없는 복원 스크립트를 포함합니다.

```sh
python3 versions/2.0.0/restore_game.py
shasum -a 256 versions/2.0.0/Game.html
```
정상이라면 SHA-256은 `8ef1856efe8380d97e22e183e66b8b1771b04ca3de9457128646c74681d3c9d0`입니다. 스크립트는 조각 SHA와 복구 원본 SHA가 일치하지 않으면 중단합니다. **Game.html.parts의 일부를 직접 Apps Script에 붙여 넣으면 안 됩니다.**

## Apps Script 구성 현황
- `Game.html` — **v2.0 R17S 원문 확보/보관**
- `Code.gs`, `Boot.html`, `appsscript.json` 등 현재 GAS 프로젝트에 있는 나머지 파일 — **현행 서버 HEAD를 읽지 못했으므로 v2.0 원문 검증/보관 미완료**
- 기존 저장소 루트의 `Code.gs`, `Index.html`, `Styles.html`, `UsageRollupU3S.gs`, `appsscript.json`은 **2026-09-29 슈퍼 마리오 퀴즈 1.0 계열 스냅샷**입니다. 현재 서버의 2.0 파일과 같다고 판단하지 말 것.
- 호스팅 Apps Script 프로젝트에 코드·배포·트리거를 변경하지 않았음.
- 최신 서버 export를 확보한 뒤 각 파일명/크기/SHA를 검증해 v2.0에 추가 보관할 것.

## QA
- R17S 소스 복원 SHA: R17R Stage 0와 일치하는 복원 경로 검증(작업 보고)
- 사용자의 실제 플레이 확인: 현재 문제 없음
- 실제 GAS 서버 저장 HEAD와 이 아카이브의 동일성: **NOT VERIFIED**
- 일반 아케이드·팀전 기존 코드/스타일 원본 유지, 패치 동작은 엔진 버전 의존
