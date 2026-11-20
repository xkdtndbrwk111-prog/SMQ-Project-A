# 개발 진단과 전역 참조 조사 — 진행 중

기준은 현재 `web/current/` 정본이다. 아래 목록은 HTML과 js에서 `window.HOJA_*`를 텍스트 검색한 모든 정적 위치다. 줄 번호는 이 조사 시점 기준이다. 동적 속성 접근, 압축 문자열, 외부 Maker·Lab 클라이언트는 이 검색만으로 판정할 수 없다. 일반 실행 경로에서 쓰이는 후보도 포함하며 잔여 항목을 검토해야 한다.

## 분류와 확인된 의존성

| 분류 | 정의와 호출 | 상태 |
| --- | --- | --- |
| 게임 실행 필요 | 입력·문항·응답·복습·결산·HUD·오디오 팩터리, 부모 서비스/게임 진입, QR·학생 화면, Phaser Scene 호출 | 유지. 각 모듈 파일과 arcade.html의 해당 window 참조에 정의·호출 위치가 있다 |
| Maker·Lab 경로 | `HOJA_V061_IMPORT`, `HOJA_V061_STATUS`, `HOJA_EVENT_DIALOGUE_PREVIEW` | 유지. Maker 가져오기와 메시지 리스너, Maker 대화 이벤트가 참조한다. 외부 Maker·Lab의 실제 호출 범위는 추가 확인 필요 |
| 시험판 진단 후보 | `HOJA_V2_NEXT_STAGE`, `HOJA_V2_TOGGLE_CAVE_VISIBILITY`, `HOJA_V053_BENCH`, `HOJA_V054_RENDER_AB`, `HOJA_V054_LAST_RESULT`, `HOJA_V056_BENCH_LOG`, `HOJA_R39_RATIO_LOCK` | 배포 정본에 남아 있다. 버튼·패널 및 Scene 결합과 Maker 사용 가능성을 확인해 시험 빌드 분리가 필요하다 |
| 혼합 또는 추가 확인 | `HOJA_STEP134_DIAG`, `HOJA_STEP135_DIAG`, `HOJA_STEP136_DIAG`, `HOJA_V046_PREFERRED_VISION`, `HOJA_V047_FOV_SOFT`, `HOJA_V2_SYNC_CAVE_VISIBILITY` | Scene의 카메라·동굴 가시성 갱신이 참조한다. 기본 렌더 경로를 유지하며 진단 제어를 분리해야 한다 |
| 사용하지 않는 코드 | `HOJA_V064_PERF_READ/RESET/ACTION`, `HOJA_V049_QA`, `HOJA_V050_QA`, `HOJA_STEP12_3_QUIZ_LAYOUT` | 현재 정본 호출을 확인하고 별도 커밋에서 제거했다. 테스트 전용 조작 API는 앞선 단계에서 제거했다 |

숨은 화면은 arcade.html의 `cleanLabControls`, `internalControls`, `stageBtns`, `hojaDebugLayer`, `hojaStep131FpsPanel` 및 `hojaV053Panel`에 남아 있다. 일부는 Scene 생성 시 버튼 핸들러를 직접 설치하고 충돌·랭킹 적격성·카메라를 참조한다. 단축키 차단 목록은 학생 진입 시 동작한다. 진단 패널을 숨기는 CSS만으로 배포판의 진단 제거가 완료되었다고 판단하지 않는다.

localhost 분기는 `js/teacher_qr.js`의 QR 주소가 루프백이면 다른 기기에서 열 수 없다는 안내를 표시한다. 이는 QR 사용 안내로 보존한다. 위치·스테이지 강제 이동의 `HOJA_V2_NEXT_STAGE`와 테스트 빌드 전용 `HOJA_TEST_PROBE`는 별개이며 전자는 아직 정리 대상이다.

## 전역 식별자와 현재 참조 위치

