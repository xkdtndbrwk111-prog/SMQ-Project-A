# Claude Code 실행 지시서 — HOJA V4 공개 통계 / 40-6-U 정본 rev.2
작성일: 2026-11-23 KST. **이 문서가 과거 Project A/B 분리·관리자 인증·기존 교실매니저 연동 지시보다 우선한다.**
현재 상태: 정책 확정, 단일 GAS 실제 구현 및 실기 시험 NOT RUN, 운영 배포 HOLD.

## 0. 사용자 최종 확정 정책
1. **Project A 한 개의 Google Apps Script** 안에 HOJA 게임의 이용 기록 Writer, V4 일별 집계, 검증된 과거 요약 + 오늘 원본 꼬리 조회, **공개 통계 페이지**를 통합한다. Project B 별도 Apps Script는 구현·배포하지 않는다.
2. **기존 교실매니저는 폐기 예정**이다. 기존 Manager 화면, RPC, Project B의 OWNER/GOOGLE CREATOR 권한 검사에 의존하지 않는다. '폐기'는 기존 앱/데이터를 지금 삭제하라는 명령이 아니다.
3. **통계 조회는 누구든 비로그인·익명 열람**한다. 조회 경로에 관리자 토큰·교사 로그인·OWNER/CREATOR 인증을 추가하지 않는다.
4. **공개는 비식별 집계 읽기만**이다. 개별 이벤트, 원본 시트, 식별 가능한 이름/학교/기기/토큰, 집계 수정/재생성·백업/삭제·관리 기능은 공개하지 않는다. 공개 게임 기록 API는 기존 기능을 보존하되 엄격하게 검증한다.
5. 운영 Project A GAS/원본 EVENT_LOG/랭킹/현재 앱 배포/실제 교실매니저 제거/원본 보관·삭제 트리거는 **별도 교사 승인 전 절대 변경 금지**.

## 1. 필수 확인 및 작업 격리
- GitHub: `xkdtndbrwk111-prog/SMQ-Project-A`; 기준 브랜치 `work/unified-quiz-renderer-20261122`; 최신 HEAD에서 40-6-U **별도 개발 브랜치** 생성. 기존 분기/PR 있다면 먼저 diff 확인.
- 반드시 먼저 읽어라: `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md`의 40-1~40-6G, `docs/HOJA_USAGE_V4_REBUILD_PLAN_20261123.md`, `docs/HOJA_USAGE_V4_REAL_COPY_BACKFILL_20261123.md`, `Code.gs`, `UsageRollupU3S.gs`, `experimental/usage-retention/` 아래 V4 소스/시험.
- 과거 A/B runbook 및 B shadow reader는 과거 실험 기록만 참고. 신규 A에 `getUsageStatisticsU2()`, `requireUsageStatisticsAccessU3_()`, 구형 Manager UI를 이식하지 않는다.
- 기존 2026-09-23~11-22 **61일 COMPLETE** 복사본: 원본 17,672행, 유효 시작 17,670회, 중복 재전송 2건, 실제 0회 4일, V4 버킷 3,969행, 마지막 확정 원본 위치 17,673. 이는 과거 복사본 스냅샷이지 현재 운영 통계가 아니다.
- 이 인증 사본에는 더 쓰지 않는다. 이를 다시 복제한 **40-6 전용 쓰기 시험 사본**의 canary, 일별 COMPLETE/SHA-256, watermark를 재검증한 후 그 사본에만 테스트 이벤트 기록. 운영 ID/학생/학교 정보·토큰을 GitHub/로그에 유출하지 않는다.

## 2. 단일 GAS 기능 계약
**Writer:** 기존 `recordUsageStartU1(payload)` 및 15열 EVENT_LOG, 게임 시작·랭킹 계약을 보존한다. PUBLIC만 유효한 기록이며 mode/team/cartridgeId/eventId/크기를 서버 검증한다. 같은 ID+동일 게임 내용 재전송 신규 행 0, 같은 ID+다른 내용은 거부, 전일 재전송·날짜 역행/과다 호출을 보호한다. 현재 `TextFinder` 원본 전기간 스캔은 시험용으로만 인정하며 운영용 고효율 멱등 색인·충돌 검사·복구 설계를 제출한다.

**Daily:** 기존 V4 CORE를 재사용해 일별 원본 SHA-256, 버킷 SHA-256, 0회 날짜 인증, COMPLETE 연속성, 중복 억제/재실행 멱등을 유지한다. 검증되지 않은 날짜를 0회 COMPLETE로 만들지 말 것. 자동 원본 삭제/보관 트리거를 설치하지 않는다.

**PublicReader:** Project A 내부 `getPublicUsageStatisticsV4()` 등 고정 응답의 **읽기 전용 공개 RPC**를 만든다. 누구나 `today,days7,days30,all,daily,mode,teamCount,grade,subject,publisher,topCartridges` 등 PUBLIC 집계만 조회. 과거 COMPLETE 요약 + 오늘 인증된 꼬리만 읽으며 통계 화면 호출 때마다 EVENT_LOG 전체를 읽지 않는다. 오늘은 `LIVE_PROVISIONAL`, 손상된 요약/누락 COMPLETE/비정렬·지연 이벤트/미완성 행/날짜 경계 오류는 fail-closed. 오류를 '0회'로 위장하지 말 것.

