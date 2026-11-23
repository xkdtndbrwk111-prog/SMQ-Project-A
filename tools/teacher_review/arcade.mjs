// Builds a separate natural-input review arcade from production source.
export function reviewArcade(html,course,windCourse,steppingCourse){
 function edit(a,b){const i=html.indexOf(a);if(i<0||html.indexOf(a,i+1)>=0)throw Error('review anchor: '+a);html=html.slice(0,i)+b+html.slice(i+a.length);}
 edit('let PENDING_SEED=null;', `const HOJA_REVIEW_CONFIG=JSON.parse(sessionStorage.getItem('HOJA_REVIEW_CONFIG')||'null');
if(!HOJA_REVIEW_CONFIG||!Number.isInteger(HOJA_REVIEW_CONFIG.seed)||HOJA_REVIEW_CONFIG.seed<0||HOJA_REVIEW_CONFIG.seed>4294967295||!Number.isInteger(HOJA_REVIEW_CONFIG.stage)||HOJA_REVIEW_CONFIG.stage<0||HOJA_REVIEW_CONFIG.stage>4)throw Error('검수 시작 정보가 없습니다');
const HOJA_REVIEW_COURSE=${JSON.stringify(course)};
const HOJA_REVIEW_WIND_COURSE=${JSON.stringify(windCourse)};
const HOJA_REVIEW_STEPPING_COURSE=${JSON.stringify(steppingCourse)};
const HOJA_REVIEW_EVENTS=[];let PENDING_SEED=HOJA_REVIEW_CONFIG.seed;`);
 edit("  startStage(0,true,'start',HOJA_CLASS_SESSION?.durationSeconds??900); // shared engine, class setting fixed at start", "  if(['course','windcourse','brickcourse'].includes(HOJA_REVIEW_CONFIG.mode))hojaMakerImport(HOJA_REVIEW_CONFIG.mode==='course'?HOJA_REVIEW_COURSE:HOJA_REVIEW_CONFIG.mode==='windcourse'?HOJA_REVIEW_WIND_COURSE:HOJA_REVIEW_STEPPING_COURSE).catch(e=>alert('시험 코스를 시작하지 못했습니다: '+e.message));else startStage(HOJA_REVIEW_CONFIG.stage,true,HOJA_REVIEW_CONFIG.stage===4?'fromSurface:0':'start',900);");
 edit('    RUN.deaths=(RUN.deaths||0)+1;', "    HOJA_REVIEW_EVENTS.push({type:'death',stage:STAGE_INDEX,x:this.playerBody.x,y:this.playerBody.y,reason,gimmick:this.hojaGimmickHit||null,checkpoint:this.hojaCaveCheckpoint?.active??this.hojaCheckpoint?.active??null,at:Date.now()});\n    RUN.deaths=(RUN.deaths||0)+1;");
 edit('    this.enterDoor(near);', "    HOJA_REVIEW_EVENTS.push({type:'door',stage:STAGE_INDEX,kind:near.kind,x:this.playerBody.x,y:this.playerBody.y,at:Date.now()});\n    this.enterDoor(near);");
 edit('    this._makerPendingEvent=null;\n  }\n  updateMakerExtraObjects(time,delta){', `    this._makerPendingEvent=null;
    if(['course','windcourse','brickcourse'].includes(HOJA_REVIEW_CONFIG.mode)){
      const style={fontSize:'18px',color:'#fff3bf',stroke:'#153b43',strokeThickness:4};
      for(const [x,label] of (HOJA_REVIEW_CONFIG.mode==='course'?[[20,'지면 톱날'],[34,'공중 톱날'],[49,'S로 앉기'],[71,'계속 바람'],[98,'간헐 바람'],[125,'불꽃 발판'],[145,'↑ 바람'],[158,'↓ 바람']]:[]))this.add.text(x*TILE,STAGE.makerHeight-125,label,style).setDepth(20);
      this.hojaCourseGoalLabel=this.add.text((STAGE.worldW-6)*TILE,HOJA_REVIEW_CONFIG.mode==='windcourse'?30*TILE-70:HOJA_REVIEW_CONFIG.mode==='brickcourse'?22*TILE-70:STAGE.makerHeight-125,'골인 →',style).setDepth(20);
    }
  }
  updateMakerExtraObjects(time,delta){`);
 edit('    if(!this.playerBody)return;\n    for(const h of this.makerHazards||[]){', `    if(!this.playerBody)return;
    if(['course','windcourse','brickcourse'].includes(HOJA_REVIEW_CONFIG.mode)&&!this.hojaReviewCourseGoal&&!this.dying&&this.playerBody.x>=(STAGE.worldW-5)*TILE){this.hojaReviewCourseGoal=true;this.hojaCourseGoalLabel?.setVisible(false);HOJA_REVIEW_EVENTS.push({type:'course_goal',stage:STAGE_INDEX,x:this.playerBody.x,y:this.playerBody.y,at:Date.now()});this.add.text(Math.min(this.playerBody.x,this.cameras.main.worldView.right-110),this.playerBody.y-72,'코스 통과!',{fontSize:'24px',color:'#ffe690',stroke:'#153b43',strokeThickness:4}).setOrigin(.5).setDepth(30);}
    for(const h of this.makerHazards||[]){`);
 edit('let ACTIVE_SCENE=null;', `let ACTIVE_SCENE=null;
window.HOJA_REVIEW_READONLY=Object.freeze({snapshot(){const s=ACTIVE_SCENE;if(!s?.playerBody?.body)return null;return {seed:RUN.seed,stage:STAGE_INDEX,x:Math.round(s.playerBody.x),y:Math.round(s.playerBody.y),deaths:RUN.deaths,dying:!!s.dying,checkpoint:s.hojaCaveCheckpoint?.active??s.hojaCheckpoint?.active??null,clear:!!s.clear,sceneTime:s.time.now,gimmickTime:s.hojaGimmicks?.elapsed??null,gimmicks:s.hojaGimmicks?.snapshot()??null,endReason:RUN.endReason,remainingMs:s.remainingMs,geometry:SOLIDS.map(o=>[o.x,o.y,o.w,o.h,o.kind]),events:HOJA_REVIEW_EVENTS.map(e=>({...e}))};}});`);
 return html;
}
