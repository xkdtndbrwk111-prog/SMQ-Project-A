# HOJA QUIZ 2.0 — 2026-10-28 최신 배포 후보

이 폴더는 **최신 버전 하나만** 보관합니다. 이전 R17S 분할본은 최신 UI 수정 `Game.html`로 교체되었습니다.

## 최종 입력 원본
- 최신 `Game.html`: 7,168,687 bytes / SHA-256 `7ebf39499ea3cf607ad0969460ebd0b88f0ec3a77eb9b502fc7187c7779ee230`
- `Code.gs`: 17,794 bytes / SHA-256 `f4f8475c4467c403a190d6be19e450004db971b43bb5f43ae7f31124691c96de`
- `UsageRollupU3S.gs`: 25,470 bytes / SHA-256 `d39f96a5beb6eb4766faa92610de76043bfb9f24441c3a105f01b7016e0042cd`
- `appsscript.json`: 188 bytes / SHA-256 `279bf2a9ff1da8e97db3b3cb5ebb3d0a17a401d68f88656174b2c96cfbf15610`

`python3 versions/2.0.0/restore_game.py`를 실행하면 저장소 루트에 `Game.html`을 복원합니다.

## 이번 버전 변경
- Project B 공개 카탈로그 ID 연결 문제 대응: 프로덕션 `Code.gs`에서 승인된 TEST와 동일한 공개 시트 ID 사용
- 작은 해상도에서 '게임 모드 선택' 제목·버튼·안내문 겹침 방지
- 혼자 놀기 연습 대화창을 왼쪽으로 확장하고 스크롤 제거/텍스트 자동 크기 조정
- 기존 통계 집계 U3S의 서버 상수 의존성 해제, 게임 시작 이용 기록 기능 유지

GitHub 저장은 Apps Script 배포와 별개입니다. 실제 운영 배포 전 /dev 테스트, 랭킹 시트 설정, 데이터/트리거 설정 점검이 필요합니다.
