'use strict';
window.HOJA_CREATE_SURFACE_TEMPLATES = function ({ T, TILE, F, WORLD_H }) {
  const g =(x,w,dy=0)=>({x:T(x),y:F+T(dy),w:T(w),h:T(8-dy),kind:'ground'});
  const pf=(x,w,dy)=>({x:T(x),y:F+T(dy),w:T(w),h:T(2),kind:'platform'});
  const mpx=(x,dy,min,max,speed=52)=>({x:T(x),y:F+T(dy),w:T(4),h:T(2),axis:'x',min:T(min),max:T(max),speed});
  const mpy=(x,dy,minDy,maxDy,speed=42)=>({x:T(x),y:F+T(dy),w:T(4),h:T(2),axis:'y',min:F+T(minDy),max:F+T(maxDy),speed});
  const br=(x,dy,hiddenQuiz)=>({type:'stone',x:T(x),y:F+T(dy),hiddenQuiz});
  const en=(type,x,dy,min,max)=>({type,x:T(x),y:F+T(dy),min:T(min),max:T(max)});

  // V0.21 helpers
  const tp=(x,w,dy)=>({x:T(x),y:F+T(dy),w:T(w),h:T(1),kind:'platform',thin:true});      // thin 1-row ledge
  const pi=(x,w,dy)=>({x:T(x),y:F+T(dy),w:T(w),h:T(2),kind:'platform',ice:true});       // ice platform
  const gi=(x,w,dy=0)=>({x:T(x),y:F+T(dy),w:T(w),h:T(8-dy),kind:'ground',ice:true});    // ice-topped ground
  const cr=(x,w,dy)=>({x:T(x),y:F+T(dy),w:T(w),h:T(1)});                                 // crumbling leaf ledge
  const rf=(x,w,dy,sink=2)=>({x:T(x),y:F+T(dy),w:T(w),h:T(1),sink:T(sink)});            // sinking raft
  const sp=(x,dy)=>({x:T(x),y:F+T(dy)});                                                 // spring (2 tiles wide)
  const fl=(x,dy)=>({x:T(x)+8,y:F+T(dy)});                                               // flower collectible
  const sb=(x,dy)=>({x:T(x),y:F+T(dy)});
  const slab=(x,w,dy,thick)=>({x:T(x),y:F+T(dy),w:T(w),h:T(thick),kind:'ground',slab:true}); // V0.24 cave ceiling
  const gc=(x,w,dy)=>({x:T(x),y:F+T(dy),w:T(w),h:T(8),kind:'ground',cave:true});            // V0.24 cave floor                                                 // V0.22 invisible ? block (hit from below)

  const STAGES=[
  // ===========================================================================
  {
    id:1,theme:'grassland',worldW:282,goal:272,start:8,
    checkpoints:[8,52,104,154,206,250],
    solids:[
      {x:-8*TILE,y:F,w:54*TILE,h:8*TILE,kind:'ground'},
      {x:14*TILE,y:F-4*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      {x:27*TILE,y:F-7*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      {x:40*TILE,y:F-3*TILE,w:4*TILE,h:2*TILE,kind:'blockstack'},
      {x:50*TILE,y:F,w:13*TILE,h:8*TILE,kind:'ground'},
      {x:63*TILE,y:F+3*TILE,w:24*TILE,h:5*TILE,kind:'ground'},
      {x:63*TILE,y:F-7*TILE,w:9*TILE,h:2*TILE,kind:'platform'},
      {x:74*TILE,y:F-10*TILE,w:9*TILE,h:2*TILE,kind:'platform'},
      {x:85*TILE,y:F-6*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      {x:91*TILE,y:F,w:15*TILE,h:8*TILE,kind:'ground'},
      {x:104*TILE,y:F,w:16*TILE,h:8*TILE,kind:'ground'},
      {x:114*TILE,y:F-4*TILE,w:7*TILE,h:2*TILE,kind:'platform'},
      {x:123*TILE,y:F-8*TILE,w:7*TILE,h:2*TILE,kind:'platform'},
      {x:132*TILE,y:F-12*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      {x:142*TILE,y:F-15*TILE,w:9*TILE,h:2*TILE,kind:'platform'},
      {x:149*TILE,y:F-10*TILE,w:7*TILE,h:2*TILE,kind:'platform'},
      {x:154*TILE,y:F,w:17*TILE,h:8*TILE,kind:'ground'},
      {x:158*TILE,y:F-13*TILE,w:10*TILE,h:2*TILE,kind:'platform'},
      {x:171*TILE,y:F-16*TILE,w:9*TILE,h:2*TILE,kind:'platform'},
      {x:183*TILE,y:F-12*TILE,w:10*TILE,h:2*TILE,kind:'platform'},
      {x:173*TILE,y:F+2*TILE,w:20*TILE,h:6*TILE,kind:'ground'},
      {x:195*TILE,y:F-7*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      // V0.24 cave: dry pit 220-226 → cave floor F+12 (206-240); exit spring x223
      g(204,2), slab(206,14,0,4), slab(226,14,0,4), g(240,3), gc(206,34,12),
      {x:205*TILE,y:F-11*TILE,w:9*TILE,h:2*TILE,kind:'platform'},
      {x:217*TILE,y:F-7*TILE,w:9*TILE,h:2*TILE,kind:'platform'},
      {x:229*TILE,y:F-4*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      {x:238*TILE,y:F-2*TILE,w:3*TILE,h:2*TILE,kind:'blockstack'},
      {x:247*TILE,y:F,w:35*TILE,h:8*TILE,kind:'ground'},
      {x:250*TILE,y:F-5*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      {x:260*TILE,y:F-9*TILE,w:8*TILE,h:2*TILE,kind:'platform'},
      // V0.58: was x:270,w:8 — it passed through the FINISH door arch (goal 272).
      {x:275*TILE,y:F-5*TILE,w:7*TILE,h:2*TILE,kind:'platform'},
      // V0.21 spring sky routes (thin ledges)
      tp(21,6,-13), tp(30,6,-15), tp(39,5,-12),
      tp(215,6,-15),
      // V0.22 vertical layer: cloud island (start) + sky tower (154-190)
      tp(38,5,-19), pf(45,7,-22),
      tp(163,5,-20), tp(170,5,-24), pf(176,8,-27)
    ],
    moving:[
      {x:35*TILE,y:F-7*TILE,w:4*TILE,h:2*TILE,axis:'x',min:34*TILE,max:46*TILE,speed:52},
      {x:126*TILE,y:F-6*TILE,w:4*TILE,h:2*TILE,axis:'y',min:F-11*TILE,max:F-4*TILE,speed:42},
      {x:181*TILE,y:F-7*TILE,w:4*TILE,h:2*TILE,axis:'x',min:176*TILE,max:195*TILE,speed:56},
      {x:241*TILE,y:F-6*TILE,w:4*TILE,h:2*TILE,axis:'y',min:F-10*TILE,max:F-3*TILE,speed:40}
    ],
    bricks:[
      {type:'stone',x:17*TILE,y:F-9*TILE,hiddenQuiz:true}, // V0.20: was x19,F-5 (embedded in platform 14-22)
      {type:'stone',x:56*TILE,y:F-5*TILE,hiddenQuiz:false},
      {type:'stone',x:108*TILE,y:F-5*TILE,hiddenQuiz:false},
      {type:'stone',x:212*TILE,y:F-5*TILE,hiddenQuiz:true},
      {type:'stone',x:265*TILE,y:F-6*TILE,hiddenQuiz:false}
    ],
    // V0.20 roster: JUMPY · ROACH · MARTIAN (positions from V0.18, types re-cast;
    // flying/perching slots moved onto the platform directly underneath).
    enemies:[
      en('JUMPY',28,0,23,39),
      en('ROACH',43,0,36,47),
      en('MARTIAN',69,3,64,84),
      en('JUMPY',89,-6,86,92),
      en('JUMPY',118,-4,115,120),
      en('ROACH',136,-12,133,139),
      en('MARTIAN',152,-10,150,155),
      en('BALLOONEY',176,-17,173,179),
      en('JUMPY',188,-12,184,192),
      en('ROACH',181,2,175,190),
      en('MARTIAN',198,-7,196,202),
      en('MARTIAN',211,0,208,214),
      en('ROACH',218,0,215,222),
      en('JUMPY',230,0,227,233),
      en('MARTIAN',234,0,231,238),
      en('ROACH',232,-4,230,236),
      en('JUMPY',258,0,251,264),
      en('MARTIAN',278,-5,276,281),
      en('BALLOONEY',224,-17,222,226),  // V0.21 secret: spring route above 205-214
      en('BALLOONEY',230,8,228,232),    // V0.24 cave (was x78 over the basin)
      en('JUMPY',212,12,208,218)
    ],
    // V0.21 gimmick: SPRING — intro (x23, sky route), shortcut (basin x75),
    // reward (x206 → hidden quiz balloon + flower).
    springs:[sp(23,0), sp(75,3), sp(206,0), sp(223,12)],
    flowers:[fl(48,-24), fl(182,-29), fl(236,10)],
    caves:[[206,240]],
    secrets:[sb(179,-32)],
    water:[[46,50],[87,91],[120,154],[171,173],[193,204],[243,247]],
    decor:[[0,'tree',0],[30,'small',0],[56,'small',0],[66,'tree',1],[79,'tree',2],[94,'tree',0],[110,'small',0],[156,'tree',2],[166,'small',0],[176,'tree',0],[184,'tree',1],[210,'small',0],[228,'small',0],[258,'tree',2],[264,'small',0],[276,'small',0]]
  },

  // ===========================================================================
  // STAGE 2 — AUTUMN FOREST · gimmick: CRUMBLING LEAF LEDGES
  //  A 0-48    intro: crumble stair over safe ground (flower 1 on top)
  //  B 48-100  plateau: low road with Roaches / high road of crumbles → quiz
  //  C 100-128 leaf bridge: crumble chain over water (flower 2) or slow ferry
  //  D 128-200 owl hollow: basin + high ledge route with quiz balloon
  //  E 200-296 finale: crumble climb (flower 3) and crumble descent to goal
  // ===========================================================================
  {
    id:2,theme:'autumn',worldW:296,goal:286,start:8,
    checkpoints:[8,56,130,182,212,262],
    solids:[
      g(-8,56), g(53,17), g(70,16,-4), g(86,14), g(128,30), g(158,22,3),
      g(180,20), g(208,22,-2),
      g(230,6), slab(236,8,0,4), slab(250,20,0,4), g(270,34), gc(236,34,12),
      pf(12,6,-4), pf(40,6,-5),
      pf(56,6,-5), tp(62,5,-8), pf(73,6,-8), tp(92,6,-13),
      pf(132,6,-5), pf(140,6,-9), tp(149,6,-12),
      pf(161,6,-1), tp(169,5,-4), pf(175,5,-1),
      tp(158,5,-14), tp(166,5,-15), tp(174,5,-13),
      pf(184,6,-5), pf(212,6,-6), tp(232,6,-14),
      // V0.22 vertical: start-area treetop + canopy above the owl hollow
      tp(44,6,-20), tp(150,5,-18), pf(169,8,-27),
      pf(262,6,-5), pf(272,6,-8)
    ],
    crumbles:[
      cr(20,4,-7), cr(26,4,-10), cr(32,4,-13),
      cr(80,4,-11), cr(86,4,-14),
      cr(101,4,-3), cr(107,4,-4), cr(113,4,-3), cr(119,4,-4),
      cr(201,4,-4), cr(220,4,-9), cr(226,4,-12),
      cr(241,4,-11), cr(248,4,-8), cr(255,4,-5),
      cr(38,4,-17), cr(157,4,-21), cr(163,4,-24)
    ],
    moving:[ mpx(103,-9,102,126,40) ],
    bricks:[
      br(66,-5,false), br(89,-5,true), br(129,-5,false), br(194,-5,true), br(270,-5,false)
    ],
    enemies:[
      en('ROACH',30,0,22,46),
      en('OWL',42,-5,40,45),
      en('ROACH',60,0,54,69),
      en('OWL',77,-8,73,79),
      en('ROACH',93,0,87,99),
      en('BALLOONEY',95,-16,93,97),
      en('BALLOONEY',113,-9,110,117),
      en('OWL',135,0,129,140),
      en('ROACH',146,0,141,157),
      en('BLANKEY',152,-16,144,160),
      en('OWL',165,3,159,179),
      en('ROACH',172,3,159,179),
      en('OWL',177,-1,175,179),
      en('OWL',171,-27,169,176),
      en('ROACH',190,0,181,199),
      en('BLANKEY',215,-10,208,226),
      en('OWL',214,-6,212,217),
      en('ROACH',224,-2,209,229),
      en('BALLOONEY',255,9,252,258),
      en('ROACH',252,12,248,266),
      en('OWL',265,-5,262,267),
      en('ROACH',278,0,268,290),
      en('BLANKEY',280,-11,272,290)
    ],
    water:[[48,53],[100,128],[200,208]],
    flowers:[fl(47,-22), fl(114,-6), fl(262,10)],
    springs:[sp(247,12)],
    caves:[[236,270]],
    secrets:[sb(173,-32)],
    decor:[[0,'tree',0],[10,'small',0],[26,'tree',1],[44,'small',1],[58,'small',0],[74,'small',1],[80,'tree',0],[89,'small',0],[92,'tree',1],[130,'small',1],[142,'tree',0],[160,'small',0],[168,'tree',1],[186,'small',1],[196,'small',0],[210,'small',1],[220,'tree',0],[232,'small',0],[250,'tree',1],[258,'small',1],[276,'tree',0],[284,'small',0],[292,'tree',1]]
  },

  // ===========================================================================
  // STAGE 3 — TROPICS · gimmick: SINKING RAFTS
  //  A 0-46    beach intro: first raft over a narrow inlet
  //  B 46-96   island hop: rafts between islands (flower 1 above a raft)
  //  C 96-148  cliffs: low beach or high ledge climb (flower 2)
  //  D 148-206 open sea: raft chain, small island, ferry
  //  E 206-300 finale: high quiz ledge, last raft, flower 3 before the goal
  // ===========================================================================
  {
    id:3,theme:'tropics',worldW:300,goal:290,start:8,
    checkpoints:[8,48,98,134,208,274],
    solids:[
      g(-8,46), g(46,16), g(74,12),
      g(96,2), slab(98,8,0,4), slab(112,4,0,4), g(116,2), gc(98,18,12), g(118,14,-4), g(132,16),
      g(170,8,1), g(206,24), g(238,16), g(254,10,-3), g(272,32),
      pf(16,6,-5), tp(26,5,-8),
      pf(50,6,-5),
      pf(100,6,-5), pf(108,6,-9), pf(121,6,-8), tp(128,5,-12), tp(135,5,-15),
      pf(172,4,-3),
      pf(210,6,-5), pf(218,6,-9), tp(226,5,-13),
      pf(242,6,-6), tp(256,5,-7),
      pf(276,6,-5), pf(284,6,-9),
      // V0.22 vertical: cliff-top ledges up to a sky island over the bay
      tp(232,4,-18), pf(238,8,-22)
    ],
    rafts:[
      rf(40,4,-1,2),
      rf(64,4,-1,2), rf(69,4,-2,2), rf(88,5,-1,2),
      rf(150,4,-1,2), rf(156,4,-2,3), rf(162,4,-1,2),
      rf(180,4,-1,2), rf(186,4,-2,2),
      rf(232,4,-1,2), rf(266,4,-2,2)
    ],
    moving:[ mpx(192,-4,191,203,46) ],
    bricks:[
      br(10,-5,true), br(58,-5,false), br(115,-5,true), br(140,-5,false), br(226,-5,false), br(250,-5,false)
    ],
    enemies:[
      en('JUMPY',22,0,14,34),
      en('HERMIE',30,0,24,37),
      en('JUMPY',52,0,47,61),
      en('OWL',58,0,51,61),
      en('HERMIE',80,0,75,85),
      en('BALLOONEY',101,9,99,103),
      en('JUMPY',113,12,110,115),
      en('JUMPY',104,-5,101,105),
      en('HERMIE',112,0,97,117),
      en('OWL',124,-8,121,127),
      en('JUMPY',125,-4,119,131),
      en('BALLOONEY',142,-17,140,144),
      en('HERMIE',140,0,133,147),
      en('JUMPY',175,1,171,177),
      en('OWL',244,-22,239,245),
      en('JUMPY',214,0,207,229),
      en('OWL',220,-9,218,223),
      en('HERMIE',225,0,215,229),
      en('BALLOONEY',228,-16,226,231),
      en('JUMPY',245,-6,243,247),
      en('HERMIE',248,0,239,253),
      en('OWL',258,-7,256,260),
      en('HERMIE',280,0,273,289),
      en('JUMPY',286,-9,285,289),
      en('OWL',278,-5,276,281)
    ],
    water:[[38,46],[62,74],[86,96],[148,170],[178,206],[230,238],[264,272]],
    flowers:[fl(71,-6), fl(137,-17), fl(114,10)],
    springs:[sp(109,12)],
    caves:[[98,116]],
    secrets:[sb(241,-27)],
    decor:[[0,'tree',0],[12,'small',0],[26,'tree',0],[34,'small',0],[52,'small',1],[76,'tree',0],[82,'small',0],[100,'tree',0],[120,'small',0],[133,'tree',0],[140,'small',1],[174,'small',0],[208,'small',0],[218,'tree',0],[228,'small',0],[244,'small',1],[258,'small',0],[276,'small',0],[284,'tree',0],[292,'tree',0]]
  },

  // ===========================================================================
  // STAGE 4 — WINTER WORLD · gimmick: ICE (slippery ground & platforms)
  //  A 0-44    ice field intro on flat ground (flower 1 on an ice ledge)
  //  B 44-90   stair plateaus, icy top step
  //  C 90-146  frozen lake: wide ice platforms, ferry, high route (flower 2)
  //  D 146-236 robot yard: basin, raised block, secret quiz ledge
  //  E 236-310 finale: icy crossing and ice slide into the goal (flower 3)
  // ===========================================================================
  {
    id:4,theme:'winter',worldW:310,goal:300,start:8,
    checkpoints:[8,46,92,148,206,266],
    solids:[
      g(-8,24), gi(16,18), g(34,4), g(44,14), g(58,12,-3), gi(70,8,-6), g(78,2,-6),
      g(90,2), slab(92,5,0,4), slab(103,3,0,4), g(106,2), gc(92,14,12),
      gi(146,16), g(162,4), g(166,14,3), gi(180,12), g(192,4), g(204,18,-3), gi(222,10), g(232,4), g(264,2), gi(266,18), g(284,34),
      pi(20,6,-4), pi(28,6,-8),
      pf(46,6,-5), pf(60,6,-7), pi(72,6,-10), pf(82,5,-8),
      pi(110,6,-3), pi(131,6,-4), pi(139,6,-6),
      tp(114,5,-9), tp(121,5,-12), tp(128,5,-10),
      pf(150,6,-5), pf(158,5,-9), pf(169,6,-1), pf(184,6,-5), tp(198,4,-5),
      pf(207,6,-7), tp(215,5,-11), tp(222,5,-14),
      pi(238,6,-4), pi(251,6,-8), tp(258,4,-6),
      pf(270,6,-5), pf(288,6,-9),
      // V0.22 vertical: ice tower above the robot yard
      pi(152,6,-14), tp(160,4,-18), pi(166,6,-22)
    ],
    moving:[
      mpx(118,-5,117,129,46),
      mpy(245,-6,-11,-3,40)
    ],
    bricks:[
      br(10,-5,true), br(54,-5,false), br(96,-5,false), br(147,-5,false), br(192,-5,true), br(278,-5,false)
    ],
    enemies:[
      en('ROBOT',26,0,17,37),
      en('BLANKEY',30,-12,20,40),
      en('CIRCUIT',50,0,45,57),
      en('OWL',63,-7,60,66),
      en('ROBOT',75,-6,71,79),
      en('BALLOONEY',95,9,93,97),
      en('CIRCUIT',95,0,92,97),
      en('CIRCUIT',102,12,94,105),
      en('BLANKEY',125,-15,114,136),
      en('BALLOONEY',134,-7,131,137),
      en('ROBOT',156,0,147,165),
      en('CIRCUIT',160,-9,158,163),
      en('OWL',172,3,167,179),
      en('ROBOT',176,3,167,179),
      en('CIRCUIT',190,0,181,195),
      en('OWL',210,-7,207,213),
      en('ROBOT',214,-3,205,221),
      en('BALLOONEY',225,-17,223,227),
      en('CIRCUIT',230,0,223,235),
      en('BLANKEY',250,-12,240,262),
      en('BALLOONEY',253,-11,251,256),
      en('ROBOT',272,0,265,283),
      en('OWL',274,-5,271,276),
      en('ROBOT',290,-9,289,293),
      en('CIRCUIT',292,0,285,299),
      en('BLANKEY',296,-8,288,304)
    ],
    water:[[38,44],[80,90],[108,146],[196,204],[236,264]],
    flowers:[fl(31,-10), fl(123,-14), fl(103,10)],
    springs:[sp(100,12)],
    caves:[[92,106]],
    secrets:[sb(169,-27)],
    decor:[[0,'tree',0],[18,'small',1],[28,'tree',1],[34,'small',0],[48,'small',0],[62,'small',1],[72,'small',1],[92,'small',0],[150,'small',1],[155,'tree',1],[170,'small',0],[182,'small',1],[190,'small',0],[206,'small',0],[214,'tree',0],[224,'tree',1],[232,'small',1],[268,'small',0],[278,'small',1],[286,'tree',0],[294,'small',0],[302,'tree',1]]
  }
  ];

  // V0.25: insert empty columns into a stage (everything at/after the column
  // shifts right; pieces spanning it get wider). Used to thicken cave walls and
  // widen caves without hand-moving every object.
  function insertColumns(st,atTile,n){
    const X=T(atTile),D=T(n);
    const sh=v=>v>=X?v+D:v;
    const rect=o=>{if(o.x<X&&o.x+o.w>X)o.w+=D;else o.x=sh(o.x);};
    st.solids.forEach(rect);(st.crumbles||[]).forEach(rect);(st.rafts||[]).forEach(rect);
    (st.moving||[]).forEach(m=>{
      if(m.axis==='x'){m.x=sh(m.x);m.min=sh(m.min);m.max=sh(m.max);}else m.x=sh(m.x);
    });
    (st.bricks||[]).forEach(b=>b.x=sh(b.x));
    (st.springs||[]).forEach(p=>p.x=sh(p.x));
    (st.secrets||[]).forEach(p=>p.x=sh(p.x));
    (st.flowers||[]).forEach(p=>p.x=sh(p.x));
    st.enemies.forEach(e=>{e.x=sh(e.x);e.min=sh(e.min);e.max=sh(e.max);});
    const sht=v=>v>=atTile?v+n:v;
    st.water=st.water.map(([a,b])=>[sht(a),a<atTile&&b>atTile?b+n:sht(b)]);
    (st.caves||[]).forEach(c=>{if(c[0]<atTile&&c[1]>atTile)c[1]+=n;else{c[0]=sht(c[0]);c[1]=sht(c[1]);}});
    st.decor.forEach(d=>d[0]=sht(d[0]));
    st.checkpoints=st.checkpoints.map(sht);
    st.goal=sht(st.goal);
    st.worldW+=n;
  }
  // Thicken thin cave walls 2x and widen the narrow caves (applied right→left).
  insertColumns(STAGES[0],241,3); insertColumns(STAGES[0],205,2);                       // S1 walls 3→6, 2→4
  insertColumns(STAGES[2],113,6); insertColumns(STAGES[2],97,2);                        // S3 cave +6, wall 2→4
  insertColumns(STAGES[3],107,2); insertColumns(STAGES[3],104,6); insertColumns(STAGES[3],91,2); // S4 walls 2→4, cave +6

  // V0.24: every ground piece except cave ceilings reaches the world bottom.
  for(const st of STAGES)for(const s of st.solids){
    if(s.kind==='ground'&&!s.slab)s.h=WORLD_H-s.y;
  }
  return STAGES;
};
