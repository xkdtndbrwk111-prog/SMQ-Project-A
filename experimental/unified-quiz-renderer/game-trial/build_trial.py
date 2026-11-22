#!/usr/bin/env python3
"""Restore only the trial copy of the 7MB game and inline the approved HTML.
Never overwrite the production original nor update an Apps Script project.
"""
import argparse, hashlib, json
from pathlib import Path
BASE = Path(__file__).resolve().parent
PARTS = BASE/'game-trial'
RENDER = BASE/'HOJA_APPROVED_RENDERER_BRIDGE.html'
MARK = "/* HOJA_TRIAL_APPROVED_HTML_INLINE */null"
EXPECTED_ORIGINAL = "4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6"
def build(output:Path):
    if output.exists(): raise ValueError("Output exists; refusing overwrite")
    pieces=[(PARTS/f'part-{i:02d}.txt').read_bytes() for i in range(1,26)]
    if len(pieces)!=25:raise ValueError("Trial parts incomplete")
    game=b''.join(pieces).decode('utf-8')
    assert game.count(MARK)==1,"Approved renderer injection anchor mismatch"
    approved=RENDER.read_text(encoding='utf-8')
    assert approved.count('HOJA_APPROVED_RENDERER')>0,"Approved renderer missing"
    literal=json.dumps(approved,ensure_ascii=False).replace('<','\\u003c')
    game=game.replace(MARK,literal)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(game,encoding='utf-8')
    print("TRIAL_ONLY",len(game.encode('utf-8')),hashlib.sha256(game.encode('utf-8')).hexdigest(),output)
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',type=Path,required=True)
    a=p.parse_args()
    if a.output.resolve().parent==PARTS.resolve(): raise ValueError("Do not write into source parts")
    build(a.output)
if __name__=='__main__':main()
