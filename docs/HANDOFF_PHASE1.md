# HOJA QUIZ — 이어서 작업하기 (Phase 1 끝, 2026-11-20)

저장소: `xkdtndbrwk111-prog/SMQ-Project-A` (비공개). 작업 브랜치 **develop**. `main`(fa09c97)·운영 GAS판은 건드리지 않는다.
최신 상태 기록: 노션 「프로젝트A · HOJA QUIZ — 진행 현황」 맨 위. 보고서: `verification/phase1/PHASE1A.md`, `PHASE1B.md`, `PHASE1C.md`.

## 1. 바로 시작하기
```
git clone (위 저장소) && cd SMQ-Project-A && git checkout develop
node tools/build_web.mjs          # dist/ 생성 (교사 index.html, 학생 play.html, arcade.html)
node tools/check_web.mjs          # 정적 검사 ALL PASS 확인
sh tools/serve_trial.sh           # 빌드+검사+서버(8080). 태블릿은 교사 화면을 이 컴퓨터 IP로 열고 QR 생성
HOJA_TEST_PROBE=1 node tools/build_web.mjs   # 시험 전용 빌드 dist-test/ (플레이어 상태 확인 함수 포함, 배포 금지)
```
필요: Node 18+, Python 3(서버·카트리지 생성), 인터넷(Phaser 4.2.1 jsDelivr).

## 2. 필수 파일 (이것만 있으면 이어서 개발 가능)
| 경로 | 역할 | 수정 규칙 |
|---|---|---|
| `versions/2.0.0/` | HOJA 2.0 원본(Game.html 25조각 + SHA 목록 + 복원 스크립트) | **수정 금지** |
| `legacy/game/*`, `legacy/decoded/*`, `legacy/MANIFEST.json` | 원본을 무손실로 나눈 133조각과 풀어 둔 아케이드 등. `tools/legacy_split.py check`로 원본과 바이트 비교 | **수정 금지**(바꿀 것은 변경 묶음으로) |
| `tools/legacy_split.py` | 원본 → legacy 분리·재결합 검증 | |
| `tools/assemble_arcade.mjs` | 빌드 때 아케이드 조립(원본이 실행 때 하던 것과 바이트 동일) | |
| `tools/build_web.mjs` | legacy + 변경 묶음 → dist. 원문이 정확히 한 번 있어야 수정(아니면 빌드 중단) | |
| `tools/web_patches/NN_*.mjs` | **실제 변경 내용 전부**(번호 순 적용). 새 기능은 새 번호 파일로 | 여기서 작업 |
| `web/js/teacher_qr.js`, `web/js/student.js`, `web/vendor/qrcode.js` | 교사 QR 화면, 학생 입장 화면, QR 라이브러리(MIT) | |
| `cartridges/catalog.json`, `cartridges/*.json` | 내장 카트리지(시험용 2개). `tools/make_test_cartridges.py`로 생성. version = 파일 SHA-256 앞 12자리 | 문제 바꾸면 version도 바뀜 → 옛 QR 자동 차단 |
| `tools/check_web.mjs` | dist 정적 검사(Firebase·Apps Script 0건, 조작표, 제거 항목 등) | 새 규칙 생기면 항목 추가 |
| `tools/serve_trial.sh` | 시험판 실행 | |
| `verification/phase1/*.md` | 단계별 결과 보고서 | |

만들어지는 것(커밋 안 함): `dist/`, `dist-test/`, `/Game.html`.

## 3. 변경 묶음 목록 (적용 순서)
01 팀전 제거 · 02 개인 카트리지 제거 · 03 튜토리얼 관문 제거 · 04 튜토리얼 리소스 제거 · 05 H 도움말(키 배치 그림, HUD 안내) ·
06 내장 카트리지(Apps Script 없음, 랭킹 '시험판 미연결') · 07 교사 화면 모드 2개 + 싱글 QR · 08 학생 화면(play.html) ·
09 개발 기능 끔(F9 등) · 10 키보드 조작 통일 · 11 응답 기록 + 개인 오답 풀이 · 12 잔존 코드 정리

## 4. 확정 규칙 (사용자 결정)
- 모드: 싱글 아케이드, 학급 대결(20~30명, Phase 3) 두 개. 팀전·개인 카트리지·튜토리얼 없음.
- 조작: A·D·W·S·쉼표(달리기)·마침표(점프)·H(도움말)·Enter(확인·계속). 한 동작에 키 하나, `KeyboardEvent.code`. 가상 게임패드·화면 조작 버튼 만들지 않음(태블릿도 물리 키보드). 메뉴·문제 보기 클릭은 허용.
- 싱글 QR: `play.html?m=s&c=카트리지id&cv=카트리지버전&gv=게임버전&s=시즌`. 버전이 다르면 차단 + "선생님께 새 QR 요청".
- 싱글은 Firebase를 불러오지 않는다(요청 0건). 개인 응답 기록은 기기 안에만.
- 랭킹: 단일 카트리지 게임만. 별도 Apps Script + Sheets(B안)는 **승인 후** 생성.
- 게임 시간·물리·바닥·몬스터·맵은 해당 단계 승인 전 변경 금지.
- 운영 Google 계정·운영 Apps Script/Sheets·학생 데이터 접근 금지. 사용자에게는 한국어로 보고.

## 5. 다음 할 일
1. Phase 2 (승인 필요): 모듈 분리(엔진·월드·적·퀴즈·UI), 남은 문제 풀이 모드 코드 제거, 시드 고정 회귀 비교.
2. 랭킹 B안 설계·승인 → 생성. 학급 대결(Phase 3, 비운영 Firebase): 마리오 2.0의 net.js·firebase.js·classdata.js·board.html 계승, 응답 기록 형식(`HOJA_RUN_RECORD()`) 그대로 사용.
3. 사용자 의견: 바닥 지형이 높게 느껴짐 → 맵 단계에서.
4. 미시험: 5맵 완주(FINISH) 경로·실제 태블릿+물리 키보드.

## 6. 시험할 때 유용한 것 (dist-test에서만)
`HOJA_TEST_PROBE.state()` 플레이어 위치·속도·시간, `.quiz()` 문제 창 열기, `.setTime(초)` 남은 시간 바꾸기.
배포본에는 없다(`check_web`이 확인).
