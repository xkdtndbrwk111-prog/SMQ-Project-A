# 2026-11-25 — 단일 그림 + 대화/지문 폭 최적화 (40-6CO 후속 검수 후보)
- 교사 요청: 정사각형 그림 주변의 과도한 가로 여백 제거, 지문/대화에 반환.
- 실제 제공 GAS Game.html에서 추출한 renderer (검수기 내 base SHA256 d9e5547d8b41213ff6737d62dcb4119f36031e2794337330e51bfdc8e8bf2715), 기존 bridge 본문은 그대로 유지. measureAndFit wrapper 및 2종 composition CSS만 추가.
- 대상: dialogue-image / picture-stimulus, 단일 이미지, 표시 너비가 필요 너비보다 큰 경우. 원본 종횡비와 실제 자료 높이/테두리/패딩 기준으로 폭을 줄이고 기존 열 폭을 상한으로 사용. 그림 선택지, D형, 다중 자료, 다른 composition/답안 로직은 변경하지 않음.
- 검수 HTML Chromium 실제 실행(set_content): 207/207 문항 ID 일치, 이미지 207/207, 폭 최적화 적용 16, 지문 scrollHeight 넘침 0, 렌더러 진단 재검토 0, JS 오류 0. 기존 19개 OX/SHORT 배치 힌트 미반영은 이 작업 범위 아님.
- 대표 Q24/Q32 16:9, 16:10, 4:3 시험 통과. 16:9 내부 좌표: Q24 그림 865→479px, 높이 479 유지, 지문 815→1201. Q32 그림 1026→434px, 높이 432 유지, 지문 656→1248, 지문 글자 45.2356→64.68px.
- 검수용 HTML 검증만 완료. 이 브랜치 compose_renderer.mjs에 동일 extension 연결. 전체 운영 번들 재조립, RC SHA 갱신/감사, 실제 게임/GAS 회귀 및 배포는 NOT RUN. main/운영 GAS 무변경.
- 다음 단계: 교사 검수 승인 뒤 기존 RC 빌드/해시 정책을 지켜 재조립 및 실제 운영 전 검증.
