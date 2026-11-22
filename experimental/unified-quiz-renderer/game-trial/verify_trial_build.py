#!/usr/bin/env python3
"""Verify that GitHub trial parts rebuild in place without modifying production.
No GAS, remote ranking, or browser execution. Use with CI and locally.
"""
from pathlib import Path
import hashlib
import json
import tempfile
from build_trial import build
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
ORIGINAL=ROOT/'versions/2.0.0/Game.html.parts'
APPROVED=HERE.parent/'HOJA_APPROVED_RENDERER_BRIDGE.html'
EXPECTED='4ac5c4efc985c4c5d08f10a4410a48d7b49070c30fb10651a0c78cec6b3ecfc6'
EXPECTED_14='70d3c6aab0620a74e7cd9f91015a02b2c3f8ca21'
def gitblob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def audit():
    originals=[(ORIGINAL/f'part-{i:02}.txt').read_bytes() for i in range(1,26)]
    assert hashlib.sha256(b''.join(originals)).hexdigest()==EXPECTED,'Original 7MB snapshot changed'
    trial=[(HERE/f'part-{i:02}.txt').read_bytes() for i in range(1,26)]
    assert gitblob(trial[13])==EXPECTED_14,'Chromium QA part-14 bytes changed'
    changed=[i+1 for i,(a,b) in enumerate(zip(originals,trial)) if a!=b]
    assert changed==[14,22],f'Unexpected changes in trial parts: {changed}'
    assert APPROVED.exists() and APPROVED.stat().st_size>1_000_000
    with tempfile.TemporaryDirectory() as folder:
        dest=Path(folder)/'Game.TEST.html'
        build(dest)
        b=dest.read_bytes()
        assert len(b)>7_208_766
        assert b'HOJA_TRIAL_APPROVED_HTML_INLINE' not in b
        assert b'window.HOJA_TRIAL_APPROVED_HTML=' in b
        assert b'window.HOJA_UNIFIED_TRIAL_CORE' in b
        assert b'SOLO_APPROVED_RENDERER_SOURCE_REQUIRED' in b
        assert b'TEAM_RENDER_APPROVED_QUESTION_REQUIRED' in b
        return {'originalSha256':EXPECTED,'trialBytes':len(b),'trialSha256':hashlib.sha256(b).hexdigest(),'changedParts':changed}
def gas():
    base=HERE.parent/'gas-test'
    total=mcq=ox=short=split=0
    media=set()
    for unit in ('S6U31','S6U32'):
        code=(base/f'HOJA_QB_UNIT_{unit}.gs').read_text()
        mark='return JSON.parse(['
        a=code.index(mark)+len(mark)
        z=code.index('].join("")',a)
        payload=json.loads(''.join(json.loads('['+code[a:z].rstrip().rstrip(',')+']')))
        rows=payload['questions']
        assert len(rows)==32
        total+=len(rows)
        mcq+=sum(q['type']=='MULTIPLE' for q in rows)
        ox+=sum(q['type']=='OX' for q in rows)
        short+=sum(q['type']=='SUBJECTIVE' for q in rows)
        media.update(payload['images'])
        split+=sum(payload['tags'][q['rendererQuestion']['id']].get('layout',{}).get('rendererHint')=='split' for q in rows)
        assert all(q['rendererQuestion']['prompt']==q['question'] for q in rows)
    assert (total,mcq,ox,short,len(media),split)==(64,44,12,8,15,11)
    code=(base/'Code.TEST.gs').read_text()
    assert "HOJA_TRIAL_RANK_WRITE_DISABLED" in code and "recorded:false" in code
    return {'questions':total,'mcq':mcq,'ox':ox,'short':short,'images':len(media),'cSplit':split,'rankWritesDisabled':True}
if __name__=='__main__':
    print(json.dumps({'trial':audit(),'approvedData':gas()},ensure_ascii=False,indent=2))
