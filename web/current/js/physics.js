'use strict';
window.HOJA_CREATE_PHYSICS = function (TILE) {
  const P_CFG={
    walkTop:4.2*60,
    runTop:7.2*60,
    accel:0.22*3600,
    decel:0.264*3600,
    skid:0.55*3600,
    airAccel:0.16*3600,
    jumpHeight:140,
    runJumpBonus:0.12,
    gravityUp:(2*140/(24*24))*3600,
    gravityDown:(2*140/(24*24))*1.7*3600,
    maxFall:13*60,
    cutMul:0.45
  };
  // R3.15: moving-platform side contact is distinct from commanded movement.
  // Physics may alternate velocity 0 / input speed while a platform presses
  // against Hoja; visuals must not restart IDLE/WALK/BRAKE on each tick.
  const HOJA_PLATFORM_PRESS_GRACE_MS=135;
  const HOJA_PLATFORM_GROUNDED_GRACE_MS=150;
  function hojaMovingPlatformContactSide(player,platform){
    const a=player?.body,b=platform?.body;
    if(!a||!b)return 0;
    const verticalOverlap=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    if(verticalOverlap<=4)return 0; // standing on top is NOT side pressure
    // Contact flags may also be set by nearby world solids, so both
    // the side flags AND the corresponding platform edge must agree.
    const edgeTolerance=5;
    if(Math.abs(a.right-b.left)<=edgeTolerance&&
       (a.touching?.right||b.touching?.left))return 1;
    if(Math.abs(a.left-b.right)<=edgeTolerance&&
       (a.touching?.left||b.touching?.right))return -1;
    return 0;
  }
  function hojaPressedAgainstMovingPlatform(contact,time,dir){
    if(!contact||dir===0||contact.side!==dir)return false;
    const age=time-contact.at;
    return age>=0&&age<=HOJA_PLATFORM_PRESS_GRACE_MS;
  }

  const STRONG={dropSpeed:11.5*60, shockRadius:8*TILE, verticalRange:2*TILE};

  function approach(current,target,maxDelta){
    if(current<target)return Math.min(current+maxDelta,target);
    if(current>target)return Math.max(current-maxDelta,target);
    return target;
  }

  function overlapBodies(a,b){
    return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;
  }

  function landsOnPlatform(actor, platform) {
    const body = actor.body;
    const previousBottom = (body.prev?.y ?? body.y) + body.height;
    return body.velocity.y >= 0 && previousBottom <= platform.body.top + 7;
  }

  function isStomp(player, enemy) {
    const horizontal = player.right >= enemy.left - 8 && player.left <= enemy.right + 8;
    const vertical = player.bottom >= enemy.top - 14 && player.bottom <= enemy.center.y + 14;
    return player.velocity.y > 35 && horizontal && vertical;
  }

  function applyHorizontalMotion(scene, dt, time, grounded, dir, run, sitIntent) {
    const b = scene.playerBody.body;
    const onIce=grounded&&scene.isOnIce();
    if(!scene.strongStomp){
      const top=run?P_CFG.runTop:P_CFG.walkTop;
      const movingBefore=b.velocity.x;
      const target=(sitIntent||scene.hojaIsSitting)?0:dir*top;
      let accel=grounded?P_CFG.accel:P_CFG.airAccel;
      if(dir===0)accel=P_CFG.decel;
      else if(Math.sign(b.velocity.x)&&Math.sign(b.velocity.x)!==dir)accel=P_CFG.skid;
      // V0.21 ice: slow to start, long glide to stop, sluggish turn-around.
      if(onIce)accel*=(dir===0?0.4:(Math.sign(b.velocity.x)&&Math.sign(b.velocity.x)!==dir?0.4:0.6));
      b.setVelocityX(approach(b.velocity.x,target,accel*dt));
      if(sitIntent||scene.hojaIsSitting)b.setVelocityX(0);
      if(dir&&!sitIntent&&!scene.hojaIsSitting)scene.facing=dir;
      if(!dir&&grounded&&Math.abs(b.velocity.x)<20)b.setVelocityX(0);
      // Show the supplied 'break' pose only during a fast grounded reversal.
      // Continue until horizontal momentum changes sign or the key is released.
      const reversing=grounded&&!scene._hojaPressingMovingPlatform&&
        !sitIntent&&!scene.hojaIsSitting&&dir!==0&&
        Math.sign(movingBefore)===-dir;
      if(!reversing)scene.hojaBraking=false;
      else if(Math.abs(movingBefore)>=P_CFG.walkTop*1.05)scene.hojaBraking=true;
      if(scene.hojaBraking&&Math.sign(b.velocity.x)!==-dir)scene.hojaBraking=false;
      if(onIce&&Math.abs(b.velocity.x)>110&&(dir===0||Math.sign(b.velocity.x)!==dir)&&time>scene.iceFxAt){
        scene.iceFxAt=time+100;
        scene.emitIceShards(scene.playerBody.x-Math.sign(b.velocity.x)*14,b.bottom,2);
      }
    }else{
      b.setVelocityX(0);
    }
  }

  function applyVerticalMotion(scene, jumpPressed, downPressed, grounded, SFX) {
    const b = scene.playerBody.body;
    if(jumpPressed&&!scene.hojaIsSitting){
      scene.jumpPressedAt=scene.time.now;
      scene.jumpBufferAt=scene.time.now;
      // pressed just AFTER a spring / STOMP contact still counts
      if(scene.time.now<=(scene.bounceWindowUntil||0)&&b.velocity.y<0)scene.superBounce();
    }
    const jumpHeld=scene.keys.jump.isDown;
    // V0.57: 120ms jump buffer. A press just before landing still jumps
    // on touchdown instead of being silently dropped.
    const jumpBuffered=scene.time.now-(scene.jumpBufferAt??-1e9)<=120;
    if(!scene.hojaIsSitting&&(jumpPressed||jumpBuffered)&&scene.coyoteMs>0&&!scene.strongStomp&&!scene._jumpConsumedAirborne){
      scene.jumpBufferAt=-1e9;
      scene._jumpConsumedAirborne=true;
      const ratio=Math.min(1,Math.abs(b.velocity.x)/P_CFG.runTop);
      const H=P_CFG.jumpHeight*(1+P_CFG.runJumpBonus*ratio);
      b.setVelocityY(-Math.sqrt(2*P_CFG.gravityUp*H));
      scene.coyoteMs=0;scene.jumpCut=false;
      scene.emitDust(scene.playerBody.x,b.bottom,4,24);
      scene.squash(.84,1.18,170);
      SFX.jump();
    }
    if(!jumpHeld&&!scene.jumpCut&&b.velocity.y<0){
      b.setVelocityY(b.velocity.y*P_CFG.cutMul);scene.jumpCut=true;
    }

    if(downPressed&&!grounded&&!scene.strongStomp){
      scene.strongStomp=true;b.setVelocity(0,STRONG.dropSpeed);b.setAccelerationY(0);
      // R3.2: no strong-STOMP-only enlargement before the SIT pose.
      scene.restoreHojaUnitScale();
      scene.emitBurst(scene.playerBody.x,b.center.y,6,0xdff7ff,.8);
      SFX.strongStart();
    }

    if(scene.strongStomp){
      b.setAccelerationY(0);b.setVelocityY(Math.max(b.velocity.y,STRONG.dropSpeed));
    }else{
      b.setAccelerationY(b.velocity.y>0?P_CFG.gravityDown:P_CFG.gravityUp);
    }
    // Upward limit raised for springs; falling is still capped at maxFall.
    b.setMaxVelocity(P_CFG.runTop,1100);
    if(b.velocity.y>P_CFG.maxFall)b.setVelocityY(P_CFG.maxFall);
  }
  return { P_CFG, STRONG, HOJA_PLATFORM_GROUNDED_GRACE_MS, hojaMovingPlatformContactSide,
    hojaPressedAgainstMovingPlatform, overlapBodies, landsOnPlatform, isStomp,
    applyHorizontalMotion, applyVerticalMotion };
};
