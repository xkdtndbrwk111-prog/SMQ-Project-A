#!/usr/bin/env python3
"""Only preserve approved team source fields in a SEPARATE, SHA-locked 7MB game test copy.
This does not yet replace the game renderer or deploy Apps Script.
"""
from __future__ import annotations
import argparse
import hashlib
from pathlib import Path
EXPECTED_SHA256='4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6'
ANCHOR_START=' function fromServer(sources){'
ANCHOR_END=' function arrangeBoard(list){'
OLD_VALID="const valid=row.options.map((text,i)=>({text:String(text??'').trim(),correct:i===Number(row.answer)-1})).filter(v=>v.text);"
NEW_VALID="const valid=row.options.map((text,i)=>({text:String(text??'').trim(),correct:i===Number(row.answer)-1,sourceIndex:i})).filter(v=>v.text);"
OLD_Q="q={type:'MC3',text:String(row.question),choices:options.map(v=>v.text),answer:options.findIndex(v=>v.correct),explanation:String(row.explanation||'')};"
NEW_Q="q={type:'MC3',text:String(row.question),choices:options.map(v=>v.text),sourceChoiceIndices:options.map(v=>v.sourceIndex),answer:options.findIndex(v=>v.correct),explanation:String(row.explanation||'')};"
OLD_DONE='       if(!q)continue;\n       const f=families.get(key)||[];'
NEW_DONE="""       if(!q)continue;
       // Preserve original approval data; never reinterpret C-side in the legacy view.
       q.approvedSource={row,bank:entry.data,sheetName:String(entry.sheetName||''),
         questionId:String(row.rendererQuestion?.id||row.approvedQuestion?.id||'')};
       const f=families.get(key)||[];"""

def patch_game(source: str) -> str:
    assert source.count(ANCHOR_START)==1, 'fromServer anchor ambiguous'
    assert source.count(ANCHOR_END)==1, 'arrangeBoard anchor ambiguous'
    a=source.index(ANCHOR_START)
    b=source.index(ANCHOR_END,a)
    section=source[a:b]
    for old,new in ((OLD_VALID,NEW_VALID),(OLD_Q,NEW_Q),(OLD_DONE,NEW_DONE)):
        assert section.count(old)==1, 'old game code mismatch: '+old[:50]
        section=section.replace(old,new)
    return source[:a]+section+source[b:]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--source',required=True,type=Path)
    ap.add_argument('--output',required=True,type=Path)
    a=ap.parse_args()
    if a.source.resolve()==a.output.resolve(): raise SystemExit('Refusing source overwrite')
    data=a.source.read_bytes()
    if hashlib.sha256(data).hexdigest()!=EXPECTED_SHA256: raise SystemExit('Original game SHA-256 mismatch')
    new=patch_game(data.decode('utf-8')).encode('utf-8')
    a.output.parent.mkdir(parents=True,exist_ok=True)
    if a.output.exists(): raise SystemExit('Refusing overwrite of an existing test copy')
    a.output.write_bytes(new)
    print('trial_sha256',hashlib.sha256(new).hexdigest(),'bytes',len(new))

if __name__=='__main__': main()
