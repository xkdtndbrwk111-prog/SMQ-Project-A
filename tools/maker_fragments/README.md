# HOJA Maker 조각 v1 제작 안내

기존 6101 프로젝트의 `map` 객체를 그대로 담는 별도 포장이다. 실행 결과는 현재 게임이 받는 `HOJA_MAKER_PROJECT` 6101이며 원본은 변경하지 않는다. 스키마: `fragment.schema.json`; 실제 좌표·ID·참조·접합 의미 검증은 `fragment-system.js`가 수행한다. 알 수 없는 데이터는 원본과 출력의 `fragmentSources.fragments`에 보존한다.

- `format`: `HOJA_MAKER_FRAGMENT`; `schemaVersion`: 1. 알 수 없는 주 버전은 거부한다. 변경 가능한 확장은 새 필드로 추가한다.
- `id`, `map.id`: 영문·숫자·`_`·`-` 1~48자. `name`, `description`, `difficulty`(easy/medium/hard), `dependencies`(에셋·시스템 설명)로 용도를 기록한다. 필요한 에셋의 실제 Maker 경로는 오브젝트의 기존 `assetPath`에 둔다.
- `map`은 기존 `theme`, `width`, `height`, `spawn`, `terrain`, `objects`, `events`를 사용한다. 조각 좌표는 왼쪽 위 `(0,0)` 기준 16px 타일이며 기믹의 속도·길이 등은 기존 엔진의 픽셀·초·ms 계약을 따른다. `patrol.waypoints`는 조각 좌표다. `stepping_blocks.path`는 기존 32px 상대 경로로 유지한다.
- `connectors.entry`와 `exit`는 `{ "kind":"ground", "y":22 }` 형태로 왼쪽·오른쪽 경계의 지면 상단 높이(타일)를 뜻한다. 실제 ground와 일치해야 하며 이웃 접점의 높이가 다르면 오류다. 조각을 강제로 옮기거나 지형을 수정하지 않는다. 서로 다른 테마는 한 맵에 섞지 않는다.
- `terrain`, `objects`, `events`의 ID는 조각 내부에서 고유해야 한다. `targetMapId`/`targetPortalId`는 조각의 `map.id`와 오브젝트 ID를 참조한다. 동일 조각의 링크는 동일 인스턴스 내에서 연결한다. 다른 조각에 대한 참조는 해당 `map.id`가 조합에서 유일해야 한다. `eventId`, `triggerId`, `objectId`는 동일 조각 내 ID다. 모르는 참조 필드는 자동 추측하지 않으며 원본에 보존한다.
- `pipeMode:solid`에 목표가 남아 있으면 오류로 알려주며 자동 변경하지 않는다. 구형 `type:saw`와 `type:gimmick, kind:saw`는 각각 그대로 보존한다. 기믹은 공유 `HOJA_GIMMICK_MODEL.normalize`로 검사한다.
- 동일한 순서와 seed는 동일한 결과를 만들며 난수 호출을 하지 않는다. 버전 1은 수동 순서 조합만 지원한다. 반전·자동 배치·높이 자동 보정 및 임의 필드의 좌표 변환은 지원하지 않는다.

```sh
node tools/maker_fragments/cli.mjs validate verification/phase4e/fragments/practice-1.json
node tools/maker_fragments/cli.mjs compile verification/phase4e/fragments/practice-{1,2,3}.json > /tmp/hoja-fragment-project.json
```

`verification/phase4e/fragments/practice-{1,2,3}.json`은 기존 Phase 4D 코스에서 잘라낸 지형·기믹에 시작 문과 집을 추가한 시험용 데이터다. 잘못된 예는 `invalid-height.json`: 접합점에 실제 지면이 없어 검증 실패해야 한다. 시범 코스의 완주 가능성이나 교사 수동 검수는 별도로 평가한다.
