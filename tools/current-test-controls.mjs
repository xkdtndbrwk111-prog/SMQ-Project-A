// Test-only rendering and camera controls.
export const controlsBeforeSound = `    document.getElementById('v055ChunkBtn').onclick=()=>this.toggleSurfaceChunks();
    document.getElementById('hojaTerrainSplitBtn').onclick=()=>this.hojaToggleTerrainSplit();
    this.hojaUpdateTerrainSplitButton();
    document.getElementById('hojaSeamDiagBtn').onclick=()=>this.hojaToggleSeamDiagnostic();
    document.getElementById('hojaZoomProbeBtn').onclick=()=>this.hojaCycleZoomProbe();
    this.hojaUpdateSeamButtons();
    for(const btn of document.querySelectorAll('.cleanZoomGroup button[data-zoom-mode]')){
      btn.onclick=()=>this.hojaSetManualZoom(btn.dataset.zoomMode);
    }
    this.hojaUpdateManualZoomButtons();
    const safeGuideBtn=document.getElementById('hojaCameraSafeGuideBtn');
    if(safeGuideBtn)safeGuideBtn.onclick=()=>{
      const guide=document.getElementById('hojaCameraSafeGuide');
      if(!guide)return;
      const showing=guide.style.display==='none';
      guide.style.display=showing?'block':'none';
      safeGuideBtn.textContent=showing?'안전 영역 숨기기':'안전 영역 표시';
    };
    const snorePreviewBtn=document.getElementById('hojaSnorePreviewBtn');
    if(snorePreviewBtn)snorePreviewBtn.onclick=()=>{unlockAudio();SFX.sleep();};
    const worldPixelBtn=document.getElementById('hojaPixelExperimentBtn');
    const renderScaleBtn=document.getElementById('hojaRenderScaleBtn');
    const updateWorldPixelLabel=()=>{
      worldPixelBtn.textContent=HOJA_WORLD_PIXEL_MAG===2?'월드 픽셀: 정수 2× (전체)':'월드 픽셀: 기존 1× (비교)';
      worldPixelBtn.setAttribute('aria-pressed',String(HOJA_WORLD_PIXEL_MAG===2));
      renderScaleBtn.disabled=HOJA_WORLD_PIXEL_MAG===2;
      renderScaleBtn.textContent=HOJA_WORLD_PIXEL_MAG===2?'출력 픽셀: 1:1 (고정)':
        (QUALITY_MODE===1?'렌더 배율: 1.0×':'렌더 배율: 최대 1.5×');
    };
    worldPixelBtn.onclick=()=>{
      // Strict integer pixel grid: legacy buffer comparator no longer changes backing scale.
      HOJA_WORLD_PIXEL_MAG=2;
      applyResponsiveViewport();
      updateWorldPixelLabel();
      this.hojaUpdatePixelExperimentStatus(true);
    };
    renderScaleBtn.onclick=()=>{
      // Disabled: changing buffer scale without changing CSS dimensions
      // produces fractional source pixels on screen.
      return;
      updateWorldPixelLabel();
    };
    updateWorldPixelLabel();
    const v055Btn=document.getElementById('v055ChunkBtn');
    if(v055Btn)v055Btn.textContent=this.v055Chunks?.length?
      '지상 지형: '+(this.surfaceChunkMode?'청크':'원본')+' (Y)':'지상 지형: 동굴 제외';
`;

export const controlsAfterSound = `    document.getElementById('c1CameraBtn').onclick=()=>{
      HOJA_C1_MANUAL_CAMERA=!HOJA_C1_MANUAL_CAMERA;
      this.configureC1CameraTrial();
      hojaC1CameraButtonUpdate();
      document.getElementById('c1CameraBtn').blur();
    };
    hojaC1CameraButtonUpdate();
    document.getElementById('qualityBtn').onclick=()=>changeQualityMode(QUALITY_MODE+1);
    document.getElementById('bgPerfBtn').onclick=()=>this.toggleLightBackground();
    document.getElementById('lampPerfBtn').onclick=()=>this.cycleSurfaceLampMode();
    document.getElementById('cullPerfBtn').onclick=()=>this.toggleStaticCulling();
    document.getElementById('colliderBtn').onclick=()=>{
      if(!this.physics.world.debugGraphic)return;
      const vis=!this.physics.world.debugGraphic.visible;
      this.physics.world.debugGraphic.setVisible(vis);
      document.getElementById('colliderBtn').textContent=vis?'콜라이더 숨기기':'콜라이더 표시';
    };`;