**개인정보·공개 범위:** 원본 eventId/로그 행/개별 timestamp, 학교·학생·교사/기기·IP, 저장소 ID·Script Properties·토큰·관리 API·원본 다운로드를 공개하지 않는다. 카트리지명이나 소수 그룹 통계가 개인/학교를 드러낼 위험을 확인하고 문제가 있으면 공개 대상에서 해당 텍스트를 제외·범주화한다. 응답 필드는 서버 측 allowlist로 고정한다. 익명 사용자의 `google.script.run` 직접 RPC 호출을 공격 관점에서 검사해 쓰기/재집계/삭제를 실행하는 내부 함수나 임의 범위 조회를 노출하지 않는다. 기존 공개 시작 기록 RPC는 예외적으로 검증된 제한적 append만 수행한다.

**같은 GAS 내부 동시성:** Writer·Reader·Daily의 동일 ScriptLock/원자적 commit watermark와 읽기 절단점을 설계. 앞뒤 `getLastRow()` 비교만으로 완전 원자성을 주장하지 말 것. 자정 KST 및 이전 날짜 미집계 상태에서 일관성이 유지되도록 한다. 공개 요청 남용을 막는 범위·빈도 상한과 캐시 설계(잠정값 갱신 지연 표시 포함) 검증.

**PublicDashboard:** 같은 Project A `doGet`에서 게임과 공개 통계 화면을 구분한다. 기존 학생 QR/게임/랭킹/카트리지 접근과의 호환성 유지. 통계는 전용 페이지나 메뉴 진입 시에만 lazy RPC; 게임 홈·인트로 자동 호출 금지. 기간 카드, 일별 추이, SOLO/TEAM, 팀 인원 2~7, 학년·교과·출판사, TOP20을 PC/모바일에서 표현. 기존 교실매니저 UI를 복제하지 않는다.

## 3. Claude Code 실행 단계 및 검수 게이트
- **U0 — 정책·시작점·설계:** 실제 공개 게임과 RPC 노출 경로, 공개 응답 allowlist, 민감값·소규모 셀 노출 방지, Writer/Reader 원자성, 기존 V4 코드 재사용, 별도 작업 브랜치/사본을 설계·기록한다.
- **U1 — Project A 단일 GAS 시험 통합:** V4 Writer/Daily/PublicReader와 기존 게임 호출을 한 격리 GAS에 결합한다. Mock/CI + 격리 사본 SHA/수치·중복·충돌·watermark 테스트. 운영 원본과 기존 인증 사본은 쓰기 금지.
- **U2 — 익명 공개 통계 UI:** 비로그인 새 브라우저에서 화면/읽기 성공. 익명 원본 행·토큰·비밀값 읽기/수정·재집계/삭제 불가. 게임 QR·랭킹·문항·시작 기록 기능 회귀시험.
- **U3 — 실제 GAS·동시성·성능:** 0회 날짜, 해시 손상, 지연 날짜, 오늘 부분 행, 자정 경계, 동일 GAS 동시 append/read, 안전한 중단·복구, 캐시/요청 폭주를 격리 실행 환경에서 검증. 실제 GAS 엔진에 접근하지 못하면 `BLOCKED/NOT RUN`으로 명시.
- **U4 — 독립 검수:** 단계마다 코드+시험+작업 로그를 커밋하고 PR 또는 diff, CI URL, 실 GAS 비식별 증거와 잔여 위험을 GPT-6에 제출한다. Claude의 자기 PASS는 최종 승인 아님.

## 4. PASS 기준
- 이전 61일 인증 사본과 누적 **17,670**, 중복 억제 **2**, 검증 0회 날짜 **4**, 버킷 **3,969**, 각 날짜 SHA 및 COMPLETE 일치. U2의 원본 기준 17,672건과 차이 2건은 재전송 중복으로 별도 설명.
- 집계 그룹/기간별 값의 실제 대조, 익명 집계 조회 PASS와 원본·관리 RPC DENIED, 동일 ID 중복/내용 충돌 신규 기록 0, 날짜/해시/부분 행 fail-closed, 동시 읽기 시 불완전 숫자 표시 0.
- GitHub mock, Google Sheets connector 실제 복사본 검사, **실 Apps Script 엔진**, 익명 브라우저 e2e를 각각 분리 보고한다. 수행하지 않은 것은 절대 PASS 금지.
- 운영 데이터·배포·트리거·원본 보관/삭제·교실매니저 실제 폐기는 **HOLD**.

## 5. GitHub 체크리스트 운영
- Claude 작업 증거: `docs/HOJA_USAGE_V4_40_6_CLAUDE_WORKLOG_20261123.md`의 U0~U4. 과거 A/B 로그는 SUPERSEDED로 보존.
- GPT-6 독립 검수: `docs/HOJA_GAME_DEV_CHECKLIST_20261122.md` 40-6G 이후. Claude는 중앙 검수 PASS를 임의로 기록하거나 운영 배포 승인하지 않는다.
- 매 단계마다 수정 파일, 정확한 커밋 SHA/CI 링크, 시험 종류, 데이터 범위, 실제 실행 로그, PASS/FAIL/NOT RUN, 미해결 문제를 보고. 개인정보·시트 ID/비밀값은 제출 금지.
- 운영/사본 식별 혼선, 익명 민감정보 노출, 무인증 원본 수정, 오류를 0으로 정상 표시, 재전송 데이터 유실, 증거 없는 실 GAS PASS 주장 → 즉시 STOP/HOLD.

**U0부터 착수하라. Project A 한 GAS/기존 교실매니저 의존 없음/익명 통계 열람이라는 확정 정책을 재질문하지 말고 구현을 진행하되, 운영 배포·원본 데이터 조작은 승인 없이 하지 마라.**
