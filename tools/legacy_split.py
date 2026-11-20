#!/usr/bin/env python3
"""HOJA Phase 1A — 기준 Game.html을 무손실로 나누고 다시 합쳐 검증한다.

입력: versions/2.0.0/Game.html.parts + SHA256_MANIFEST.json (fa09c97 기준, 수정하지 않음)
출력: legacy/game/      Game.html을 순서대로 자른 조각(HTML 구간, <script>/<style> 본문)
      legacy/decoded/   안에 압축·인코딩되어 있던 것을 푼 파일(아케이드, 튜토리얼, 튜토리얼 패치, 팀전 초상)
      legacy/MANIFEST.json  조각 순서·크기·SHA-256, 원본 SHA-256

  python3 tools/legacy_split.py split    조각 만들기(+ 바로 검증)
  python3 tools/legacy_split.py check    조각을 다시 합쳐 원본과 바이트 비교, 푼 파일 재확인
"""
import base64, gzip, hashlib, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'versions' / '2.0.0'
OUT = ROOT / 'legacy'
sha = lambda b: hashlib.sha256(b).hexdigest()


def original_bytes():
    """restore_game.py와 같은 검증으로 25개 조각을 합친다(파일로 쓰지 않음)."""
    man = json.loads((SRC / 'SHA256_MANIFEST.json').read_text(encoding='utf-8'))
    chunks = []
    for p in man['parts']:
        data = (SRC / 'Game.html.parts' / p['name']).read_bytes()
        git = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        if len(data) != p['bytes'] or git != p['gitBlobSha1']:
            sys.exit('PART_SHA_MISMATCH ' + p['name'])
        chunks.append(data)
    whole = b''.join(chunks)
    if len(whole) != man['bytes'] or sha(whole) != man['sha256']:
        sys.exit('GAME_SHA256_MISMATCH')
    return whole, man['sha256']


def segments(text):
    """<script>/<style> 본문을 따로, 그 사이(여는·닫는 태그 포함)는 HTML 구간으로."""
    out, pos, n = [], 0, 0
    for m in re.finditer(r'<(script|style)(\s[^>]*)?>', text):
        if m.start() < pos:      # (앞 블록 본문 안의 글자: 건너뜀)
            continue
        tag = m.group(1)
        end = text.find('</' + tag + '>', m.end())
        if end < 0:
            sys.exit('UNCLOSED ' + tag)
        out.append(('html', text[pos:m.end()], None))
        attrs = m.group(2) or ''
        ident = re.search(r'id=["\']([^"\']+)', attrs)
        typ = re.search(r'type=["\']([^"\']+)', attrs)
        ext = 'css' if tag == 'style' else ('json' if typ and 'json' in typ.group(1) else ('b64' if typ and 'octet' in typ.group(1) else 'js'))
        out.append((ext, text[m.end():end], f"{tag}_{ident.group(1) if ident else 'anon'}"))
        pos = end
        n += 1
    out.append(('html', text[pos:], None))
    return out


def decoded_payloads(text):
    """안에 들어 있던 압축·인코딩 자료를 푼다: 이름 -> (bytes, 설명)"""
    got = {}
    m = re.search(r"const HOJA_V051_ARCADE_GZIP='([A-Za-z0-9+/=]+)'", text)
    got['arcade.html'] = (gzip.decompress(base64.b64decode(m.group(1))), 'HOJA_V051_ARCADE_GZIP (Game.html hojaV051Gameplay) gzip 해제')
    m = re.search(r'<script type="application/octet-stream" id="hojaR17KTutorialGzip">([^<]+)</script>', text)
    got['tutorial.html'] = (gzip.decompress(base64.b64decode(m.group(1).strip())), 'hojaR17KTutorialGzip gzip 해제')
    m = re.search(r'<script id="hojaR17STutorialArcadeDelta" type="application/octet-stream">([^<]+)</script>', text)
    got['tutorial_arcade_delta.json'] = (base64.b64decode(m.group(1).strip()), 'hojaR17STutorialArcadeDelta base64 해제')
    m = re.search(r'<script type="application/json" id="hojaTeamR10PortraitAssets">(.*?)</script>', text, re.S)
    got['team_portraits.json'] = (m.group(1).encode('utf-8'), 'hojaTeamR10PortraitAssets 본문 그대로')
    return got


def split():
    whole, want = original_bytes()
    text = whole.decode('utf-8')
    gdir, ddir = OUT / 'game', OUT / 'decoded'
    for d in (gdir, ddir):
        d.mkdir(parents=True, exist_ok=True)
        for f in d.iterdir():
            f.unlink()
    pieces = []
    for i, (kind, body, label) in enumerate(segments(text)):
        name = f"{i:03d}_{'html' if kind == 'html' else label}.{ 'html' if kind == 'html' else kind}"
        data = body.encode('utf-8')
        (gdir / name).write_bytes(data)
        pieces.append({'file': f'game/{name}', 'bytes': len(data), 'sha256': sha(data)})
    decoded = []
    for name, (data, what) in decoded_payloads(text).items():
        (ddir / name).write_bytes(data)
        decoded.append({'file': f'decoded/{name}', 'bytes': len(data), 'sha256': sha(data), 'from': what})
    man = {'source': 'versions/2.0.0/Game.html.parts (SMQ-Project-A fa09c97)', 'bytes': len(whole), 'sha256': want,
           'pieceCount': len(pieces), 'pieces': pieces, 'decoded': decoded}
    (OUT / 'MANIFEST.json').write_text(json.dumps(man, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(f'SPLIT {len(pieces)} pieces, {len(decoded)} decoded payloads')
    return check()


def check():
    man = json.loads((OUT / 'MANIFEST.json').read_text(encoding='utf-8'))
    ok = True
    parts = []
    for p in man['pieces']:
        data = (OUT / p['file']).read_bytes()
        if len(data) != p['bytes'] or sha(data) != p['sha256']:
            print('FAIL piece', p['file']); ok = False
        parts.append(data)
    joined = b''.join(parts)
    whole, want = original_bytes()
    same = joined == whole and sha(joined) == man['sha256'] == want
    print(('PASS' if same else 'FAIL') + f' rejoin: {len(joined)} bytes, sha256 {sha(joined)}')
    ok &= same
    text = whole.decode('utf-8')
    for name, (data, _) in decoded_payloads(text).items():
        entry = next(d for d in man['decoded'] if d['file'] == f'decoded/{name}')
        stored = (OUT / entry['file']).read_bytes()
        good = stored == data and sha(stored) == entry['sha256']
        print(('PASS' if good else 'FAIL') + f' decoded {name}: {len(stored)} bytes')
        ok &= good
    print('ALL PASS' if ok else 'FAIL')
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(split() if sys.argv[1:] == ['split'] else check())
