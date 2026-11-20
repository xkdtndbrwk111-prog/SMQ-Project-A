# 월드 및 맵 조각

변경 전 동굴의 두 스크립트, 지상 테마·템플릿 및 랜덤 조각 생성 함수가 arcade.html에 있었다. 변경 후 js/world/cave-layout.js → cave-variation.js 순으로 연결한다. themes.js와 surface-templates.js는 테마, 지형 및 배치 자료를 만든다. surface-generator.js는 템플릿을 자르고 연결하고 검증하며, 원래 위치에서 초기화된다. 동일한 STAGES 배열에 나중에 동굴이 추가된다. Scene의 적용 및 전환 순서는 기존 위치에 있다.

모듈 시험은 b2d1147에서 계산한 시드 0, 41805, 4294967295의 실제 4개 지상 맵 전체 객체 및 생성된 동굴 내보내기 결과의 SHA-256을 대조한다. 3/3 PASS. 배포·시험 빌드, 정적 검사 27개, 원본 무결성 및 Phase 1 기준판 검사 PASS. 자연 완주 NOT RUN.
