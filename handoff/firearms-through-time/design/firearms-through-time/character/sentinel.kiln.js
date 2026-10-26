const meta = { name: 'Sentinel — restrained advanced soldier prototype' };
async function build() {
 const root = createRoot('Sentinel');
 root.userData = { role:'character-prototype', stage:'static-rigid-concept', forward:'+X', units:'metres', animationReady:false };
 const armor=gameMaterial(0x69756b,{roughness:.64,metalness:.25,flatShading:false});
 const edge=gameMaterial(0x404c48,{roughness:.65,metalness:.15,flatShading:false});
 const cloth=gameMaterial(0x333e43,{roughness:.94,flatShading:false});
 const rubber=gameMaterial(0x242b30,{roughness:.85,flatShading:false});
 const tan=gameMaterial(0xa69b81,{roughness:.82,flatShading:false});
 const glass=gameMaterial(0x304e58,{roughness:.23,metalness:.55,flatShading:false});
 const accent=gameMaterial(0xcbab64,{roughness:.6,metalness:.2,flatShading:false});
 function group(name,pos,parent=root) {const g=new THREE.Group();g.name=name;g.position.set(...pos);parent.add(g);return g;}
 async function box(name,size,pos,mat,parent=root,r=.012) {return createPart(name,await roundedBoxGeo(...size,r,{segments:3}),mat,{position:pos,parent});}
 function ell(name,size,pos,mat,parent=root) {return createPart(name,sphereGeo(1,20,14),mat,{position:pos,scale:size,parent});}
 function profile(d,w){return [[d*.7,-w],[d,-w*.65],[d,w*.65],[d*.7,w],[-d*.7,w],[-d,w*.65],[-d,-w*.65],[-d*.7,-w]];}
 function loft(name,rows,mat,parent=root){return createPart(name,loftProfiles(rows.map(r=>({profile:profile(r[1],r[2]),frame:{origin:[r[3]||0,r[0],0]}}))),mat,{parent});}
 const pelvis=group('Joint_Pelvis',[0,1.0,0]);
 loft('PelvisUndersuit',[[-.12,.105,.14],[.02,.115,.16],[.10,.095,.14]],cloth,pelvis);
 await box('Belt',[.255,.07,.33],[0,.045,0],rubber,pelvis,.018);
 await box('Buckle',[.025,.043,.065],[.14,.047,0],accent,pelvis,.007);
 const chest=group('Joint_Spine',[0,.09,0],pelvis);
 loft('TorsoFabric',[[0,.10,.14],[.17,.125,.19],[.36,.13,.23],[.47,.105,.19]],cloth,chest);
 loft('ChestArmor',[[.12,.127,.16,.016],[.23,.152,.205,.016],[.36,.153,.225,.016],[.43,.12,.19,.016]],armor,chest);
 await box('SternumInset',[.018,.15,.07],[.173,.28,0],edge,chest,.006);
 for(const z of [-.115,.115]) {
  await box('ChestLatch'+z,[.028,.035,.045],[.17,.38,z],tan,chest,.006);
  await box('Harness'+z,[.035,.19,.042],[.13,.445,z],edge,chest,.009);
 }
 for(let i=0;i<3;i++) await box('AbdominalPlate'+i,[.045,.055,.27-i*.018],[.12,.095-i*.064,0],armor,chest,.012);
 await box('BackPanel',[.09,.30,.30],[-.14,.27,0],armor,chest,.025);
 await box('BackServiceSpine',[.025,.22,.065],[-.195,.27,0],edge,chest,.009);
 for(let i=0;i<3;i++) await box('BackVent'+i,[.018,.014,.14],[-.212,.31-i*.038,0],rubber,chest,.004);
 ell('NeckSeal',[.073,.09,.078],[0,.53,0],rubber,chest);
 const head=group('Joint_Head',[0,.64,0],chest);
 ell('HelmetShell',[.145,.166,.129],[0,0,0],armor,head);
 ell('DarkVisor',[.047,.068,.116],[.125,.015,0],glass,head);
 await box('BrowRim',[.065,.025,.232],[.114,.083,0],edge,head,.01);
 await box('JawGuard',[.13,.068,.172],[.075,-.10,0],edge,head,.02);
 await box('ChinInsert',[.032,.04,.082],[.15,-.105,0],rubber,head,.009);
 for(const side of [-1,1]){
  const suffix=side<0?'L':'R';
  await box('EarComms'+suffix,[.11,.10,.033],[-.015,-.005,side*.127],edge,head,.012);
  await box('HelmetMarker'+suffix,[.055,.018,.015],[.007,.043,side*.148],accent,head,.005);
  const arm=group('Joint_Shoulder_'+suffix,[0,.40,side*.255],chest);
  arm.rotation.x=side*-.12;
  ell('ShoulderFabric'+suffix,[.09,.095,.09],[0,-.035,side*.02],cloth,arm);
  ell('ShoulderArmor'+suffix,[.115,.085,.12],[.008,.015,side*.025],armor,arm);
  loft('UpperArm'+suffix,[[-.28,.068,.073],[-.17,.075,.087],[-.04,.08,.083]],cloth,arm);
  await box('BicepGuard'+suffix,[.095,.16,.05],[.035,-.14,side*.069],armor,arm,.018);
  const elbow=group('Joint_Elbow_'+suffix,[0,-.30,0],arm);
  ell('ElbowSeal'+suffix,[.065,.07,.068],[0,0,0],rubber,elbow);
  loft('Forearm'+suffix,[[-.25,.055,.06],[-.10,.075,.077],[-.025,.071,.07]],cloth,elbow);
  loft('ForearmPlate'+suffix,[[-.225,.055,.05,.035],[-.07,.065,.066,.035]],armor,elbow);
  await box('WristBand'+suffix,[.125,.04,.135],[0,-.25,0],edge,elbow,.012);
  const wrist=group('Joint_Wrist_'+suffix,[.005,-.31,0],elbow);
  await box('Glove'+suffix,[.09,.135,.105],[.008,-.035,0],rubber,wrist,.025);
  ell('Thumb'+suffix,[.035,.055,.032],[.048,-.015,-side*.045],rubber,wrist);
  await box('KnuckleGuard'+suffix,[.025,.055,.083],[.061,-.035,0],armor,wrist,.009);
  const hip=group('Joint_Hip_'+suffix,[0,-.08,side*.105],pelvis);
  loft('ThighFabric'+suffix,[[-.40,.078,.082],[-.22,.10,.097],[0,.105,.10]],cloth,hip);
  loft('ThighPlate'+suffix,[[-.32,.047,.068,.078],[-.09,.055,.083,.078]],armor,hip);
  await box('ThighStrap'+suffix,[.19,.035,.183],[0,-.22,0],rubber,hip,.012);
  await box('UtilityPouch'+suffix,[.09,.13,.075],[-.005,-.06,side*.10],tan,hip,.015);
  const knee=group('Joint_Knee_'+suffix,[0,-.42,0],hip);
  ell('KneeFlex'+suffix,[.074,.075,.077],[0,0,0],rubber,knee);
  await box('KneeArmor'+suffix,[.075,.11,.14],[.071,-.005,0],armor,knee,.026);
  loft('Calf'+suffix,[[-.34,.066,.067],[-.18,.085,.079],[-.05,.078,.075]],cloth,knee);
  loft('ShinPlate'+suffix,[[-.31,.035,.053,.066],[-.07,.044,.065,.066]],armor,knee);
  const ankle=group('Joint_Ankle_'+suffix,[0,-.36,0],knee);
  await box('BootUpper'+suffix,[.18,.16,.155],[.018,-.005,0],edge,ankle,.025);
  await box('BootFoot'+suffix,[.30,.12,.17],[.065,-.08,0],rubber,ankle,.028);
  await box('BootToe'+suffix,[.105,.07,.163],[.16,-.045,0],armor,ankle,.018);
  await box('BootSole'+suffix,[.31,.03,.178],[.065,-.125,0],rubber,ankle,.009);
  for(let i=0;i<3;i++) await box('BootLace'+suffix+i,[.015,.012,.11],[.10+i*.025,.003,0],tan,ankle,.004);
 }
 return root;
}
