#!/usr/bin/env python3
"""Restore only the trial copy of the 7MB game and inline the approved HTML.
Never overwrite the production original nor update an Apps Script project.
"""
import argparse, hashlib, json
from pathlib import Path
BASE = Path(__file__).resolve().parent
PARTS = BASE
RENDER = BASE.parent/'HOJA_APPROVED_RENDERER_BRIDGE.html'
MARK = "/* HOJA_TRIAL_APPROVED_HTML_INLINE */null"
ARCADE_MARK = "/* HOJA_ARCADE_APPROVED_RUNTIME_INLINE */null"
ARCADE_MAPPING = BASE.parent/'HOJA_ARCADE_APPROVED_MAPPING.mjs'
ARCADE_RUNTIME = BASE.parent/'HOJA_ARCADE_APPROVED_RUNTIME.mjs'
EXPECTED_ORIGINAL = "4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6"
def build(output:Path,renderer:Path=RENDER):
    if output.exists(): raise ValueError("Output exists; refusing overwrite")
    pieces=[(PARTS/f'part-{i:02d}.txt').read_bytes() for i in range(1,26)]
    if len(pieces)!=25:raise ValueError("Trial parts incomplete")
    game=b''.join(pieces).decode('utf-8')
    assert game.count(MARK)==1,"Approved renderer injection anchor mismatch"
    approved=renderer.read_text(encoding='utf-8')
    assert approved.count('HOJA_APPROVED_RENDERER')>0,"Approved renderer missing"
    literal=json.dumps(approved,ensure_ascii=False).replace('<','\\u003c')
    game=game.replace(MARK,literal)
    assert game.count(ARCADE_MARK)==1, "Arcade approved runtime injection marker mismatch"
    mapping=ARCADE_MAPPING.read_text(encoding='utf-8')
    runtime=ARCADE_RUNTIME.read_text(encoding='utf-8')
    imports="import {createApprovedArcadeCatalog,resolveApprovedArcadeChoice} from './HOJA_ARCADE_APPROVED_MAPPING.mjs';"
    assert runtime.count(imports)==1
    runtime=runtime.replace(imports,'')
    for name,value in [('mapping',mapping),('runtime',runtime)]:
        assert 'export function ' in value, name
    mapping=mapping.replace('export function ','function ')
    runtime=runtime.replace('export function ','function ')
    # Module lives inside the existing trial script, in a closure, not a new renderer.
    inline="(()=>{\n"+mapping+"\n"+runtime+"\nreturn createApprovedArcadeRuntime({core:window.HOJA_UNIFIED_TRIAL_CORE,getApprovedHTML:()=>window.HOJA_TRIAL_APPROVED_HTML,getArcadeFrame:()=>document.getElementById('hqArcadeFrame'),getContainer:()=>document.getElementById('hojaGamePlay')});\n})()"
    assert '</script>' not in inline, "Embedded script must never contain a raw closing tag"
    game=game.replace(ARCADE_MARK,inline)
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(game,encoding='utf-8')
    print("TRIAL_ONLY",len(game.encode('utf-8')),hashlib.sha256(game.encode('utf-8')).hexdigest(),output)
def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--renderer',type=Path,default=RENDER,help='composed renderer (compose_renderer.mjs output); default: the unchanged bridge')
    a=p.parse_args()
    if a.output.resolve().parent==PARTS.resolve(): raise ValueError("Do not write into source parts")
    build(a.output,a.renderer)
if __name__=='__main__':main()
