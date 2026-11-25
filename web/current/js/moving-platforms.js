'use strict';
// Recolor only the two original yellow palette entries; all other pixels stay unchanged.
window.HOJA_BLUE_LIFT_IMAGE=function(source){
 const c=document.createElement('canvas');c.width=source.width;c.height=source.height;
 const x=c.getContext('2d');x.drawImage(source,0,0);const im=x.getImageData(0,0,c.width,c.height),d=im.data;
 for(let i=0;i<d.length;i+=4){if(d[i]===225&&d[i+1]===202&&d[i+2]===51){d[i]=63;d[i+1]=139;d[i+2]=230;}else if(d[i]===247&&d[i+1]===236&&d[i+2]===138){d[i]=151;d[i+1]=215;d[i+2]=255;}}
 x.putImageData(im,0,0);return c;
};
window.HOJA_CREATE_MOVING_PLATFORMS = function ({TILE, HOJA_MAKER_IMAGES, hojaV2CaveRow, HOJA_V2_SURFACE_START, HOJA_V2_ATLAS_COLS, HOJA_CAVE_AMBIENT_TINT}) {
  function createMovingPlatforms(scene, {MOVING_PLATFORMS, HOJA_MAKER_MODE, STAGE, THEME, HOJA_V2_RENDER}){
    // Maker R5: use Pixel Adventure original 32×8 eight-frame platforms only
    // for maker-authored stages; built-in HOJA stages retain approved terrain art.
    const makerSheets={brown:'Free/Traps/Platforms/Brown On (32x8).png',grey:'Free/Traps/Platforms/Grey On (32x8).png'};
    if(HOJA_MAKER_MODE){
      for(const [skin,path] of Object.entries(makerSheets)){
        const im=HOJA_MAKER_IMAGES.get(path),key='v061MakerPlatform_'+skin;
        if(im&&!scene.textures.exists(key))scene.textures.addSpriteSheet(key,im,{frameWidth:32,frameHeight:8});
        const anim='v061MakerPlatformAnim_'+skin;
        if(im&&!scene.anims.exists(anim))scene.anims.create({key:anim,frames:scene.anims.generateFrameNumbers(key,{start:0,end:7}),frameRate:9,repeat:-1});
      }
    }
    if(HOJA_MAKER_MODE&&MOVING_PLATFORMS.some(p=>p.makerSink)){
      const image=HOJA_MAKER_IMAGES.get('Free/Traps/Falling Platforms/On (32x10).png');
      if(!image)throw new Error('내려가는 발판 원본 에셋을 불러오지 못했습니다.');
      if(!scene.textures.exists('hojaSinkPlatform'))scene.textures.addSpriteSheet('hojaSinkPlatform',image,{frameWidth:32,frameHeight:10});
      if(!scene.textures.exists('hojaRisePlatform'))scene.textures.addSpriteSheet('hojaRisePlatform',window.HOJA_BLUE_LIFT_IMAGE(image),{frameWidth:32,frameHeight:10});
      if(!scene.anims.exists('hojaSinkPlatformOn'))scene.anims.create({key:'hojaSinkPlatformOn',frames:scene.anims.generateFrameNumbers('hojaSinkPlatform',{start:0,end:3}),frameRate:8,repeat:-1});
      if(!scene.anims.exists('hojaRisePlatformOn'))scene.anims.create({key:'hojaRisePlatformOn',frames:scene.anims.generateFrameNumbers('hojaRisePlatform',{start:0,end:3}),frameRate:8,repeat:-1});
    }
    scene.movingPlatforms=[];
    scene.movingPlatformGroup=scene.physics.add.group({allowGravity:false,immovable:true});

    MOVING_PLATFORMS.forEach((cfg,index)=>{
      const bodyObj=scene.add.rectangle(cfg.x+cfg.w/2,cfg.y+cfg.h/2,cfg.w,cfg.h,0xffffff,0);
      scene.physics.add.existing(bodyObj,false);
      scene.movingPlatformGroup.add(bodyObj);
      bodyObj.body.setAllowGravity(false);
      bodyObj.body.setImmovable(true);
      bodyObj.body.pushable=false;
      bodyObj.__makerMoving=Boolean(HOJA_MAKER_MODE&&(cfg.makerSkin||cfg.makerSink));
      bodyObj.__makerStandable=cfg.makerStandable!==false;
      if(bodyObj.body.friction){
        bodyObj.body.friction.x=1;
        bodyObj.body.friction.y=1;
      }

      if(cfg.makerSink){
        const art=[];
        for(let ox=0;ox<cfg.w;ox+=32){
          const segment=Math.min(32,cfg.w-ox),sp=scene.add.sprite(cfg.x+ox,cfg.y,cfg.makerRise?'hojaRisePlatform':'hojaSinkPlatform',0).setOrigin(0,0).setDepth(4);
          sp.play(cfg.makerRise?'hojaRisePlatformOn':'hojaSinkPlatformOn');
          if(segment<32)sp.setCrop(0,0,segment,10);
          art.push({image:sp,makerArt:true,offsetX:ox,offsetY:0});
        }
        const platform={cfg,bodyObj,tiles:art,touchAt:-1e9,occupied:false};
        bodyObj.__sinkPlatform=platform;scene.movingPlatforms.push(platform);return;
      }

      // One 32×8 original frame per segment. The final partial segment is
      // cropped rather than stretched, maintaining the authentic pixel grid.
      const skin=cfg.makerSkin==='grey'?'grey':'brown';
      const sheet='v061MakerPlatform_'+skin,anim='v061MakerPlatformAnim_'+skin;
      if(HOJA_MAKER_MODE&&scene.textures.exists(sheet)){
        const art=[];
        for(let ox=0;ox<cfg.w;ox+=32){
          const segment=Math.min(32,cfg.w-ox);
          const sp=scene.add.sprite(cfg.x+ox,cfg.y-4,sheet,0).setOrigin(0,0).setDepth(4);
          if(segment<32)sp.setCrop(0,0,segment,8);
          sp.play(anim);
          // R5: PA1 32x8 image has a transparent first row, and its first *full-width*
          // opaque bar is row 3. Hoja's last visible foot row ends at physicsTop-1.
          // Render row 3 at physicsTop-1 (offset -4), keeping physicsTop unchanged.
          art.push({image:sp,makerArt:true,offsetX:ox,offsetY:-4});
        }
        scene.movingPlatforms.push({cfg,bodyObj,tiles:art,dir:index%2?-1:1});
        return;
      }
      const tiles=[];
      const cols=Math.round(cfg.w/TILE),rows=Math.round(cfg.h/TILE);
      for(let tx=0;tx<cols;tx++){
        for(let ty=0;ty<rows;ty++){
          let frame;
          if(STAGE.theme==='cave'){
            // Prior surface frames 20/21/22/69/70/75 are EMPTY in cave sheets!
            frame=ty===0?(tx===0?211:(tx===cols-1?213:212)):277;
          }else if(ty===0)frame=tx===0?20:(tx===cols-1?22:21);
          else frame=tx===0?69:(tx===cols-1?75:70);
          if(HOJA_V2_RENDER){
            const fam=STAGE.theme==='cave'?hojaV2CaveRow(cfg.x+tx*TILE):HOJA_V2_SURFACE_START[STAGE.theme];
            frame=(fam+(ty===0?0:2))*HOJA_V2_ATLAS_COLS+((STAGE.theme==='cave'?0:6)+(tx===0?0:(tx===cols-1?2:1)));
          }
          tiles.push({
            tx,ty,
            image:scene.add.image(cfg.x+tx*TILE+8,cfg.y+ty*TILE+8,
              HOJA_V2_RENDER?'paV2Terrain':(STAGE.theme==='cave'?(cfg.y<64*TILE?'caveGray':'caveBrown'):THEME.terrain),frame).setDepth(4)
              .setTint(STAGE.theme==='cave'?HOJA_CAVE_AMBIENT_TINT:0xffffff)
          });
        }
      }

      scene.movingPlatforms.push({
        cfg,bodyObj,tiles,dir:index%2? -1:1
      });
    });
  }

  function updateMovingPlatforms(scene){
    for(const p of scene.movingPlatforms){
      const b=p.bodyObj.body,c=p.cfg;
      if(c.makerSink){
        const pb=scene.playerBody?.body,top=b.top,now=scene.time.now,grounded=!!(pb&&(pb.blocked.down||pb.touching.down));
        const over=!!pb&&pb.right>b.left+2&&pb.left<b.right-2;
        const occupied=!!pb&&over&&pb.velocity.y>-Math.max(40,c.sinkSpeed+8)&&((now-p.touchAt<120)||(grounded&&Math.abs(pb.bottom-top)<=5)||(p.occupied&&pb.bottom>=top-12&&pb.bottom<=top+8));
        const dt=Math.min(50,Math.max(0,scene.game.loop.delta||16.67))/1000,dir=c.makerRise?-1:1;
        let vy=occupied?dir*c.sinkSpeed:(Math.abs(top-c.y)>.01?-Math.sign(top-c.y)*c.returnSpeed:0);
        let maxY=(scene.physics.world.bounds?.bottom??c.y+4096)-b.height,minY=0;
        for(const group of [scene.solidGroup,scene.oneWayGroup,scene.brickGroup,scene.pipeGroup,scene.crumbleGroup])for(const object of group?.getChildren?.()||[]){
          const floor=object.body;if(!floor||floor.enable===false||floor.right<=b.left||floor.left>=b.right)continue;
          if(floor.top>=c.y+b.height-1)maxY=Math.min(maxY,floor.top-b.height);
          if(group!==scene.oneWayGroup&&floor.bottom<=c.y)minY=Math.max(minY,floor.bottom+(occupied&&pb?pb.height:0));
        }
        maxY=Math.max(c.y,maxY);minY=Math.min(c.y,minY);
        if(occupied&&dir>0&&top+vy*dt>=maxY){b.reset(p.bodyObj.x,maxY+b.height/2);vy=0;}
        if(occupied&&dir<0&&top+vy*dt<=minY){b.reset(p.bodyObj.x,minY+b.height/2);vy=0;}
        if(!occupied&&((top>c.y&&top+vy*dt<=c.y)||(top<c.y&&top+vy*dt>=c.y))){b.reset(p.bodyObj.x,c.y+b.height/2);vy=0;}
        b.setVelocity(0,vy);
        if(occupied&&dir>0&&vy>0&&pb.velocity.y<vy)pb.setVelocityY(vy);
        p.occupied=occupied;
      }else if(c.waypoints?.length>=2){
        if(p.pathIndex===undefined){p.pathIndex=1;p.pathDir=1;}
        const dst=c.waypoints[p.pathIndex],targetX=dst.x+c.w/2,targetY=dst.y+c.h/2;
        const dx=targetX-p.bodyObj.x,dy=targetY-p.bodyObj.y,dist=Math.hypot(dx,dy);
        if(dist<3){
          if(c.pathMode==='loop')p.pathIndex=(p.pathIndex+1)%c.waypoints.length;
          else{
            if(p.pathIndex>=c.waypoints.length-1)p.pathDir=-1;
            else if(p.pathIndex<=0)p.pathDir=1;
            p.pathIndex+=p.pathDir;
          }
          b.setVelocity(0,0);
        }else{
          b.setVelocity(dx/dist*c.speed,dy/dist*c.speed);
        }
      }else if(c.axis==='x'){
        if(p.bodyObj.x-c.w/2<=c.min){p.dir=1}
        if(p.bodyObj.x+c.w/2>=c.max){p.dir=-1}
        b.setVelocity(p.dir*c.speed,0);
      }else{
        const top=p.bodyObj.y-c.h/2;
        if(top<=c.min)p.dir=1;
        if(top>=c.max)p.dir=-1;
        b.setVelocity(0,p.dir*c.speed);
      }

      const left=p.bodyObj.x-c.w/2,top=p.bodyObj.y-c.h/2;
      for(const t of p.tiles)t.image.setPosition(left+(t.makerArt?t.offsetX:t.tx*TILE+8),top+(t.makerArt?t.offsetY:t.ty*TILE+8));
    }
  }

  return {createMovingPlatforms, updateMovingPlatforms};
};
