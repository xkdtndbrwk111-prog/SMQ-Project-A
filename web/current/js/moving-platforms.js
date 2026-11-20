'use strict';
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
    scene.movingPlatforms=[];
    scene.movingPlatformGroup=scene.physics.add.group({allowGravity:false,immovable:true});

    MOVING_PLATFORMS.forEach((cfg,index)=>{
      const bodyObj=scene.add.rectangle(cfg.x+cfg.w/2,cfg.y+cfg.h/2,cfg.w,cfg.h,0xffffff,0);
      scene.physics.add.existing(bodyObj,false);
      scene.movingPlatformGroup.add(bodyObj);
      bodyObj.body.setAllowGravity(false);
      bodyObj.body.setImmovable(true);
      bodyObj.body.pushable=false;
      bodyObj.__makerMoving=Boolean(HOJA_MAKER_MODE&&cfg.makerSkin);
      bodyObj.__makerStandable=cfg.makerStandable!==false;
      if(bodyObj.body.friction){
        bodyObj.body.friction.x=1;
        bodyObj.body.friction.y=1;
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
      if(c.waypoints?.length>=2){
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
