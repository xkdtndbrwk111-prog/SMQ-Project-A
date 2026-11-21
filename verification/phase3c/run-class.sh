#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
TOOLS="$ROOT/verification/phase3b2/node_modules/.bin/firebase"
[ -x "$TOOLS" ] || { echo '먼저 verification/phase3b2에서 npm ci를 실행하세요.' >&2; exit 1; }
[ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ] || { echo 'JAVA_HOME에 JDK 경로가 필요합니다.' >&2; exit 1; }
[ "${GCLOUD_PROJECT:-demo-hoja-phase3a}" = demo-hoja-phase3a ] && [ "${GOOGLE_CLOUD_PROJECT:-demo-hoja-phase3a}" = demo-hoja-phase3a ] || exit 1
[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] || { echo '운영 인증 정보는 사용할 수 없습니다.' >&2; exit 1; }
if [ "${HOJA_CLASS_BUILD:-production}" = test ]; then HOJA_TEST_PROBE=1 node "$ROOT/tools/build_current.mjs"; else node "$ROOT/tools/build_current.mjs"; fi
SCRATCH=$(mktemp -d "${TMPDIR:-/tmp}/hoja-class.XXXXXX")
mkdir -p "$SCRATCH/config" "$SCRATCH/gcloud" "$SCRATCH/emulators"
cp "$ROOT/verification/phase3a/emulator/firebase.json" "$ROOT/verification/phase3a/emulator/firestore.rules" "$SCRATCH/"
unset FIREBASE_TOKEN FIREBASE_CONFIG CLOUDSDK_AUTH_ACCESS_TOKEN FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST
export GCLOUD_PROJECT=demo-hoja-phase3a GOOGLE_CLOUD_PROJECT=demo-hoja-phase3a
export XDG_CONFIG_HOME="$SCRATCH/config" CLOUDSDK_CONFIG="$SCRATCH/gcloud"
export FIREBASE_EMULATORS_PATH="${HOJA_EMULATOR_CACHE:-$SCRATCH/emulators}"
if [ -z "${HOJA_CLASS_HOST:-}" ]; then
  HOJA_CLASS_HOST=$(node -e "const n=require('node:os').networkInterfaces();for(const k of ['en0',...Object.keys(n).filter(x=>x!=='en0')])for(const a of n[k]||[]){if(a.family==='IPv4'&&!a.internal&&/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(a.address)){console.log(a.address);process.exit()}}console.log('127.0.0.1')")
  export HOJA_CLASS_HOST
fi
export PATH="$JAVA_HOME/bin:$PATH" HOJA_CLASS_SERVER="$ROOT/verification/phase3c/server.mjs"
cd "$SCRATCH"
"$TOOLS" emulators:exec --config "$SCRATCH/firebase.json" --project demo-hoja-phase3a --only auth,firestore 'node "$HOJA_CLASS_SERVER"'
