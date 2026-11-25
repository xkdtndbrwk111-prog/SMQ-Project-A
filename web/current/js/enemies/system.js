'use strict';
window.HOJA_ENEMIES = (() => {
  const types = Object.create(null);

  function registerTextures(image, sheet) {
    for (const type of Object.values(types)) {
      for (const asset of type.assets) {
        if (asset.length === 2) image(...asset);
        else sheet(...asset);
      }
    }
    // The stationary variant was registered after all animated sprites.
    image(...types.BALLOONEY.stationaryAsset);
  }

  function spawn(scene, s, i, standingSurfaceBelow) {
    if(scene.mem.balloons.has('e'+i)||scene.mem.kills.has('e'+i))return;
    const spec=types[s.type].body;
    const spawnY=s.type==='OWL'?standingSurfaceBelow(s.x,s.y):s.y;
    const bodyObj=scene.add.rectangle(s.x,spawnY-spec.h/2,spec.w,spec.h,0xffffff,0);
    scene.physics.add.existing(bodyObj,false);
    scene.enemyBodies.add(bodyObj);
    bodyObj.body.setCollideWorldBounds(false);

    const key=types[s.type].texture;
    const sprite=scene.add.sprite(s.x,spawnY,key,0).setOrigin(0.5,1).setScale(2).setDepth(11);
    if(s.makerFacing==='left')sprite.setFlipX(true);

    const initialDir=s.makerFacing==='left'?-1:s.makerFacing==='right'?1:(i%2?-1:1);
    const e={
      type:s.type,bodyObj,sprite,min:s.min,max:s.max,baseY:spawnY,
      dir:initialDir,faceDir:s.makerFacing?initialDir:1,state:s.type==='OWL'?'PERCH':'IDLE',
      timer:25+(i*19)%55,phase:(i*1.73)%6.28,step:i*7,
      alive:true,shellTimer:0,dashStart:0,riseTarget:0,
      spawnX:s.x,spawnY:spawnY,spawnDir:initialDir,makerFacing:s.makerFacing||null,
       makerMoveMode:s.makerMode||'native',makerMoveSpeed:s.makerSpeed||80,
      scored:false,despawned:false,consumed:false,stationary:false,
      safeRespawnBlocked:false,memKey:'e'+i
    };
    bodyObj.__enemy=e;
    if(['OWL','BLANKEY','BALLOONEY'].includes(e.type))bodyObj.body.setAllowGravity(false);
    else bodyObj.body.setAccelerationY(900);
    scene.enemies.push(e);
  }

  function update(scene, time, delta, makerMode, SFX, overlapBodies) {
    const px=scene.playerBody.x,py=scene.playerBody.body.bottom;

    const frame = {time, delta, py, SFX};
    for(const e of scene.enemies){
      if(!e.alive)continue;
      const b=e.bodyObj.body;e.step++;
      const dx=px-e.bodyObj.x,dy=py-b.bottom;
      if(makerMode&&e.makerMoveMode==='patrol'){
        // Mutually exclusive mover: retain contact/damage mechanics, replace AI velocity only.
        if(e.bodyObj.x<=e.min+1||b.blocked.left)e.dir=1;
        if(e.bodyObj.x>=e.max-1||b.blocked.right)e.dir=-1;
        b.setVelocityX((e.makerMoveSpeed||80)*e.dir);
        b.setAccelerationY(900);
        e.faceDir=e.dir;
        e.sprite.setTexture(types[e.type].texture,0);
        e.sprite.setPosition(e.bodyObj.x,b.bottom).setFlipX(e.faceDir<0);
        continue;
      }

      types[e.type]?.update(scene, e, frame, dx, dy);
      // Authored facing applies while an enemy is passive; active AI still turns naturally.
      if(makerMode&&e.makerFacing&&((e.type==='OWL'&&e.state==='PERCH'&&(Math.abs(dx)>=150||Math.abs(py-e.baseY)>=170))||(e.type==='BLANKEY'&&Math.abs(dx)>=420)||e.type==='BALLOONEY'))e.faceDir=e.makerFacing==='left'?-1:1;

      if((e.type==='MARTIAN'&&e.state==='CHARGE')||
         (e.type==='OWL'&&e.state==='DASH')||
         (e.type==='HERMIE'&&e.state==='SHELL_MOVE')){
        scene.enemySpeedTrail(e,time);
      }
      e.sprite.setPosition(e.bodyObj.x,b.bottom);
      let flip=e.faceDir<0;
      if(e.type==='HERMIE'&&e.state==='SHELL_MOVE'&&Math.floor(e.step/2)%2)flip=!flip;
      e.sprite.setFlipX(flip);
    }

    // Moving shell destroys every enemy except question balloons.
    for(const shell of scene.enemies){
      if(!shell.alive||shell.type!=='HERMIE'||shell.state!=='SHELL_MOVE')continue;
      let shellHitsThisFrame=0;
      let hitX=shell.bodyObj.x,hitY=shell.bodyObj.body.center.y;
      for(const other of scene.enemies){
        if(other===shell||!other.alive||other.type==='BALLOONEY')continue;
        if(overlapBodies(shell.bodyObj.body,other.bodyObj.body)){
          scene.emitBurst(other.bodyObj.x,other.bodyObj.body.center.y,8,0xffe0a8,.5);
          scene.killEnemy(other,other.type==='BLANKEY'?'shell-blankey':'shell');
          shellHitsThisFrame++;
          shell.fxShellCombo=(shell.fxShellCombo||0)+1;
          hitX=other.bodyObj.x;hitY=other.bodyObj.body.center.y;
        }
      }
      // Physical response only once per moving shell/frame, even for a crowd.
      if(shellHitsThisFrame){
        scene.announceCombo('SHELL',shell.fxShellCombo,hitX,hitY);
        SFX.shellHit();scene.hitStop(30);scene.cameras.main.shake(60,.004);
      }
    }
  }

  return { types, spawn, update, registerTextures };
})();
