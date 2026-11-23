# Phase 4E — Maker 현황과 개편 설계 (감독 검토 초안)

기준: HOJA `develop` 640e0a7bb207c58fe1938b9a459bd9c13c57b132. 선행 [4D #5](https://github.com/xkdtndbrwk111-prog/SMQ-Project-A/issues/5), 설계 [#7](https://github.com/xkdtndbrwk111-prog/SMQ-Project-A/issues/7). **이 문서는 설계 가안이다. 구현 승인이나 Phase 4D 종료 판정이 아니다.**

## A. 현재 확인된 것과 확인하지 못한 것

**BLOCKED — 독립 Maker 편집기 최신 정본 미확인.** 프로젝트 파일명, 접근 가능한 로컬 작업 공간·Downloads, GitHub 사용자 저장소 및 Drive에서 검색했지만 독립 편집기의 최신 소스와 소유 저장소를 확인하지 못했다. 프로젝트 노션의 Phase 0 기록에도 Maker 편집기 소스가 사용자 제공 필요 자료로 남아 있다. 과거 버전이나 HOJA 게임의 수신 어댑터를 Maker 편집기의 최신 정본이라고 취급하지 않는다. 편집기 시작·저장·불러오기·선택·삭제·실행 취소·미리보기의 실제 구현과 지원 여부는 **NOT RUN/미확인**이다. 사용자가 정본 위치를 제공하면 코드·HEAD·실행을 재확인해야 한다.

**확인된 게임 측 구현:** `web/current/arcade.html`의 2083행 부근은 V0.61 프로젝트의 수신·검증·리소스 로드·게임 Stage 변환을 구현한다. 직접 `HOJA_V061_IMPORT`를 호출하면 첫 맵을 불러오고, Maker 모드의 `HOJA_V2_NEXT_STAGE`와 기본 게임 복귀가 가능하다. `window.opener`가 보낸 `HOJA_V061_LOAD`를 받아 `HOJA_V061_LOADED`를 응답하는 경로가 있으나, 외부 편집기와의 실제 왕복은 **NOT RUN**이다. 이름이 비슷해도 이 코드는 Maker 편집 UI가 아니다.

**FAIL — 반복 전송 후 수정본이 무시됨.** 실제 배포 빌드와 브라우저 popup에서 같은 프로젝트 A를 두 번 보낸 뒤 제목을 B로 변경해 보내면 A가 남는다. `HOJA_MAKER_IMPORTING=true` 설정 이후 동일 내용일 때 그대로 `return`하여 잠금이 해제되지 않는다. 재현: `node verification/phase4e/maker-import-repro.mjs` (먼저 `node tools/build_current.mjs`). 이 재현 스크립트는 현 상태에서 FAIL과 exit 1을 반환한다. 게임 코드를 이번 작업에서 수정하지 않았다. 향후 즉시 플레이 연동의 선행 수정·회귀 대상이며, 중복 재전송 시 확인 응답 유실과 실패 후 재시도도 함께 시험한다.

**재사용 후보:** 게임 Scene의 기믹 `web/current/js/gimmicks/model.js`, `runtime.js`, 기존 이동 발판 `moving-platforms.js`, 물리·충돌, 오디오, Maker 어댑터, Pixel Adventure 원본 스프라이트 및 계절 테마·지형 자동 타일링. `web/current/assets/decoration/catalog.json`과 `LICENSE.txt`는 GrafxKid 장식 CC0-1.0을 명시한다. Pixel Adventure의 배포·라이선스는 별도 출처 원문 확인이 필요하다. 새 에셋을 제작하지 않는다.

## B. 기존 게임 수신 계약 (편집기 자체 스키마로 단정 금지)

- 프로젝트: `format: HOJA_MAKER_PROJECT`, `schemaVersion: 6101`, `title`, `maps` 1~12개. 맵은 고유 `id`(최대 90자), `width` 32~512, `height` 24~256, `terrain` 최대 4,000, `objects` 맵당 최대 1,200 / 전체 최대 4,000. `terrain`·`objects`의 `x,y,w,h`는 타일 좌표이고 `TILE=16`으로 변환하며, 모두 맵 안이어야 한다.
- 지형은 `kind=ground/platform`, 커스텀 `visualAnchor`, `collision`, `opacity`, `secret` 등을 분기한다. `spawn`, 테마와 지형이 게임 Stage로 바뀐다. `objects`는 `moving`, `brick`, `enemy`, `crumble`, `spring`, `gimmick`, `trigger`, `pipe`, `asset` 등을 사용한다. 이동 발판 `patrol.waypoints/mode`, 적 `enemyType/aiMode/speed`, 연결 토관 `targetMapId/targetPortalId`를 읽는다. 기존 게임 어댑터는 water·decor·꽃·동굴을 일반 Stage 배열로 모두 변환하지 않으므로 모든 Maker 데이터가 그대로 실행된다고 보장할 수 없다.
- 맵별 자동 종료 경로·출구 표시는 실행 코드와 외부 Maker 정본에서 추가 확인한다. 현 게임 변환기는 `goal=m.width-3`, `start=spawn.x`를 사용한다. 별도 편집기의 실제 JSON 출구 스키마와 맵 조각 데이터는 미확인이다.
- 기믹은 `objects[].type=gimmick`, 좌표·크기를 타일에서 게임 픽셀로 바꾼 다음 `HOJA_GIMMICK_MODEL.normalize`를 통과한다. 톱날 `axis/distance/speed/radius/embedded`; 진자 `length/amplitude/speed/radius/phase`; 바람 `direction/power/period/on/phase`; 불꽃 `length/wait/warn/active/cool/phase`; 벽돌 `count/activation/interval/direction/steps/path`. 거리·반지름·속도는 모델의 픽셀/초 계약, 시간은 ms, 진폭은 도, 진자 phase는 라디안이다. `path`는 **상대 32px 칸**이고 첫 점 `[0,0]`, 상하좌우 인접, 중복 불가다. 좌표 UI의 16px 타일과 혼동하지 않는다. 실제 범위와 기본값은 `model.js`를 단일 기준으로 삼고 UI에 복제하지 않는 계약 노출이 필요하다.
- `flame.length>1`에서 긴 불꽃을 2초 유지하려면 분출 `active`가 적어도 2,660ms여야 중간 축소까지 표현된다. 짧게 설정하면 주기가 중간에 끝난다. 현행 코드의 정밀 검증 대상이지 임의 자동 변환할 값이 아니다.

## C. 조각 중심 설계 제안

기존 편집기 정본을 확인한 뒤, 편집·저장 로직을 가능한 범위에서 확장하고 화면을 점진적으로 재구성한다. 지금 당장 기존 편집기를 대체한다고 결론내리지 않는다.

1. 교사 화면: 상단 프로젝트/저장/시험, 왼쪽 조각 목록과 지형·장식·몬스터·기믹 분류, 중앙 격자 캔버스, 오른쪽 선택 오브젝트 속성. 고급 속성은 펼치기. 배치·선택·이동·삭제·복제·되돌리기, 확대·이동은 기존 지원 여부 확인 후 재사용/추가한다.
2. 조각 문서는 안정적 `fragmentId`, 버전, 테마, 크기, 로컬 16px 타일 좌표, 접합점(좌우 높이·방향), terrain/objects, 에셋 참조와 변경 이력을 갖도록 제안한다. 조각 사용 인스턴스는 별도 `instanceId`, 조각 ID·원점·좌우 반전·수정 내역을 갖는다. 원본/인스턴스 ID 충돌과 연결 토관 참조를 검증한다. 이는 **미승인 설계**이며 6101 원본에 끼워 넣지 않는다.
3. 컴파일러는 조각 원본의 불변 스냅샷을 명시된 순서로 합성해 **별도의 6101 호환 실행 프로젝트**를 만든다. 경계, 좌표, ID/토관 링크, spawn/goal, 미지원 오브젝트 및 기믹 path 범위를 검사한다. 알 수 없는 필드를 조용히 버리지 않는다. 사용자 선택 없는 자동 정렬·삭제·반전 금지.
4. 기존 랜덤 생성기 `surface-generator.js`는 평지 절단점으로 원본 스테이지를 나누고 첫/끝 고정, 중간 셔플·반전, 적/문항 재배치를 수행한다. 수동 조각 컴파일은 이 생성기를 변경하거나 난수 순서를 공유하지 않는다. 반전 공식(사각형 `W-x-w`, 점 `W-x`), 물·토관·적 순찰 및 `stepping_blocks.path` 방향 변환을 각각 계약·시험한다. 높이 차이는 우선 연결 가능/경고 표시하고 지형 자동 보정은 승인 전 금지한다.

### 기계 판독용 계약 예시 (가안)

아래는 구현된 포맷이 아니라 감독 검토용 예시다. 조각 원본과 맵 내 사용 인스턴스를 분리해 AI가 지정 ID만 바꿀 수 있게 한다. 실제 6101 필드 보존은 정본 확인 뒤 결정한다.

```json
{
  "format": "HOJA_FRAGMENT_DRAFT",
  "schemaVersion": 1,
  "fragmentId": "fragment-demo-01",
  "sizeTiles": {"width": 24, "height": 24},
  "connectors": {"left": {"floorY": 20}, "right": {"floorY": 20}},
  "terrain": [{"id": "floor-01", "kind": "ground", "x": 0, "y": 20, "w": 24, "h": 4}],
  "objects": [{"id": "fan-01", "type": "gimmick", "x": 8, "y": 14, "w": 2, "h": 6,
               "gimmick": {"kind": "fan", "direction": "up", "power": 1000, "period": 4000, "on": 3000}}],
  "extensions": {}
}
```

초안 JSON Schema는 `fragmentId`와 `objects[].id`의 비어 있지 않은 문자열·조각 내 중복 금지, 16px 격자 및 크기 정수, 경계 안 사각형, 알려진 종류별 `model.normalize` 통과, 연결점의 범위와 연결 링크 유효성을 요구한다. ID 중복·토관 연결·기믹 경로의 절대 범위처럼 다른 필드가 필요한 제약은 JSON Schema만으로 끝내지 않고 의미 검증기로 처리한다. 요청에는 `baseRevision` 해시와 `fragmentId`, 정확한 `objectId` 및 변경 필드만 포함하고 결과 diff를 검토한다. 익숙하지 않은 기존 필드는 변경하지 않으며 미지원 값은 오류로 보여 준다.

## D. 게임 실행·데이터 보존 설계

- 저장 전 시험은 편집 상태를 복사한 스냅샷→검증→게임 실행→종료 후 원래 편집 문서 복귀로 한다. 현재 기존 `HOJA_V061_LOAD`/`LOADED`는 성공 통지만 있고 명시적 오류 응답·요청 ID·버전 협상·선택 맵 시작이 없다. 이 계약의 반복 전송 결함을 해결하고, origin/source 검증·요청 ID·성공/실패·버전·timeout을 정의해 실제 Maker에서 시험한 뒤 사용한다. 기존 opener 계약을 일방적으로 폐기하지 않는다. 시험 위치 기록은 교사 전용 분리 빌드에 한정하고 학생 배포에 시험 제어 API를 넣지 않는다.
- 원본 6101 JSON을 읽기 전 그대로 백업한다. 새 형식은 별도 버전·확장자 또는 명시적 envelope로 제안하며 실제 Maker 저장 형식 확인 전 확정하지 않는다. 가져오기→편집 없이 저장→재읽기의 알려진/미지 필드, 이벤트·리소스·토관 링크 보존 시험을 통과해야 한다. 하향 내보내기가 표현할 수 없는 조각/기믹은 경고하고 사용자가 선택하기 전 변경하지 않는다.
- AI 편집은 프로젝트/조각/오브젝트 stable ID와 schemaVersion, 입력/출력 JSON Schema, 원본 해시·변경 대상, JSON Patch 또는 제한된 명령을 제안한다. 변경 전 검증·미리보기·diff·충돌 확인·원자적 저장·복구를 제공하고, 모르는 필드를 보존한다. 현 게임의 validator는 객체 ID 고유성·전체 스키마를 완전히 강제하지 않으므로 설계 단계에서 이미 보장된 것으로 주장하지 않는다.

## E. 단계별 작업과 완료 조건 (실행은 감독 승인 후)

1. **정본 조사 게이트:** 실제 Maker 저장소·브랜치·HEAD와 로컬 상태·파일 목록, 모든 편집/저장 기능 및 샘플 JSON을 직접 확인한다. 정본 부재 시 BLOCKED 유지.
2. **호환성·메시지 게이트:** 기존 JSON round-trip과 미지원 필드 보존, A→A→B 재전송과 오류 응답·재시도, 실제 Maker↔게임의 버전별 왕복을 시험한다. 재현된 가져오기 잠금 결함은 승인된 최소 수정 후 테스트한다.
3. **조각 데이터 게이트:** 조각 ID·경계·반전·연결·기믹·링크 검증과 결정적 컴파일, 원본 불변·손실 없는 내보내기 검증.
4. **교사 UX 게이트:** 조각 만들기/불러오기/배치/속성/저장/복구 및 실행 취소를 실제 Maker의 재사용 가능한 코드에 맞춰 단계 구현한다.
5. **실행 게이트:** 저장 전 시험→편집 복귀→재시험, 공용 Scene/물리/기믹 동등성, 퀴즈·정산·QR·기존 trace, 운영 빌드 시험 훅 부재, 다중 기기 및 실교사 검수. 기존 게임과 외부 Maker 통합 PASS는 따로 보고한다.

## 감독 결정이 필요한 질문

- Maker 정본 확인 전에는 기존 편집기 확장과 UI 재구성 중 최종 선택을 보류한다. 현재 권장안은 **데이터·편집 기능을 최대한 보존하고 UI를 점진 개선**하는 것이다.
- 가장 먼저 해야 할 일은 정본 확보, 수신 중복 잠금 해결과 round-trip 검증이다. 실제 엔진과 `model.js`/`runtime.js`를 공유하고, 편집기의 시각 미리보기는 판정 엔진이 아니다.
- **데이터 손실 없음은 아직 증명되지 않았다.** 알 수 없는 필드, 연결 토관, 조각 반전, 세이브·복구와 기존 JSON의 실제 샘플을 확보해 검증해야 한다.
