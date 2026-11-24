#!/usr/bin/env python3
"""F3 gate: run the three trial verifiers on EVERY approved unit and FAIL CLOSED.

Replaces the fail-open run_f3_all_units.sh (40-6S). Exit code is nonzero unless ALL hold:
  * the number of src_<id>.json files equals --expect-units (default 23),
  * for every unit the solo verifier exits 0 AND prints CHROMIUM_SOLO_..._PASS,
  * the team verifier exits 0 AND prints CHROMIUM_TEAM_APPROVED_FIRST_BALLOON_PASS,
  * the arcade verifier exits 0 AND prints ARCADE_IFRAME_TRANSPORT_PASS exactly 2 times.
Every unit/mode result is printed and also written as JSON (--json).
Usage: run_f3_all_units.py --python <py-with-playwright> --html <trial.html> --sources-dir <dir> [--expect-units 23]
"""
import argparse, json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CHECKS = [
    ('solo', 'verify_trial_chromium.py', lambda out: 'CHROMIUM_SOLO_MCQ_OX_SHORTCUT_VERDICT_AUDIO_GATE_PASS' in out),
    ('team', 'verify_trial_team_chromium.py', lambda out: 'CHROMIUM_TEAM_APPROVED_FIRST_BALLOON_PASS' in out),
    ('arcade', 'verify_trial_arcade_chromium.py', lambda out: out.count('ARCADE_IFRAME_TRANSPORT_PASS') == 2),
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--python', required=True); ap.add_argument('--html', required=True, type=Path)
    ap.add_argument('--sources-dir', required=True, type=Path); ap.add_argument('--expect-units', type=int, default=23)
    ap.add_argument('--json', type=Path); ap.add_argument('--timeout', type=int, default=600)
    a = ap.parse_args()
    if not a.html.is_file(): sys.exit('TRIAL_HTML_MISSING')
    files = sorted(a.sources_dir.glob('src_*.json'))
    results, failed = [], []
    if len(files) != a.expect_units:
        failed.append(f'UNIT_COUNT {len(files)} != {a.expect_units}')
    for f in files:
        unit = f.stem[len('src_'):]
        row = {'unit': unit}
        for mode, script, ok in CHECKS:
            try:
                p = subprocess.run([a.python, str(HERE / script), '--html', str(a.html), '--sources', str(f)],
                                   capture_output=True, text=True, timeout=a.timeout, cwd=HERE)
                out = p.stdout + p.stderr
                passed = p.returncode == 0 and ok(out)
                detail = 'PASS' if passed else f'FAIL rc={p.returncode} ' + (out.strip().splitlines() or ['NO_OUTPUT'])[-1][:160]
            except subprocess.TimeoutExpired:
                passed, detail = False, 'FAIL TIMEOUT'
            row[mode] = detail
            if not passed: failed.append(f'{unit}:{mode}')
        results.append(row)
        print(f"{unit} | solo {row['solo'][:60]} | team {row['team'][:60]} | arcade {row['arcade'][:60]}", flush=True)
    summary = {'units': len(files), 'expected': a.expect_units, 'failed': failed, 'pass': not failed}
    if a.json: a.json.write_text(json.dumps({'summary': summary, 'results': results}, ensure_ascii=False, indent=1))
    print(('F3_ALL_UNITS_PASS ' if not failed else 'F3_ALL_UNITS_FAIL ') + json.dumps(summary, ensure_ascii=False))
    sys.exit(0 if not failed else 1)

if __name__ == '__main__':
    main()
