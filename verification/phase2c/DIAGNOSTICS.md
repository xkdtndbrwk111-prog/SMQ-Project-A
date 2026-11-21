# 개발 진단과 전역 참조 조사 — Phase 2C

2026-11-21 현재 `web/current/` 전체 HTML·JS의 `window.HOJA_*` 정적 참조 56개 식별자를 조사했다. 아래 위치는 정의와 호출을 모두 포함하며 동적 속성 접근 및 저장소 밖 클라이언트 호출은 검색만으로 확정할 수 없다. 위치는 정본 기준이고 배포 생성본의 위치와 다르다.

## 분류와 처리

| 분류 | 내용과 처리 |
| --- | --- |
| 게임 실행에 필요 | 아래 표의 게임 항목. 부모·학생 진입, 내장 카트리지, 입력·오디오·결산·복습, 모듈 등록, 오류 관찰 및 기본 동굴 렌더링에 사용한다. `HOJA_EVENT_DIALOGUE_STATUS`는 게임 입력 차단에도 사용한다. |
| Maker·Lab에서 필요하거나 외부 의존 가능 | `HOJA_V061_IMPORT`, `HOJA_V061_STATUS`, `HOJA_V2_NEXT_STAGE`, `HOJA_EVENT_DIALOGUE_PREVIEW`, `HOJA_EVENT_DIALOGUE_STOP` 보존. `HOJA_ARCADE_QUERY`는 정본에서 읽기만 하므로 외부 공급 가능성을 보존한다. 맵 전환은 Maker 모드에서만 허용한다. 배포판에서 실제 두 맵 가져오기·전환·기본 맵 복귀와 대화 API를 시험했다. 외부 Maker·Lab 앱 연결은 NOT RUN. |
| 시험판 전용 진단 | 강제 위치·스테이지·시간, 동굴 시야와 카메라 전환, 벤치마크·프로파일·FPS 계측, 진단 버튼·캔버스·대화 예시를 `tools/current-test-*.mjs`에서 시험 빌드에만 삽입한다. 배포판에 시험 프로브와 진단 조작이 없는지 정적 검사한다. |
| 완전히 사용하지 않는 코드 | 참조 없는 과거 `HOJA_V064_PERF_*`, `HOJA_V049_QA`, `HOJA_V050_QA`, `HOJA_STEP12_3_QUIZ_LAYOUT`, 배율 잠금, 튜토리얼 오디오 연결과 숨은 단계별 강제 이동 버튼은 참조 확인 후 별도 커밋으로 제거했다. 상세는 `UNUSED_DIAGNOSTICS.md`와 git 기록 참조. |

기본 동굴 컬링의 내부 `HOJA_STEP134_DIAG`·`135`·`136` 이름은 실제 렌더링에 필요한 제한된 내부 인터페이스로 유지한다. 이름만 보고 시험 전용이라고 판단하면 안 된다. 비교 스위치 및 외부 진단 전역은 시험 빌드로 격리했다. 자동 화질 저하는 기존 실행 경로라 유지하며 FPS 표시·계측만 시험 빌드로 이동했다. `teacher_qr.js`의 localhost 분기는 다른 기기에서 QR을 열 수 없다는 사용 안내로 유지한다.

숨겨진 `v061Panel`의 가져오기·기본 맵 복귀는 Maker 경로다. 학생 시작 전 로비와 소리 제어는 진입·부모 오디오와 연결된 화면 요소이므로 UI 변경 없이 유지한다. 과거 진단 단축키 차단은 일반 게임 입력 보호를 위해 보존하며 진단 단축키를 활성화하지 않는다. 실제 배포판의 강제 스테이지 전환은 일반 싱글에서 거부되고 Maker 모드에서만 동작한다.

분리 내용과 개별 시험은 `CAVE_RENDER_DIAGNOSTICS.md`, `CAVE_SETTINGS.md`, `SCREEN_CONTROLS.md`, `SCREEN_METHODS.md`, `TEST_ACTIONS.md`, `DIALOGUE_PREVIEWS.md`, `BENCHMARK_DIAGNOSTICS.md`, `PROFILER_DIAGNOSTIC.md`, `VISION_METRICS.md`, `FPS_DIAGNOSTICS.md`, `STAGE_GATE.md` 참조.

## 정적 전역 목록

모든 위치는 정의 또는 참조 위치다. 정의가 정본에 없는 읽기 전용 `HOJA_ARCADE_QUERY`의 제공자는 확인되지 않았다. `HOJA_V2_NEXT_STAGE`는 Maker뿐 아니라 일반 싱글 거부를 위한 가드도 포함한다.

