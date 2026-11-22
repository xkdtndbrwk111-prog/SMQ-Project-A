// Builds a separate natural-input review arcade from production source.
export function reviewArcade(html){
 function edit(a,b){const i=html.indexOf(a);if(i<0||html.indexOf(a,i+1)>=0)throw Error('review anchor: '+a);html=html.slice(0,i)+b+html.slice(i+a.length);}
 edit('let PENDING_SEED=null;', `const HOJA_REVIEW_CONFIG=JSON.parse(sessionStorage.getItem('HOJA_REVIEW_CONFIG')||'null');
if(!HOJA_REVIEW_CONFIG||!Number.isInteger(HOJA_REVIEW_CONFIG.seed)||HOJA_REVIEW_CONFIG.seed<0||HOJA_REVIEW_CONFIG.seed>4294967295||!Number.isInteger(HOJA_REVIEW_CONFIG.stage)||HOJA_REVIEW_CONFIG.stage<0||HOJA_REVIEW_CONFIG.stage>4)throw Error('검수 시작 정보가 없습니다');
const HOJA_REVIEW_EVENTS=[];let PENDING_SEED=HOJA_REVIEW_CONFIG.seed;`);
 edit("  startStage(0,true,'start',HOJA_CLASS_SESSION?.durationSeconds??900); // shared engine, class setting fixed at start", "  startStage(HOJA_REVIEW_CONFIG.stage,true,HOJA_REVIEW_CONFIG.stage===4?'fromSurface:0':'start',900);");
 edit('    RUN.deaths=(RUN.deaths||0)+1;', "    HOJA_REVIEW_EVENTS.push({type:'death',stage:STAGE_INDEX,x:this.playerBody.x,y:this.playerBody.y,reason,checkpoint:this.hojaCaveCheckpoint?.active??this.hojaCheckpoint?.active??null,at:Date.now()});\n    RUN.deaths=(RUN.deaths||0)+1;");
 edit('    this.enterDoor(near);', "    HOJA_REVIEW_EVENTS.push({type:'door',stage:STAGE_INDEX,kind:near.kind,x:this.playerBody.x,y:this.playerBody.y,at:Date.now()});\n    this.enterDoor(near);");
 edit('let ACTIVE_SCENE=null;', `let ACTIVE_SCENE=null;
window.HOJA_REVIEW_READONLY=Object.freeze({snapshot(){const s=ACTIVE_SCENE;if(!s?.playerBody?.body)return null;return {seed:RUN.seed,stage:STAGE_INDEX,x:Math.round(s.playerBody.x),y:Math.round(s.playerBody.y),deaths:RUN.deaths,dying:!!s.dying,checkpoint:s.hojaCaveCheckpoint?.active??s.hojaCheckpoint?.active??null,clear:!!s.clear,endReason:RUN.endReason,remainingMs:s.remainingMs,geometry:SOLIDS.map(o=>[o.x,o.y,o.w,o.h,o.kind]),events:HOJA_REVIEW_EVENTS.map(e=>({...e}))};}});`);
 return html;
}
