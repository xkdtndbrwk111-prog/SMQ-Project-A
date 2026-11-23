#!/bin/sh
# F3 local: run the three existing trial verifiers on EVERY approved unit's real GAS-shaped sources.
# Usage: run_f3_all_units.sh <python-with-playwright> <trial.html> <dir with src_<id>.json>
PY="$1"; HTML="$2"; DIR="$3"; cd "$(dirname "$0")"
for f in "$DIR"/src_*.json; do
  id=$(basename "$f" .json | sed 's/^src_//')
  solo=$("$PY" verify_trial_chromium.py --html "$HTML" --sources "$f" 2>&1 | grep -E "CHROMIUM_SOLO.*PASS|Error|assert" | head -1 | cut -c1-90)
  team=$("$PY" verify_trial_team_chromium.py --html "$HTML" --sources "$f" 2>&1 | grep -E "TEAM_APPROVED.*PASS|Error|assert" | head -1 | cut -c1-60)
  arc=$("$PY" verify_trial_arcade_chromium.py --html "$HTML" --sources "$f" 2>&1 | grep -c "ARCADE_IFRAME_TRANSPORT_PASS")
  echo "$id | solo: ${solo:-NO_RESULT} | team: ${team:-NO_RESULT} | arcadeTransportPass: $arc"
done