| 식별자 | 분류 | 정의·참조 위치 |
| --- | --- | --- |
| `HOJA_ARCADE_EYE_ERROR` | 게임 실행·지원 | `arcade.html:2433` |
| `HOJA_ARCADE_QUERY` | Maker·Lab 또는 외부 연동 가능 | `js/parent-gameplay.js:70` |
| `HOJA_ARCADE_SEASON` | 게임 실행·지원 | `arcade.html:956`, `arcade.html:8645` |
| `HOJA_ATTRACT_CONTROL` | 게임 실행·지원 | `index.html:1840`, `index.html:2181`, `index.html:2231`, `play.html:1840`, `play.html:2181`, `play.html:2231` |
| `HOJA_ATTRACT_GAME` | 게임 실행·지원 | `index.html:1829`, `play.html:1829` |
| `HOJA_ATTRACT_SCENE` | 게임 실행·지원 | `index.html:1501`, `index.html:1842`, `index.html:1845`, `index.html:1847`, `index.html:1907`, `index.html:1908`, `index.html:1918`, `index.html:2214`, `js/student.js:68`, `play.html:1501`, `play.html:1842`, `play.html:1845`, `play.html:1847`, `play.html:1907`, `play.html:1908`, `play.html:1918`, `play.html:2214` |
| `HOJA_AUDIO_CONTROL` | 게임 실행·지원 | `index.html:1234`, `index.html:1344`, `index.html:1915`, `index.html:2290`, `index.html:2403`, `index.html:2461`, `js/parent-gameplay.js:68`, `js/parent-gameplay.js:70`, `js/parent-gameplay.js:77`, `js/student.js:67`, `play.html:1234`, `play.html:1344`, `play.html:1915`, `play.html:2290`, `play.html:2403`, `play.html:2461` |
| `HOJA_BUILD` | 게임 실행·지원 | `index.html:590`, `js/student.js:48`, `js/teacher_qr.js:49`, `play.html:590` |
| `HOJA_B_LIVE` | 게임 실행·지원 | `index.html:2015`, `index.html:2018`, `index.html:2025`, `index.html:2220`, `index.html:2225`, `index.html:2228`, `js/parent-gameplay.js:62`, `js/parent-gameplay.js:67`, `js/parent-services.js:3`, `js/student.js:53`, `js/student.js:59`, `js/student.js:60`, `js/student.js:61`, `js/student.js:71`, `js/teacher_qr.js:38`, `play.html:2015`, `play.html:2018`, `play.html:2025`, `play.html:2220`, `play.html:2225`, `play.html:2228` |
| `HOJA_CATALOG` | 게임 실행·지원 | `index.html:1885`, `index.html:2200`, `index.html:2213`, `index.html:2226`, `index.html:2289`, `index.html:2411`, `index.html:2419`, `play.html:1885`, `play.html:2200`, `play.html:2213`, `play.html:2226`, `play.html:2289`, `play.html:2411`, `play.html:2419` |
| `HOJA_CONNECT_ARCADE_HOST` | 게임 실행·지원 | `arcade.html:1360`, `arcade.html:8624`, `js/arcade-host.js:2` |
| `HOJA_CREATE_AUDIO` | 게임 실행·지원 | `arcade.html:1361`, `arcade.html:1552`, `js/audio.js:2` |
| `HOJA_CREATE_CRUMBLES` | 게임 실행·지원 | `arcade.html:1364`, `arcade.html:8623`, `js/crumbles.js:2` |
| `HOJA_CREATE_HUD` | 게임 실행·지원 | `arcade.html:1365`, `arcade.html:1428`, `js/hud.js:2` |
| `HOJA_CREATE_INPUT` | 게임 실행·지원 | `arcade.html:1365`, `arcade.html:2827`, `js/keyboard.js:2` |
| `HOJA_CREATE_MOVING_PLATFORMS` | 게임 실행·지원 | `arcade.html:1363`, `arcade.html:8621`, `js/moving-platforms.js:2` |
| `HOJA_CREATE_PHYSICS` | 게임 실행·지원 | `arcade.html:1361`, `arcade.html:1500`, `js/physics.js:2` |
| `HOJA_CREATE_RAFTS` | 게임 실행·지원 | `arcade.html:1364`, `arcade.html:8622`, `js/rafts.js:2` |
| `HOJA_CREATE_RECORD` | 게임 실행·지원 | `arcade.html:1366`, `arcade.html:8136`, `js/run-record.js:2` |
| `HOJA_CREATE_SETTLEMENT` | 게임 실행·지원 | `arcade.html:1366`, `arcade.html:8138`, `js/settlement.js:2` |
| `HOJA_CREATE_SPRING_SYSTEM` | 게임 실행·지원 | `arcade.html:1362`, `arcade.html:1557`, `js/springs.js:2` |
| `HOJA_CREATE_SURFACE_GENERATOR` | 게임 실행·지원 | `arcade.html:1359`, `arcade.html:1668`, `js/world/surface-generator.js:3` |
| `HOJA_CREATE_SURFACE_TEMPLATES` | 게임 실행·지원 | `arcade.html:1358`, `arcade.html:1666`, `js/world/surface-templates.js:2` |
| `HOJA_CREATE_THEMES` | 게임 실행·지원 | `arcade.html:1357`, `arcade.html:1584`, `js/world/themes.js:2` |
| `HOJA_ENEMIES` | 게임 실행·지원 | `arcade.html:1373`, `arcade.html:2224`, `arcade.html:3159`, `arcade.html:4912`, `arcade.html:6255`, `js/enemies/ballooney.js:2`, `js/enemies/blankey.js:2`, `js/enemies/circuit.js:3`, `js/enemies/hermie.js:2`, `js/enemies/jumpy.js:2`, `js/enemies/martian.js:3`, `js/enemies/owl.js:2`, `js/enemies/roach.js:2`, `js/enemies/robot.js:3`, `js/enemies/system.js:2` |
| `HOJA_EVENT_DIALOGUE_PREVIEW` | Maker·Lab 또는 외부 연동 가능 | `arcade.html:2140`, `arcade.html:5060`, `arcade.html:7915`, `arcade.html:7916`, `arcade.html:8120` |
| `HOJA_EVENT_DIALOGUE_STATUS` | 게임 실행·지원 | `arcade.html:8122`, `arcade.html:8718`, `js/keyboard.js:22` |
| `HOJA_EVENT_DIALOGUE_STOP` | Maker·Lab 또는 외부 연동 가능 | `arcade.html:8121` |
| `HOJA_FLOW` | 게임 실행·지원 | `index.html:1841`, `index.html:1844`, `index.html:2401`, `index.html:2430`, `play.html:1841`, `play.html:1844`, `play.html:2401`, `play.html:2430` |
| `HOJA_GAMEPLAY` | 게임 실행·지원 | `index.html:2306`, `index.html:2407`, `index.html:2466`, `js/parent-gameplay.js:2`, `js/parent-services.js:32`, `js/parent-services.js:36`, `js/student.js:73`, `play.html:2306`, `play.html:2407`, `play.html:2466` |
| `HOJA_HELP` | 게임 실행·지원 | `arcade.html:8758`, `js/keyboard.js:18` |
| `HOJA_HELP_PAUSE` | 게임 실행·지원 | `arcade.html:2828`, `arcade.html:8724`, `arcade.html:8730` |
| `HOJA_INTRO_AUDIO` | 게임 실행·지원 | `index.html:1269`, `index.html:1281`, `index.html:1282`, `index.html:1302`, `index.html:1704`, `index.html:1717`, `index.html:1723`, `index.html:1729`, `index.html:2290`, `play.html:1269`, `play.html:1281`, `play.html:1282`, `play.html:1302`, `play.html:1704`, `play.html:1717`, `play.html:1723`, `play.html:1729`, `play.html:2290` |
| `HOJA_INTRO_CLICKS` | 게임 실행·지원 | `index.html:1842`, `index.html:1844`, `index.html:1904`, `play.html:1842`, `play.html:1844`, `play.html:1904` |
| `HOJA_INTRO_EYE_ERROR` | 게임 실행·지원 | `index.html:967`, `play.html:967` |
| `HOJA_INTRO_PENDING_PHASE2` | 게임 실행·지원 | `index.html:1496`, `index.html:1498`, `index.html:1903`, `index.html:1906`, `index.html:1907`, `index.html:1920`, `index.html:2406`, `play.html:1496`, `play.html:1498`, `play.html:1903`, `play.html:1906`, `play.html:1907`, `play.html:1920`, `play.html:2406` |
| `HOJA_INTRO_SHORTCUT_LOGO` | 게임 실행·지원 | `index.html:1782`, `index.html:1902`, `index.html:1906`, `index.html:1907`, `index.html:1917`, `index.html:2405`, `play.html:1782`, `play.html:1902`, `play.html:1906`, `play.html:1907`, `play.html:1917`, `play.html:2405` |
| `HOJA_LOADING` | 게임 실행·지원 | `index.html:1895`, `index.html:2013`, `index.html:2019`, `index.html:2024`, `index.html:2213`, `index.html:2218`, `index.html:2226`, `index.html:2227`, `index.html:2331`, `index.html:2410`, `js/student.js:70`, `play.html:1895`, `play.html:2013`, `play.html:2019`, `play.html:2024`, `play.html:2213`, `play.html:2218`, `play.html:2226`, `play.html:2227`, `play.html:2331`, `play.html:2410` |
| `HOJA_MODE_PREVIEW` | 게임 실행·지원 | `index.html:1977`, `index.html:1983`, `index.html:2022`, `index.html:2180`, `index.html:2213`, `index.html:2239`, `index.html:2412`, `js/parent-gameplay.js:64`, `js/parent-gameplay.js:77`, `play.html:1977`, `play.html:1983`, `play.html:2022`, `play.html:2180`, `play.html:2213`, `play.html:2239`, `play.html:2412` |
| `HOJA_P1C_INPUT` | 게임 실행·지원 | `arcade.html:8287`, `arcade.html:8702`, `arcade.html:8723`, `arcade.html:8729`, `js/keyboard.js:39`, `js/review.js:67` |
| `HOJA_QUIZ_NORMALIZER` | 게임 실행·지원 | `arcade.html:1367`, `arcade.html:8128`, `js/quiz-normalizer.js:85` |
| `HOJA_REPOSITORY` | 게임 실행·지원 | `index.html:1796`, `index.html:1908`, `index.html:2181`, `index.html:2197`, `index.html:2207`, `index.html:2331`, `index.html:2409`, `js/student.js:38`, `play.html:1796`, `play.html:1908`, `play.html:2181`, `play.html:2197`, `play.html:2207`, `play.html:2331`, `play.html:2409` |
| `HOJA_REVIEW` | 게임 실행·지원 | `arcade.html:8286`, `arcade.html:8288`, `arcade.html:8717`, `js/keyboard.js:19`, `js/review.js:90` |
| `HOJA_RUN_RECORD` | 게임 실행·지원 | `arcade.html:8137`, `arcade.html:8288` |
| `HOJA_SEASON_SESSION` | 게임 실행·지원 | `index.html:721`, `index.html:756`, `index.html:1396`, `index.html:2257`, `index.html:2403`, `index.html:2404`, `js/parent-gameplay.js:63`, `play.html:721`, `play.html:756`, `play.html:1396`, `play.html:2257`, `play.html:2403`, `play.html:2404` |
| `HOJA_SINGLE_QR` | 게임 실행·지원 | `index.html:2307`, `js/teacher_qr.js:74`, `play.html:2307` |
| `HOJA_STEP10_RPC` | 게임 실행·지원 | `arcade.html:8351`, `arcade.html:8358`, `arcade.html:8379`, `js/arcade-host.js:7` |
| `HOJA_STUDENT` | 게임 실행·지원 | `js/student.js:95` |
| `HOJA_STUDENT_BACK` | 게임 실행·지원 | `js/parent-gameplay.js:77`, `js/student.js:76` |
| `HOJA_USAGE` | 게임 실행·지원 | `index.html:2576`, `js/parent-gameplay.js:70`, `play.html:2576` |
| `HOJA_V051_FIT_INFO` | 게임 실행·지원 | `index.html:1974`, `index.html:2435`, `index.html:2455`, `play.html:1974`, `play.html:2435`, `play.html:2455` |
| `HOJA_V055_BIND_ARCADE` | 게임 실행·지원 | `index.html:2459`, `index.html:2475`, `js/parent-gameplay.js:70`, `play.html:2459`, `play.html:2475` |
| `HOJA_V055_WATCH_ARCADE` | 게임 실행·지원 | `index.html:2472`, `js/parent-gameplay.js:70`, `play.html:2472` |
| `HOJA_V061_IMPORT` | Maker·Lab 또는 외부 연동 가능 | `arcade.html:2153` |
| `HOJA_V061_STATUS` | Maker·Lab 또는 외부 연동 가능 | `arcade.html:2154` |
| `HOJA_V2_NEXT_STAGE` | Maker·Lab 또는 외부 연동 가능 | `arcade.html:2672`, `arcade.html:8210`, `arcade.html:8211`, `arcade.html:8212` |
