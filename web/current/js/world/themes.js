'use strict';
window.HOJA_CREATE_THEMES = function () {
  const THEMES={
    grassland:{
      name:'GRASSLAND',sky:'#51b8ec',
      terrain:'terrain',entities:'entities',
      bg:[
        {key:'bgSky',        xFactor:0.000, yFactor:0.000},
        {key:'bgCloud1',     xFactor:0.028, yFactor:0.010, cloudDrift:0.36},
        {key:'bgCloud2',     xFactor:0.055, yFactor:0.020, cloudDrift:0.54},
        {key:'bgHills',      xFactor:0.100, yFactor:0.040},
        {key:'bgForeground', xFactor:0.180, yFactor:0.070}
      ],
      decor:{
        tree:[
          [[21,22,23],[41,42,43],[61,62,63]],
          [[25,26,27],[45,46,47],[65,66,67]],
          [[29,30,31],[49,50,51],[69,70,71]]
        ],
        small:[[[101]]]
      },
      water:{deep:0x2662ab,tint:0xffffff},
      weather:null
    },
    autumn:{
      name:'AUTUMN FOREST',sky:'#fff3d8',
      terrain:'thAutTerrain',entities:'thAutEntities',
      bg:[
        {key:'thAutDistant', xFactor:0.000, yFactor:0.000},
        {key:'thAutRow2',    xFactor:0.028, yFactor:0.012},
        {key:'thAutRow1',    xFactor:0.055, yFactor:0.022},
        {key:'thAutPiles',   xFactor:0.100, yFactor:0.040},
        {key:'thAutTrees',   xFactor:0.180, yFactor:0.070},
        {key:'thAutLeafTop', xFactor:0.180, yFactor:0.070}
      ],
      decor:{
        tree:[
          [[21,22,23],[41,42,43],[61,62,63]],
          [[25,26,27],[45,46,47],[65,66,67]]
        ],
        small:[[[101]],[[103]]]
      },
      water:{deep:0x29609e,tint:0xffffff},
      weather:{kind:'leaves',count:26,colors:[0xf08a2c,0xd9542b,0xf5c04a]}
    },
    tropics:{
      name:'TROPICS',sky:'#50bbff',
      terrain:'thTroTerrain',entities:'thTroEntities',
      bg:[
        {key:'thTroSky',      xFactor:0.000, yFactor:0.000},
        {key:'thTroCloudsBG', xFactor:0.028, yFactor:0.012, cloudDrift:0.36},
        {key:'thTroClouds',   xFactor:0.055, yFactor:0.022, cloudDrift:0.54},
        {key:'thTroWaters',   xFactor:0.100, yFactor:0.040}
      ],
      decor:{
        tree:[[[18,19,20],[35,36,37],[52,53,54]]],
        small:[[[60]],[[56,57,58]]]
      },
      water:{deep:0x1f6fc0,tint:0xe6fbff},
      weather:null
    },
    winter:{
      name:'WINTER WORLD',sky:'#fff8ff',
      terrain:'thWinTerrain',entities:'thWinEntities',
      bg:[
        {key:'thWinMountain', xFactor:0.000, yFactor:0.000},
        {key:'thWinHills',    xFactor:0.055, yFactor:0.022},
        {key:'thWinFore',     xFactor:0.140, yFactor:0.060}
      ],
      decor:{
        tree:[
          [[15,16,17],[29,30,31],[43,44,45]],
          [[19,20,21],[33,34,35],[47,48,49]]
        ],
        small:[[[71]],[[73,74]]]
      },
      water:{deep:0x30679f,tint:0xd6efff},
      weather:{kind:'snow',count:46,colors:[0xc3d4ee,0xd9e6f7,0xffffff]}
    }
  };

  THEMES.cave={
    name:'CAVE EXPEDITION', sky:'#1b141e', terrain:'caveGray', entities:'caveScaffold',
    bg:[{key:'caveBg',xFactor:0,yFactor:0}],
    decor:{tree:[],small:[]}, water:{deep:0x1c263d,tint:0xffffff},weather:null
  };
  return THEMES;
};
