# 동굴 시야 전환 진단

`HOJA_V2_TOGGLE_CAVE_VISIBILITY`와 숨은 `hojaV2CaveVisibilityBtn`은 현재 정본에서 서로만 연결된 진단 제어다. `HOJA_V2_SYNC_CAVE_VISIBILITY`는 그 버튼의 표시와 라벨만 갱신했고 Scene 및 스테이지 전환에서 호출됐다. 정상 동굴 시야·조명 렌더는 Scene의 자체 상태와 갱신 함수를 사용한다.

배포 정본에서 이 전역 진단과 버튼 동기화, 숨은 버튼을 제거하고 시험 빌드의 `current-test-probe.mjs`에서 동굴 시야 전환과 시험 버튼을 주입한다. 동굴 맵을 시험 훅으로 열어 전환 전후 상태가 바뀌는지 확인한다. 배포 정적 검사는 이 두 과거 전역이 없는지 확인한다.

Maker 가져오기·대화·Scene 렌더와 다른 진단은 건드리지 않았다. 외부 Maker·Lab과의 통합 동작은 NOT RUN이며 실제 호출 계약 확인이 필요하다.
