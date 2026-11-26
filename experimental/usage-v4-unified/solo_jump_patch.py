"""HOJA 1.5: exact, reversible SOLO collision patch on the audited RC; never alter original parts."""
import hashlib

OLD = "  const t0=performance.now(),duration=800,amplitude=Math.min(stage().clientHeight*.25,125);\n  function tick(now){\n   if(page!=='quiz'){jumping=false;return;}\n   const t=Math.min(1,(now-t0)/duration),height=4*amplitude*t*(1-t);\n   player().style.transform='translateX(-50%) translateY(-'+height.toFixed(1)+'px)';\n   if(t<.75&&collide()){".encode('ascii')
NEW = "  const t0=performance.now(),duration=800,amplitude=Math.min(stage().clientHeight*.25,125);\n  const jumpHeight=t=>4*amplitude*t*(1-t);\n  let previousT=0;\n  function tick(now){\n   if(page!=='quiz'){jumping=false;return;}\n   const t=Math.max(0,Math.min(1,(now-t0)/duration)),height=jumpHeight(t);\n   const applied=Number(height.toFixed(1));\n   player().style.transform='translateX(-50%) translateY(-'+height.toFixed(1)+'px)';\n   let hit=t<.75&&collide();\n   // Check the swept vertical interval, including the apex if a frame stall skipped it.\n   if(!hit&&previousT<.75&&t>previousT){\n    const end=Math.min(t,.75),peak=Math.max(previousT,Math.min(.5,end));\n    const low=Math.min(jumpHeight(previousT),jumpHeight(end)),high=jumpHeight(peak);\n    const p=player().getBoundingClientRect(),b=img('hqBalloon').getBoundingClientRect();\n    hit=p.left<b.right&&p.right>b.left&&p.top+applied-high<b.bottom-4&&p.bottom+applied-low>b.top+10;\n   }\n   previousT=t;\n   if(hit){".encode('ascii')
PATCH_SHA256 = hashlib.sha256(NEW).hexdigest()

def apply(game):
    if game.count(OLD) != 1 or NEW in game:
        raise ValueError('SOLO_JUMP_PATCH_ANCHOR_MISMATCH')
    return game.replace(OLD, NEW, 1)

def verify(game):
    return game.count(NEW) == 1 and OLD not in game
