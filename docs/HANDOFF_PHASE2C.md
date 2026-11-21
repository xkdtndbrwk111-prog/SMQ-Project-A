# HOJA QUIZ Phase 2C 인수인계 — 감독 검토 요청

## 기준과 현재 구조

Phase 2B 감독 승인 기준은 `b2d1147dddba6bf1de38943ba7216308ec99088e`, Phase 2C 중간 감독 기준은 `6c6f7caf948027abfc5a17bba7c9faed82ceac26`이다. 개발 정본은 `web/current/`이고 기존 Phaser, `versions/`, `legacy/`, Phase 1 패치와 빌드 도구는 복구용으로 보존한다. 기존 거대 IIFE와 공유 RUN/Scene 상태가 남은 classic script 구조이며 ES Module 또는 완전히 독립된 엔진으로 재작성하지 않았다.

```text
교사 index.html / 학생 play.html
    ├─ parent-services.js ─ 내장 카트리지·오프라인 랭킹
    ├─ teacher_qr.js / student.js ─ QR 생성·진입·버전 검사
    └─ parent-gameplay.js ─ iframe 실행 및 부모 메시지
               │
arcade.html (Phaser Scene·RUN·스테이지 전환·충돌 이벤트 순서)
    ├─ arcade-host.js ─ 부모 통신
    ├─ keyboard / quiz-normalizer / run-record / review / settlement
    ├─ audio / hud / physics
    ├─ world/ ─ 동굴·지상 템플릿, 테마, 시드 생성
    ├─ enemies/ ─ 공통 시스템과 기존 9종 행동
    └─ springs / moving-platforms / rafts / crumbles
```

동기 스크립트가 모듈을 전역 등록한 뒤 main IIFE가 필요한 상태와 Scene을 주입한다. Scene은 생성·갱신 순서와 충돌·이벤트 수명을 유지한다. 필수 등록이 없거나 순서가 다르면 빌드 검사 또는 화면 오류로 명시적으로 실패한다. 초기화·구체적 의존성은 `verification/phase2c/DEPENDENCIES.md`, `MODULE_LOADING.md` 및 각 기능 문서 참조.

## 빌드와 시험

```sh
node tools/build_current.mjs                       # dist-current/ 배포판
HOJA_TEST_PROBE=1 node tools/build_current.mjs     # dist-current-test/ 시험판
node tools/check_web.mjs dist-current
node tools/build_web.mjs
node tools/check_web.mjs
python3 tools/legacy_split.py check
python3 tools/check_phase1_baseline.py
node --test verification/phase2c/*.test.mjs
HOJA_BUILD=current HOJA_TEST_ONLY=replay node verification/phase2/harness/regression.mjs
HOJA_BUILD=current HOJA_TEST_ONLY=settlement node verification/phase2/harness/regression.mjs
HOJA_BUILD=current HOJA_TEST_ONLY=network node verification/phase2/harness/regression.mjs
```

브라우저 시험은 설치된 Chrome, Playwright 및 고정 버전 Phaser CDN 접근이 필요하다. 시험 훅은 `tools/current-test-*.mjs`가 시험 빌드에만 주입한다. 실제 시험 범위는 `verification/phase2/harness/README.md` 참조. `baseline-trace.json`과 Phase 1 기준 해시는 갱신하지 않았다.

## 기능별 작업과 근거

- 움직이는 발판 `3975eba`, 뗏목 `759a987`, 무너지는 발판 `4748d81`: Scene 호출·충돌 책임은 유지하고 생성·갱신 로직을 각각 분리. 16ms 고정 프레임에서 방향 전환, 물에 잠김·복구, 붕괴·재생성 등을 시험했다. 모든 실제 플레이 상황을 망라한 것은 아니다.
- `b0597b7`, `c553fc3`: 모듈 누락·순서 오류 검사와 실제 브라우저 오류 표시 확인.
- `185bb16`: 숨은 지상 구덩이 덮개와 물가 전경의 깊이 겹침에 의한 이미지 경계선을 수정. 고정 시드에서 덮개를 열고 닫으며 전경 순서가 복구되는지 시험했다. `CAVE_COVER.md` 참조.
- `35aa74e`~`af13352`: 사용하지 않는 진단을 제거하고 동굴 비교·카메라·화면·벤치마크·CPU/FPS 진단을 시험 빌드로 분리했다. 배포판에는 기본 동굴 컬링과 자동 화질 조정이 남는다. Maker의 가져오기·대화 및 Maker 모드 맵 전환은 보존하며 일반 싱글 강제 전환은 차단한다. 전체 참조와 분류는 `DIAGNOSTICS.md` 참조.
- `f516cfe`: 실제 배포판에서 두 개의 시험용 Maker 맵 가져오기, 다음 맵 전환, 기본 맵 복귀를 검증한다. 실제 외부 Maker·Lab 앱과의 연결 검증을 대체하지 않는다.

## 최종 검증 결과 — 2026-11-21

- **PASS** — 배포판·시험판 빌드, 기존 정적 검사 및 배포판 추가 검사, 원본 재결합 무결성 및 Phase 1 기준판 11개 파일 해시. 생성 배포판 버전 `224faffb5f`.
- **PASS** — 모듈·브라우저 시험 48개. 세 기믹 고정 프레임 시험, 모듈 누락·순서, 실제 Maker 가져오기·맵 전환, 숨은 덮개 개폐와 동굴 기본 컬링 검증 포함.
- **PASS** — 고정 시드·난수·가상 시계·16ms·동일 입력 재생이 기준 trace와 일치. 위치·속도는 소수점 6자리, 문항·보기·응답·점수·이벤트는 정확히 비교했다.
- **PASS** — 유도 FINISH 63점, 반복 종료·정산 방지, 오답 복습 전후 기존 기록·점수 불변, 정상 완주 랭킹 화면.
- **PASS** — 독립 브라우저의 교사 싱글 시작과 생성된 학생 QR 진입, 버전 불일치 거부, 실제 HTTP 응답 검증. 이 시작 구간에서 Firebase 및 운영 Apps Script 요청 0건.
- **NOT RUN** — 지상 4맵·동굴의 자연 왕래 및 자연 완주, 실기기, 전체 플레이 시간의 네트워크, 외부 Maker·Lab 앱 통합, 모든 시드·물리 상황. 기존 자연 탐색 실패 기록은 보존한다.

이 문서는 개발 결과와 정해진 시험의 범위를 기록한다. Phase 2C 최종 판정은 감독 검토에 맡기며 Phase 2D에는 진입하지 않았다. 운영판·main, 물리·바닥·맵·시간·점수·기존 UI와 실제 Firebase/랭킹 서버는 변경하지 않았다.
