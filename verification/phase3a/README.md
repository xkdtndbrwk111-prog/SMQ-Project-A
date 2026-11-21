# Phase 3A 격리 시험 준비

이 디렉터리는 **설계와 시험 준비물**이며 학급 대결 서비스·Firebase 연결·인증·보안 규칙 구현이 아니다. `scenarios.json`의 `expected`는 향후 검증해야 할 기대값이며 통과한 시험 결과가 아니다. 샘플 데이터에는 실제 학생 정보를 넣지 않는다.

현재 확인 가능한 검사는 `node --test verification/phase3a/plan.test.mjs`다. 이 검사는 준비물의 형식, demo 이름, loopback 설정, 기본 전체 거부 문구만 확인한다. 에뮬레이터 연결, 인증, 보안 규칙 평가, 중복·원자성·네트워크 격리를 대신하지 않는다.

`emulator/firebase.json`은 Auth·Firestore를 `127.0.0.1`에만 바인딩하고 UI를 끈다. `emulator/firestore.rules`는 현재 모든 읽기·쓰기를 거부하는 안전한 시작점이다. 아직 Functions·서버나 Firebase 클라이언트를 구현하지 않았다. 이 파일만으로 운영 서비스의 접근을 막을 수는 없다. 추후 SDK·서버 구현에는 demo 프로젝트와 각 에뮬레이터 연결 확인, 미설정·에뮬레이터 부재 시 종료, 비로컬 네트워크 차단 검증이 별도로 필요하다.

감독 검토 및 필요한 도구 설치 후에만 `emulator/`에서 다음과 같이 demo 프로젝트를 **명시**해 실행할 수 있다. 실제 환경변수와 제품별 에뮬레이터 연결도 검증하고, 서비스 계정·운영 키·실제 학생 정보는 사용하지 않는다.

```sh
firebase emulators:start --project demo-hoja-phase3a --only auth,firestore
```

현재 기기에서는 Firebase CLI와 Java 런타임이 확인되지 않아 위 명령과 실제 Rules 시험은 NOT RUN이다. 운영 프로젝트나 클라우드 시험 프로젝트를 선택·생성하지 않았다. 공식 문서: [demo 프로젝트와 연결](https://firebase.google.com/docs/emulator-suite/connect_firestore), [보안 규칙 에뮬레이터 시험](https://firebase.google.com/docs/firestore/security/test-rules-emulator).
