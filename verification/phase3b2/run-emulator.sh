#!/bin/sh
set -eu
# Local-only demo runner. Supply a JDK via JAVA_HOME and install the locked tools with npm ci.
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
TOOLS="$ROOT/verification/phase3b2/node_modules/.bin/firebase"
[ -x "$TOOLS" ] || { echo 'Firebase CLI missing: run npm ci in verification/phase3b2' >&2; exit 1; }
[ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/java" ] || { echo 'JAVA_HOME with a working JDK is required' >&2; exit 1; }
"$JAVA_HOME/bin/java" -version >/dev/null 2>&1 || { echo 'Java is not usable' >&2; exit 1; }
[ "${GCLOUD_PROJECT:-demo-hoja-phase3a}" = demo-hoja-phase3a ] || { echo 'Only demo-hoja-phase3a is allowed' >&2; exit 1; }
[ "${GOOGLE_CLOUD_PROJECT:-demo-hoja-phase3a}" = demo-hoja-phase3a ] || { echo 'Only demo-hoja-phase3a is allowed' >&2; exit 1; }
[ -z "${GOOGLE_APPLICATION_CREDENTIALS:-}" ] || { echo 'Service-account credentials are forbidden' >&2; exit 1; }
SCRATCH=$(mktemp -d "${TMPDIR:-/tmp}/hoja-emulators.XXXXXX")
mkdir -p "$SCRATCH/config" "$SCRATCH/gcloud" "$SCRATCH/emulators"
cp "$ROOT/verification/phase3a/emulator/firebase.json" "$ROOT/verification/phase3a/emulator/firestore.rules" "$SCRATCH/"
unset FIREBASE_TOKEN FIREBASE_CONFIG CLOUDSDK_AUTH_ACCESS_TOKEN FIRESTORE_EMULATOR_HOST FIREBASE_AUTH_EMULATOR_HOST
export GCLOUD_PROJECT=demo-hoja-phase3a GOOGLE_CLOUD_PROJECT=demo-hoja-phase3a
export XDG_CONFIG_HOME="$SCRATCH/config" CLOUDSDK_CONFIG="$SCRATCH/gcloud"
export FIREBASE_EMULATORS_PATH="${HOJA_EMULATOR_CACHE:-$SCRATCH/emulators}"
export PATH="$JAVA_HOME/bin:$PATH"
cd "$SCRATCH"
# Both targets and the project are explicit; no Firebase login or service account.
export HOJA_PHASE3B2_TEST="$ROOT/verification/phase3b2/emulator.test.mjs"
"$TOOLS" emulators:exec --config "$SCRATCH/firebase.json" --project demo-hoja-phase3a --only auth,firestore 'node --test "$HOJA_PHASE3B2_TEST"'
