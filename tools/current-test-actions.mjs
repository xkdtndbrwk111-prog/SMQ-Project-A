// Test-only reset and cave actions.
export const actionHandlers = `    document.getElementById('resetBtn').onclick=()=>{
      // V0.57: a stray click must not wipe a 600-second run.
      const ended=this.timeUp||(this.clear&&STAGE_INDEX===3);
      const started=RUN.score>0||RUN.found>0||RUN.remainingMs<RUN_TIME_LIMIT_MS-15000;
      if(!ended&&started&&!window.confirm('지금까지의 기록을 지우고 처음부터 다시 시작할까요?'))return;
      if(this.input?.keyboard)this.input.keyboard.resetKeys();
      startStage(0,true);
    };
    document.getElementById('escapeCaveBtn').onclick=()=>{
      if(STAGE.theme!=='cave'||!ACTIVE_SCENE){window.alert('동굴 안에서만 사용할 수 있습니다.');return;}
      if(window.confirm('마지막 동굴 출입구로 돌아갈까요? 수집 기록과 남은 시간은 유지됩니다.'))ACTIVE_SCENE.hojaEmergencyReturn();
    };
    document.getElementById('caveRandomBtn').onclick=()=>{
      CAVE_EXPERIMENT_ENABLED=!CAVE_EXPERIMENT_ENABLED;
      const btn=document.getElementById('caveRandomBtn');
      btn.textContent=CAVE_EXPERIMENT_ENABLED?'동굴: 랜덤 실험':'동굴: 기존 맵';
      btn.blur();
      startStage(0,true);
    };
`;

export const emergencyReturnMethod = `  hojaEmergencyReturn(){
    if(STAGE.theme!=='cave'||!this.caveRespawnAnchor||this.quizActive||this.clear||this.dying||this.timeUp||this.manualPaused)return false;
    // Deliberate fail-safe only: no stage reload, no RNG, no score or collectible reset.
    this.respawnNow();
    const note=document.getElementById('caveEscapeToast');
    if(note){note.textContent='마지막 동굴 출입구로 복귀했습니다';note.style.display='block';
      clearTimeout(this._emergencyToastTimer);
      this._emergencyToastTimer=setTimeout(()=>{note.style.display='none';},2100);}
    return true;
  }

`;
