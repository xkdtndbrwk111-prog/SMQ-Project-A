// Test-only cave vision measurements.
export const visionMetricsMethods = `  updateVisionBenchmark(time,delta){
    if(STAGE.theme!=='cave'||this.manualPaused||this.quizActive)return;
    if(!this.visionFrameStats)return;
    const mode=!this.caveVisionEnabled?'off':this.caveVisionMode;
    if(time-this.visionModeChangedAt<1200)return;
    const values=this.visionFrameStats[mode];
    if(Number.isFinite(delta)&&delta>0&&delta<500){
      values.push(delta);if(values.length>600)values.shift();
    }
    const label=document.getElementById('visionMetric');
    if(label&&time>(this.visionBenchmarkNext||0)){
      this.visionBenchmarkNext=time+950;
      const avg=a=>a.length>=25?(1000/(a.reduce((s,n)=>s+n,0)/a.length)).toFixed(1):'측정 중';
      label.textContent='시야 '+({terrain:'지형',circle:'원형',off:'꺼짐'}[mode])+
        (mode==='terrain'?(this.caveFovSoft?' · 부드러움':' · 선명함'):'')+': '+avg(values)+' FPS'+
        ' · 원형 '+avg(this.visionFrameStats.circle)+' / 지형 '+avg(this.visionFrameStats.terrain);
    }
  }

  visionCompareReport(){
    const r={};for(const [mode,values] of Object.entries(this.visionFrameStats||{})){
      const sorted=values.slice().sort((a,b)=>a-b);
      r[mode]={samples:values.length,
        avgFps:values.length?1000/(values.reduce((a,b)=>a+b,0)/values.length):null,
        worstFrameMs:sorted.length?sorted[sorted.length-1]:null};
    }
    return r;
  }
`;

export const visionMetricsInit = `    this.visionFrameStats={circle:[],terrain:[],off:[]};
    this.visionModeChangedAt=this.time.now;
`;
