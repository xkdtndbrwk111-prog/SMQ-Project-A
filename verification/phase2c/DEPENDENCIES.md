# Phase 2C 의존성 조사 (기준 b2d1147)

## 현재 실행 순서

교사·학생 `index.html`/`play.html`은 대부분 같은 인라인 부모 코드를 갖고, 화면별 `js/teacher_qr.js` 또는 `js/student.js`를 로드한다. 부모의 `HOJA_B_LIVE`가 내장 카트리지 소스와 목록을 제공하고 `HOJA_GAMEPLAY.launch`가 `arcade.html` iframe을 실행한다. 학생은 QR의 `gv`/`cv`를 검사한 후 같은 엔진으로 진입한다. iframe bridge는 부모와 postMessage로 선택한 문항 등을 주고받는다.

아케이드는 Phaser 외부 스크립트와 맵 생성 스크립트 다음에 거대한 즉시 실행 함수(IIFE)를 실행한다. `RUN`, `RUN_STAGES`, `STAGE_INDEX`, `ACTIVE_SCENE`, `EXTERNAL_QUESTIONS`, 퀴즈 덱은 이 클로저의 공유 상태다. Scene 메서드는 이 상태와 DOM, 랭킹·입력·오디오 함수에 직접 결합되어 있으며 초기화 시점과 함수 호이스팅이 중요하다. 이 클로저를 함부로 여러 스크립트로 나누면 이름 가시성과 함수 초기화가 바뀐다.

## 후보 경계와 제약

| 기능 | 실제 의존성 및 순서 | 판단 |
|---|---|---|
| 키보드 입력 | window/document 키·포커스/가시성 이벤트, performance; H/퀴즈/복습/랭킹/대화의 window API 및 DOM 상태 확인. Scene은 내부 keys·DEAD, 도움말/복습은 window 공개 releaseAll/codeOf를 사용 | 독립 classic script에서 입력 객체를 만들고 main IIFE에 명시 전달 가능. 등록 순서 보존, 로드 실패 감지 필요 |
| 카트리지/문항 | 부모 `HOJA_B_LIVE`·학생/교사 경로, iframe bridge, `EXTERNAL_QUESTIONS`, 가족별 무작위 추출 및 `QUIZ_DECK` 공유 | 정규화 함수와 상태/어댑터를 분리해도 문제 순서·랜덤 호출 순서를 보존해야 함 |
| 응답 기록 | `RUN.step09Families`, `RUN.step09History`, performance.now, `EXTERNAL_QUESTIONS`, Scene, HUD와 랭킹 결산 | 상태 소유자와 의존성 주입 계약을 먼저 분리해야 함 |
| 결산/오답 복습 | RUN·Scene 점수/과일/시간 → metrics → HOJA_REVIEW → 랭킹 callback. 복습은 별도 IIFE지만 DOM 이벤트 우선순위와 입력 해제에 결합 | 복습은 독립 경계 후보, 최초 응답 기록/점수 불변 필수 |
| HUD/UI | RUN, Scene, window 입력·help·review·rank, Phaser HUD/DOM 동시 갱신 | 독립 데이터 표현과 Scene 접근 구분 필요 |
| 오디오 | BGM/SFX 전역, Scene 타이머, performance.now, 부모 오디오 bridge | 오디오 해제/효과 순서가 RNG와 연결돼 회귀 필요 |
| 서비스 | 부모 `HOJA_B_LIVE`와 교사 QR/학생 시작, iframe 메시지 | 내장 데이터·오프라인 랭킹 어댑터로 분리 후보, 실제 서비스 연결 금지 |
| 월드/맵·물리·몬스터·기믹 | `RUN_STAGES`, `STAGE`, `THEME`, 물리 그룹, Scene 인스턴스 및 Phaser 함수가 상호 참조 | 앞선 경계 이후 작은 단위로 분석. 변경 감각·좌표·행동 금지 |

## 문제 풀이 모드

아케이드의 `hojaStep09Start_`, `HOJA_STEP09_ENABLED`, STEP09 패널 및 남은 부모 화면에는 이전 실행/개발 UI가 존재하지만 인접한 정규화·기록·랭킹 함수는 현재 아케이드 경로에서도 사용한다. 사용하지 않는 모드를 별도 커밋으로 제거하기 전, DOM ID·호출·bridge를 역추적하고 삭제 후 전체 브라우저 경로와 시험 훅을 재검증한다. 현재 조사만으로 공용 함수를 삭제하지 않는다.

## 현재 범위

자연 4맵/동굴 완주, 실기기 및 전체 플레이 네트워크는 NOT RUN. 기준 trace·원본·legacy 패치는 변경하지 않는다. 확장 예정인 몬스터/Maker/Lab 설계는 현재 클로저를 재작성할 근거가 되지 않는다.

## Phase 2C 작업 후 구조

두 부모 페이지는 `parent-services.js`의 내장 카트리지·오프라인 랭킹과 `parent-gameplay.js`의 iframe 진입을 공유한다. 교사 QR과 학생 진입점은 각 페이지 전용 파일에 남아 있다. iframe의 `arcade-host.js`는 부모 메시지를 받아 엔진 콜백을 호출한다.

아케이드는 동기 classic script 순서로 월드 정의, 메시지, 오디오, 물리, 입력, 퀴즈, 응답 기록 등을 준비하고 main 클로저에서 실제 RUN과 Scene을 주입한다. `world/`는 동굴과 지상 템플릿·테마·시드 생성, `enemies/`는 공통 생성·갱신과 9종 행동 및 에셋 사양을 맡는다. 물리, 스프링, 오디오, HUD, 결산은 Scene 또는 필요한 상태를 받는다. 복습은 별도 DOM과 입력 이벤트를 소유한다. 외부 모듈이 로드되더라도 이벤트 등록이나 Scene 설정이 원래 시점에 이뤄지도록 팩터리를 호출한다.

RUN, 스테이지 전환, Phaser Scene, 일부 충돌 콜백, 발판·뗏목·무너지는 발판, 카메라·진단 코드는 여전히 `arcade.html`에 있다. 추가 분리는 실제 의존성과 놀이 검증을 기준으로 진행해야 한다. 교사·학생 페이지의 큰 공용 UI/리소스도 남아 있다. 기준 게임 trace와 Phase 1 해시는 수정하지 않았다.