| 식별자 | 분류 | 참조 위치 |
| --- | --- | --- |
| `HOJA_ARCADE_EYE_ERROR` | 일반 경로·추가 확인 | `arcade.html:2813` |
| `HOJA_ARCADE_QUERY` | 혼합·추가 확인 | `js/parent-gameplay.js:70` |
| `HOJA_ARCADE_SEASON` | 일반 경로·추가 확인 | `arcade.html:959`, `arcade.html:9837` |
| `HOJA_ATTRACT_CONTROL` | 일반 경로·추가 확인 | `index.html:1841`, `index.html:2182`, `index.html:2232`, `play.html:1841`, `play.html:2182`, `play.html:2232` |
| `HOJA_ATTRACT_GAME` | 일반 경로·추가 확인 | `index.html:1830`, `play.html:1830` |
| `HOJA_ATTRACT_SCENE` | 일반 경로·추가 확인 | `index.html:1502`, `index.html:1843`, `index.html:1846`, `index.html:1848`, `index.html:1908`, `index.html:1909`, `index.html:1919`, `index.html:2215`, `play.html:1502`, `play.html:1843`, `play.html:1846`, `play.html:1848`, `play.html:1908`, `play.html:1909`, `play.html:1919`, `play.html:2215`, `js/student.js:68` |
| `HOJA_AUDIO_CONTROL` | 일반 경로·추가 확인 | `index.html:1234`, `index.html:1345`, `index.html:1916`, `index.html:2291`, `index.html:2404`, `index.html:2462`, `play.html:1234`, `play.html:1345`, `play.html:1916`, `play.html:2291`, `play.html:2404`, `play.html:2462`, `js/parent-gameplay.js:68`, `js/parent-gameplay.js:70`, `js/parent-gameplay.js:77`, `js/student.js:67` |
| `HOJA_BUILD` | 일반 경로·추가 확인 | `index.html:590`, `play.html:590`, `js/student.js:48`, `js/teacher_qr.js:49` |
| `HOJA_B_LIVE` | 게임 실행 | `index.html:2016`, `index.html:2019`, `index.html:2026`, `index.html:2221`, `index.html:2226`, `index.html:2229`, `play.html:2016`, `play.html:2019`, `play.html:2026`, `play.html:2221`, `play.html:2226`, `play.html:2229`, `js/parent-gameplay.js:62`, `js/parent-gameplay.js:67`, `js/parent-services.js:3`, `js/student.js:53`, `js/student.js:59`, `js/student.js:60`, `js/student.js:61`, `js/student.js:71`, `js/teacher_qr.js:38` |
| `HOJA_CATALOG` | 일반 경로·추가 확인 | `index.html:1886`, `index.html:2201`, `index.html:2214`, `index.html:2227`, `index.html:2290`, `index.html:2412`, `index.html:2420`, `play.html:1886`, `play.html:2201`, `play.html:2214`, `play.html:2227`, `play.html:2290`, `play.html:2412`, `play.html:2420` |
| `HOJA_CONNECT_ARCADE_HOST` | 게임 실행 | `arcade.html:1381`, `arcade.html:9816`, `js/arcade-host.js:2` |
| `HOJA_CREATE_AUDIO` | 게임 실행 | `arcade.html:1382`, `arcade.html:1932`, `js/audio.js:2` |
| `HOJA_CREATE_CRUMBLES` | 게임 실행 | `arcade.html:1385`, `arcade.html:9815`, `js/crumbles.js:2` |
| `HOJA_CREATE_HUD` | 게임 실행 | `arcade.html:1386`, `arcade.html:1807`, `js/hud.js:2` |
| `HOJA_CREATE_INPUT` | 게임 실행 | `arcade.html:1386`, `arcade.html:3232`, `js/keyboard.js:2` |
| `HOJA_CREATE_MOVING_PLATFORMS` | 게임 실행 | `arcade.html:1384`, `arcade.html:9813`, `js/moving-platforms.js:2` |
| `HOJA_CREATE_PHYSICS` | 게임 실행 | `arcade.html:1382`, `arcade.html:1880`, `js/physics.js:2` |
| `HOJA_CREATE_RAFTS` | 게임 실행 | `arcade.html:1385`, `arcade.html:9814`, `js/rafts.js:2` |
| `HOJA_CREATE_RECORD` | 게임 실행 | `arcade.html:1387`, `arcade.html:9106`, `js/run-record.js:2` |
| `HOJA_CREATE_SETTLEMENT` | 게임 실행 | `arcade.html:1387`, `arcade.html:9108`, `js/settlement.js:2` |
| `HOJA_CREATE_SPRING_SYSTEM` | 게임 실행 | `arcade.html:1383`, `arcade.html:1937`, `js/springs.js:2` |
| `HOJA_CREATE_SURFACE_GENERATOR` | 게임 실행 | `arcade.html:1380`, `arcade.html:2048`, `js/world/surface-generator.js:3` |
| `HOJA_CREATE_SURFACE_TEMPLATES` | 게임 실행 | `arcade.html:1379`, `arcade.html:2046`, `js/world/surface-templates.js:2` |
| `HOJA_CREATE_THEMES` | 게임 실행 | `arcade.html:1378`, `arcade.html:1964`, `js/world/themes.js:2` |
| `HOJA_ENEMIES` | 게임 실행 | `arcade.html:1394`, `arcade.html:2604`, `arcade.html:3581`, `arcade.html:5557`, `arcade.html:7112`, `js/enemies/ballooney.js:2`, `js/enemies/blankey.js:2`, `js/enemies/circuit.js:3`, `js/enemies/hermie.js:2`, `js/enemies/jumpy.js:2`, `js/enemies/martian.js:3`, `js/enemies/owl.js:2`, `js/enemies/roach.js:2`, `js/enemies/robot.js:3`, `js/enemies/system.js:2` |
| `HOJA_EVENT_DIALOGUE_PREVIEW` | Maker·Lab | `arcade.html:2520`, `arcade.html:5705`, `arcade.html:8861`, `arcade.html:8862`, `arcade.html:9090` |
| `HOJA_EVENT_DIALOGUE_STATUS` | 일반 경로·추가 확인 | `arcade.html:9092`, `arcade.html:9910`, `js/keyboard.js:22` |
| `HOJA_EVENT_DIALOGUE_STOP` | Maker·Lab | `arcade.html:9091` |
| `HOJA_FLOW` | 일반 경로·추가 확인 | `index.html:1842`, `index.html:1845`, `index.html:2402`, `index.html:2431`, `play.html:1842`, `play.html:1845`, `play.html:2402`, `play.html:2431` |
| `HOJA_GAMEPLAY` | 게임 실행 | `index.html:2307`, `index.html:2408`, `index.html:2467`, `play.html:2307`, `play.html:2408`, `play.html:2467`, `js/parent-gameplay.js:2`, `js/parent-services.js:32`, `js/parent-services.js:36`, `js/student.js:73` |
| `HOJA_HELP` | 일반 경로·추가 확인 | `arcade.html:9950`, `js/keyboard.js:18` |
| `HOJA_HELP_PAUSE` | 일반 경로·추가 확인 | `arcade.html:3233`, `arcade.html:9916`, `arcade.html:9922` |
| `HOJA_INTRO_AUDIO` | 일반 경로·추가 확인 | `index.html:1269`, `index.html:1281`, `index.html:1282`, `index.html:1303`, `index.html:1705`, `index.html:1718`, `index.html:1724`, `index.html:1730`, `index.html:2291`, `play.html:1269`, `play.html:1281`, `play.html:1282`, `play.html:1303`, `play.html:1705`, `play.html:1718`, `play.html:1724`, `play.html:1730`, `play.html:2291` |
| `HOJA_INTRO_CLICKS` | 일반 경로·추가 확인 | `index.html:1843`, `index.html:1845`, `index.html:1905`, `play.html:1843`, `play.html:1845`, `play.html:1905` |
| `HOJA_INTRO_EYE_ERROR` | 일반 경로·추가 확인 | `index.html:967`, `play.html:967` |
| `HOJA_INTRO_PENDING_PHASE2` | 일반 경로·추가 확인 | `index.html:1497`, `index.html:1499`, `index.html:1904`, `index.html:1907`, `index.html:1908`, `index.html:1921`, `index.html:2407`, `play.html:1497`, `play.html:1499`, `play.html:1904`, `play.html:1907`, `play.html:1908`, `play.html:1921`, `play.html:2407` |
| `HOJA_INTRO_SHORTCUT_LOGO` | 일반 경로·추가 확인 | `index.html:1783`, `index.html:1903`, `index.html:1907`, `index.html:1908`, `index.html:1918`, `index.html:2406`, `play.html:1783`, `play.html:1903`, `play.html:1907`, `play.html:1908`, `play.html:1918`, `play.html:2406` |
| `HOJA_LOADING` | 일반 경로·추가 확인 | `index.html:1896`, `index.html:2014`, `index.html:2020`, `index.html:2025`, `index.html:2214`, `index.html:2219`, `index.html:2227`, `index.html:2228`, `index.html:2332`, `index.html:2411`, `play.html:1896`, `play.html:2014`, `play.html:2020`, `play.html:2025`, `play.html:2214`, `play.html:2219`, `play.html:2227`, `play.html:2228`, `play.html:2332`, `play.html:2411`, `js/student.js:70` |
| `HOJA_MODE_PREVIEW` | 일반 경로·추가 확인 | `index.html:1978`, `index.html:1984`, `index.html:2023`, `index.html:2181`, `index.html:2214`, `index.html:2240`, `index.html:2413`, `play.html:1978`, `play.html:1984`, `play.html:2023`, `play.html:2181`, `play.html:2214`, `play.html:2240`, `play.html:2413`, `js/parent-gameplay.js:64`, `js/parent-gameplay.js:77` |
| `HOJA_P1C_INPUT` | 게임 실행 | `arcade.html:9260`, `arcade.html:9894`, `arcade.html:9915`, `arcade.html:9921`, `js/keyboard.js:39`, `js/review.js:67` |
| `HOJA_QUIZ_NORMALIZER` | 게임 실행 | `arcade.html:1388`, `arcade.html:9098`, `js/quiz-normalizer.js:85` |
| `HOJA_R39_RATIO_LOCK` | 시험 진단 후보 | `arcade.html:1429` |
| `HOJA_REPOSITORY` | 일반 경로·추가 확인 | `index.html:1797`, `index.html:1909`, `index.html:2182`, `index.html:2198`, `index.html:2208`, `index.html:2332`, `index.html:2410`, `play.html:1797`, `play.html:1909`, `play.html:2182`, `play.html:2198`, `play.html:2208`, `play.html:2332`, `play.html:2410`, `js/student.js:38` |
| `HOJA_REVIEW` | 게임 실행 | `arcade.html:9259`, `arcade.html:9261`, `arcade.html:9909`, `js/keyboard.js:19`, `js/review.js:90` |
| `HOJA_RUN_RECORD` | 게임 실행 | `arcade.html:9107`, `arcade.html:9261` |
| `HOJA_SEASON_SESSION` | 일반 경로·추가 확인 | `index.html:721`, `index.html:756`, `index.html:1397`, `index.html:2258`, `index.html:2404`, `index.html:2405`, `play.html:721`, `play.html:756`, `play.html:1397`, `play.html:2258`, `play.html:2404`, `play.html:2405`, `js/parent-gameplay.js:63` |
| `HOJA_SINGLE_QR` | 일반 경로·추가 확인 | `index.html:2308`, `play.html:2308`, `js/teacher_qr.js:74` |
| `HOJA_STEP10_RPC` | 일반 경로·추가 확인 | `arcade.html:9324`, `arcade.html:9331`, `arcade.html:9352`, `js/arcade-host.js:7` |
| `HOJA_STEP134_DIAG` | 혼합·추가 확인 | `arcade.html:3314`, `arcade.html:9673` |
| `HOJA_STEP135_DIAG` | 혼합·추가 확인 | `arcade.html:9751` |
| `HOJA_STEP136_DIAG` | 혼합·추가 확인 | `arcade.html:9811` |
| `HOJA_STUDENT` | 일반 경로·추가 확인 | `js/student.js:95` |
| `HOJA_STUDENT_BACK` | 일반 경로·추가 확인 | `js/parent-gameplay.js:77`, `js/student.js:76` |
| `HOJA_TUTORIAL_AUDIO_BRIDGE` | 혼합·추가 확인 | `index.html:1284`, `play.html:1284` |
| `HOJA_USAGE` | 일반 경로·추가 확인 | `index.html:2577`, `play.html:2577`, `js/parent-gameplay.js:70` |
| `HOJA_V046_PREFERRED_VISION` | 혼합·추가 확인 | `arcade.html:3304` |
| `HOJA_V047_FOV_SOFT` | 혼합·추가 확인 | `arcade.html:3306` |
| `HOJA_V051_FIT_INFO` | 일반 경로·추가 확인 | `index.html:1975`, `index.html:2436`, `index.html:2456`, `play.html:1975`, `play.html:2436`, `play.html:2456` |
| `HOJA_V053_BENCH` | 시험 진단 후보 | `arcade.html:1568` |
| `HOJA_V054_LAST_RESULT` | 시험 진단 후보 | `arcade.html:1799` |
| `HOJA_V054_RENDER_AB` | 시험 진단 후보 | `arcade.html:1804` |
| `HOJA_V055_BIND_ARCADE` | 일반 경로·추가 확인 | `index.html:2460`, `index.html:2476`, `play.html:2460`, `play.html:2476`, `js/parent-gameplay.js:70` |
| `HOJA_V055_WATCH_ARCADE` | 일반 경로·추가 확인 | `index.html:2473`, `play.html:2473`, `js/parent-gameplay.js:70` |
| `HOJA_V056_BENCH_LOG` | 시험 진단 후보 | `arcade.html:1654` |
| `HOJA_V061_IMPORT` | Maker·Lab | `arcade.html:2533` |
| `HOJA_V061_STATUS` | Maker·Lab | `arcade.html:2534` |
| `HOJA_V2_NEXT_STAGE` | 시험 진단 후보 | `arcade.html:1148`, `arcade.html:3058`, `arcade.html:9183`, `arcade.html:9184`, `arcade.html:9185` |
| `HOJA_V2_SYNC_CAVE_VISIBILITY` | 혼합·추가 확인 | `arcade.html:3049`, `arcade.html:3070`, `arcade.html:3072`, `arcade.html:3481` |
| `HOJA_V2_TOGGLE_CAVE_VISIBILITY` | 시험 진단 후보 | `arcade.html:1148`, `arcade.html:3063` |
