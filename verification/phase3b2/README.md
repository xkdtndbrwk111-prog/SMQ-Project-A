# Phase 3B-2 로컬 에뮬레이터 시험

이 코드는 게임에 연결되지 않은 **로컬 전용 신뢰 서비스 시제품**이다. HTTP 서버·교사/학생 화면·실제 Firebase 배포 설정이 아니며, 운영용 인증·출시 준비가 되지 않았다. `demo-hoja-phase3a` Auth·Firestore 에뮬레이터와 가짜 계정 외에 사용하지 않는다. 기존 `verification/phase3a/emulator/firestore.rules`의 전체 거부를 변경하지 않는다.

## 설치와 실행

Node.js와 JDK를 준비하고 이 디렉터리에서 `npm ci`로 lockfile의 의존성을 설치한다. `JAVA_HOME`은 별도 JDK를 가리키게 한다. Firebase 계정 로그인·서비스 계정·실제 학생 정보는 사용하지 않는다.

```sh
cd verification/phase3b2
npm ci
cd ../..
JAVA_HOME=/path/to/jdk verification/phase3b2/run-emulator.sh
```

CLI가 필요한 에뮬레이터 파일을 처음 다운로드할 수 있다. 오프라인 캐시가 있다면 `HOJA_EMULATOR_CACHE`로 지정할 수 있다. 스크립트는 별도 임시 설정 디렉터리에서 `demo-hoja-phase3a`, `--only auth,firestore`, loopback 설정과 deny-all Rules를 명시한다. 잘못된 프로젝트·서비스 계정 경로·Java/CLI 부재는 시작 전에 실패한다. 서비스는 초기화 전과 모든 요청 전 데모 프로젝트, 두 loopback 주소, 에뮬레이터 허브와 각 서비스의 로컬 응답을 확인한다. **이 검사는 프로세스 전체의 범용 방화벽이 아니며, 임의 코드의 외부 네트워크를 OS 차원에서 차단했다고 증명하지 않는다.** 실제 배포 전 별도의 네트워크 경계가 필요하다.

에뮬레이터가 중지된 상태에서 실패를 확인하려면 아래처럼 테스트 환경값만 지정한다. 실제 자격증명은 설정하지 않는다.

```sh
GCLOUD_PROJECT=demo-hoja-phase3a GOOGLE_CLOUD_PROJECT=demo-hoja-phase3a \
FIRESTORE_EMULATOR_HOST=127.0.0.1:18080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:19099 \
node --test verification/phase3b2/offline.test.mjs
```

`emulator.test.mjs`는 Auth 에뮬레이터에 `example.test` 가짜 계정을 만들고, 테스트 전용 Admin SDK로 가짜 교사 권한을 부여한다. 실제 Firestore 에뮬레이터 Rules에 대한 직접 읽기/쓰기 거부와, Rules를 우회하는 Admin SDK를 쓰는 서비스 자체의 토큰 검증·인가를 별도로 시험한다. 실제 서비스의 토큰 서명·교사 자격 발급 정책은 검증한 것이 아니다. 트랜잭션 경합은 실제 동시 실행하며 SDK 재시도 한도 초과 시 안전한 재시도 오류를 낸다. 재시도 기능의 별도 시험은 `ABORTED` 오류를 **주입**한다.

`single-network.test.mjs`는 **시험 빌드**에서 학생 진입, 유도된 문제 응답과 TIME UP 결산까지 요청을 기록한다. 자연 플레이나 배포 빌드 전체 경로의 네트워크 증거로 확대하지 않는다.
