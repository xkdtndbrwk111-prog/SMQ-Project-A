# HOJA QUIZ Phase 2C 인수인계 — 진행 중

## 기준과 구조

감독 승인 기준은 `6c6f7caf948027abfc5a17bba7c9faed82ceac26`이다. 신규 정본은 `web/current/`이며 기존 Phaser와 legacy·versions·Phase 1 빌드 및 패치를 보존한다. 배포 빌드는 `node tools/build_current.mjs`, 시험 빌드는 `HOJA_TEST_PROBE=1 node tools/build_current.mjs`로 생성한다.

```text
교사 index / 학생 play
    ├─ parent-services.js ─ 내장 카트리지·오프라인 랭킹
    └─ parent-gameplay.js ─ iframe 진입
              │ 메시지
arcade.html ─ arcade-host.js
    ├─ keyboard / quiz-normalizer / run-record / review / settlement
    ├─ audio / hud / physics
    ├─ world/ ─ 동굴·지상 템플릿, 테마, 시드 생성
    ├─ enemies/ ─ 공통 시스템과 9종 행동
    └─ springs / moving-platforms / rafts / crumbles
```

Scene은 게임 상태, 충돌 등록, 이벤트 수명 및 프레임 호출 순서를 소유한다. Maker의 가져오기·대화 경로도 현재 엔진에 남아 있다. 상세 의존성은 `verification/phase2c/DEPENDENCIES.md`와 각 기믹 보고서를 참조한다.

## 현재 확인

- PASS — 움직이는 발판·뗏목·무너지는 발판을 개별 커밋으로 분리. 각 16ms 단위 시험, 배포·시험 빌드, 기존 정적 검사와 브라우저 회귀.
- PASS — 모듈 순서·동기 로드와 누락 파일의 빌드 검사. 실제 브라우저에서 게임의 뗏목 모듈과 부모 서비스 로드 실패 시 화면에 오류 표시.
- PASS — 전체 43개 모듈·브라우저 단위 시험, 고정 기준 trace, 유도 FINISH 63점과 중복 정산·복습 기록 불변, 독립 교사·학생 QR와 버전 불일치 거부, HTTP 응답과 Firebase/운영 Apps Script 요청 0건.
- PASS — 지상 숨은 공간 덮개와 물가 전경이 겹칠 때 나타나는 세로 경계선을 수정. 덮개 개폐 시 물가 가림 순서 복구를 시험했다. 자세한 원인·시험은 `verification/phase2c/CAVE_COVER.md`를 참조한다.
- PASS — 원본 재결합 및 Phase 1 기준 해시. 기준 trace 및 기준 해시 파일 변경 없음.
- NOT RUN — 자연 4맵·동굴 왕래와 완주, 실기기, 플레이 전체 시간의 네트워크, Maker·Lab 외부 연동과 각 기믹의 모든 맵·물리 상황.

## 남은 일

`verification/phase2c/DIAGNOSTICS.md`에 전역 참조와 숨은 패널 및 Maker 의존성을 기록했다. 스테이지 강제 이동, 동굴 카메라·렌더 진단 및 벤치마크가 배포 정본에 아직 남아 있어 시험 빌드 전용 경계와 Maker·Lab의 실제 사용 여부를 계속 확인해야 한다. 진단 코드 전수 분류와 제거·보존 작업은 미완료다. Phase 2C 완료 판정을 요청할 상태가 아니며 Phase 2D는 시작하지 않았다.
