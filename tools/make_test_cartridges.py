#!/usr/bin/env python3
"""HOJA Phase 1B — 내장 시험 카트리지 만들기.

원본: MARIO QUIZ 2.0 시험판 문제(mario-quiz-2 a768dc4 `cartridges/sa-5-2-joseon-confucian.json`,
50문항 = 객관식 35 + OX 15, 사용자 SMQ에서 변환·검수된 것). 25문항씩 두 카트리지(A, B)로 나눈다.

내장 카트리지 형식(HOJA Phase 1): Project B 서버가 돌려주던 모양 그대로
(`hojaReadCartridge_` Code.gs:137 출력: questionSchemaVersion 2, familyId, type OX/MULTIPLE, answer 'O'/'X'/'1'~'4',
options 4개). 그래서 게임 쪽 문제 처리 코드는 바꾸지 않는다.

  python3 tools/make_test_cartridges.py MARIO_BANK_JSON
"""
import hashlib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'cartridges'


def convert(q, n):
    if q['type'] == 'ox':
        return {'num': n, 'sourceNum': n, 'familyId': q['id'], 'familyOrder': n, 'variantType': 'ox', 'type': 'OX',
                'question': q['q'], 'answer': q['choices'][q['answer']], 'options': ['O', 'X'], 'isNull': False}
    return {'num': n, 'sourceNum': n, 'familyId': q['id'], 'familyOrder': n, 'variantType': 'multiple', 'type': 'MULTIPLE',
            'question': q['q'], 'answer': str(q['answer'] + 1), 'options': list(q['choices']), 'isNull': False}


def main(src):
    bank = json.loads(Path(src).read_text(encoding='utf-8'))['questions']
    assert len(bank) == 50, len(bank)
    OUT.mkdir(exist_ok=True)
    entries = []
    for key, part, title in (('a', bank[:25], '조선 시대의 유교 문화 (시험 A)'), ('b', bank[25:], '조선 시대의 유교 문화 (시험 B)')):
        cid = f'test-joseon-{key}'
        data = {'questionSchemaVersion': 2, 'sourceSheetVersion': 2, 'cartridgeId': cid,
                'questions': [convert(q, i + 1) for i, q in enumerate(part)]}
        raw = (json.dumps(data, ensure_ascii=False, indent=1) + '\n').encode('utf-8')
        (OUT / f'{cid}.json').write_bytes(raw)
        entries.append({'id': cid, 'name': f'5-사회-{title}', 'grade': 5, 'semester': 2, 'subject': '사회', 'unit': title,
                        'count': len(part), 'path': f'cartridges/{cid}.json', 'version': hashlib.sha256(raw).hexdigest()[:12],
                        'test': True})
    catalog = {'about': 'HOJA 내장 카트리지 목록 (Phase 1). name은 기존 카탈로그 화면의 이름 규칙(학년-과목-단원)을 따른다. '
                        'version은 카트리지 파일 내용의 SHA-256 앞 12자리: QR이 담은 버전과 다르면 학생 화면이 접속을 막는다. '
                        'test: true는 시험 카트리지(마리오 2.0 시험판 문제 50개를 둘로 나눈 것).',
               'cartridges': entries}
    (OUT / 'catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('\n'.join(f"{e['id']}: {e['count']}문항, version {e['version']}" for e in entries))


if __name__ == '__main__':
    main(sys.argv[1])