export const controlButtons = `<button id="hojaTerrainSplitBtn" style="display:none" type="button" title="A: 발판·장식 모두 청크 / B: 발판 개별·장식 청크 / C: 발판 청크·장식 개별">청크 원인 비교: A — 모두 청크</button>
<button type="button" id="hojaCameraSafeGuideBtn" title="카메라 안전 영역을 화면 위에 표시하거나 숨깁니다">안전 영역 표시</button>
<button type="button" id="hojaSnorePreviewBtn" title="수면 효과음을 미리 듣습니다. 소리 끔이면 재생되지 않습니다.">코고는 소리 ▶</button>
<button type="button" id="hojaPixelExperimentBtn" title="호자만 변경하지 않습니다. 모든 지형·적·호자를 동일하게 확대하는 월드 카메라 2배와 원래 크기 비교" aria-pressed="true">월드 픽셀: 정수 2× (전체)</button>
<button type="button" id="hojaRenderScaleBtn" disabled title="캔버스 픽셀과 브라우저 CSS 픽셀을 1:1로 맞춥니다">출력 픽셀: 1:1 (고정)</button>
<button id="c1CameraBtn" type="button" title="C1 수동 카메라와 V0.60 원본 자동 카메라를 비교합니다. 단축키 없음." style="border-color:#e8c880;color:#ffe2a3">카메라: C1 직접 추적</button>
<button id="qualityBtn" type="button" title="균형 / 성능 / 고화질 (게임 진행 중 변경 가능)">렌더 배율: 균형</button>
<button id="v055ChunkBtn" type="button" title="지상 1~4맵: 반복 타일은 원본 렌더링 + 정적 이미지는 경계 보호 청크 / 전체 원본 렌더링을 실시간 교체">지상 지형: 안전 청크 (Y)</button>
<button id="hojaSeamDiagBtn"  type="button" title="실제 렌더 행렬에 따른 256px 청크 경계를 화면에 표시하고 기하학적 틈을 계측">경계 진단: 끔</button>
<button id="hojaZoomProbeBtn"  type="button" title="카메라 줌 목표를 자동 → 1.00 → 1.30 → 1.50 → 2.00으로 비교. C1 추적과 게임 규칙은 유지">줌 비교: 자동</button>
<button id="bgPerfBtn" type="button" title="원본 패럴랙스 / 경량 배경을 실시간 비교합니다">배경: 원본</button>
<button id="lampPerfBtn" type="button" title="성능 실험: 가로등의 원형 빛을 원본·경량·끄기로 비교">지상 광원: 원본 300px (N)</button>
<button id="cullPerfBtn" type="button" title="고정 지형의 화면 밖 그리기 여부를 실시간 비교합니다">화면 밖 컬링: 켬</button>
<button id="colliderBtn" type="button">콜라이더 표시</button>
<div class="cleanZoomGroup" role="group" aria-label="카메라 자동·수동 확대 배율">
      <button type="button" id="hojaZoomAutoBtn" data-zoom-mode="auto" aria-pressed="true">자동</button>
      <button type="button" id="hojaZoom10Btn" data-zoom-mode="normal" aria-pressed="false" title="진단 전용 1×. 자동 게임은 2× 또는 3×입니다.">1.00× (진단)</button>
      <button type="button" id="hojaZoom13Btn" data-zoom-mode="compare13" aria-pressed="false" disabled title="2×기본 픽셀에서 1.3×는 2.6칸으로 비정수입니다">1.30× (제외)</button>
      <button type="button" id="hojaZoom15Btn" data-zoom-mode="idle" aria-pressed="false">2.00×</button>
      <button type="button" id="hojaZoom20Btn" data-zoom-mode="compare20" aria-pressed="false">3.00×</button>
    </div>`;
