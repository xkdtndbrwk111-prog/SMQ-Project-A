# 사회6 승인 문항 내장 Apps Script **시험용** 소스

교사 승인 렌더러(blob `5a1623b8e7a6d778e0e64aaef06330a136b4d333`)의 JSON으로 생성. 사회 6학년 2개 단원 / 64문항 / WebP 15개 / 교사 지정 C형 좌우 11개를 보존한다.

- `Code.TEST.gs`는 원본 `Code.gs` **복사·수정본**이다. 공개 Sheet 조회를 내장 조회로 대체하고, `hojaRankSave()`를 거부하며 `hojaRankList()`는 빈 목록을 반환한다. `recordUsageStartU1()`도 **무기록**으로 변경했다. 기존 운영 Code.gs 파일을 덮지 않는다.
- `HOJA_QB_EMBEDDED_API.gs`는 공통 요청 검증 및 조회만 수행. `HOJA_QB_CATALOG.gs`는 승인 단원 추가 시 자동 생성/교체할 대상. `HOJA_QB_UNIT_*.gs`는 단원별 문항·시각자료가 포함된 독립 생성 소스다.
- GAS 시험 프로젝트 생성/반영 **미실시**. 사용할 때 기존 `Code.gs`/UsageRollupU3S.gs와 **함께 넣지 않는다**. 시험 프로젝트의 `Code.gs` 자리에 이 `Code.TEST.gs`를 복사하고, 같은 시험 프로젝트에 단원 및 카탈로그/API GS를 등록해야 한다. `Game.html`도 브랜치 실험판을 별도 준비해야 한다.
- GitHub 커밋은 GAS 실행/배포가 아니다. 정확한 7MB 브랜치 재조립, 클라이언트 전체 점검, 실제 GAS `hojaEmbeddedSelfTest_()` 검사 및 운영 스프레드시트 접근 금지 시험은 미완료다.
