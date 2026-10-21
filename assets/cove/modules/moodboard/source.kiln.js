const meta={name:'Cove mood board / timber easel',role:'prop'};
async function build(){
  const root=createRoot('MoodBoard');
  const timber=new THREE.MeshStandardMaterial({color:0x8a6344,roughness:.78});
  const brass=new THREE.MeshStandardMaterial({color:0x998369,metalness:.55,roughness:.5});
  const charcoal=new THREE.MeshStandardMaterial({color:0x24271f,roughness:.85});
  const add=(name,g,m,p,r=[0,0,0])=>createPart(name,g,m,{parent:root,position:p,rotation:r});
  // Frame faces +X. The host places a live board surface at X=.081.
  add('BoardBacking',await roundedBoxGeo(.10,1.52,2.52,.045,{segments:6}),charcoal,[0,1.72,0]);
  for(const z of [-1.29,1.29])add('TimberSide_'+z,await roundedBoxGeo(.14,1.66,.085,.02,{segments:4}),timber,[.005,1.72,z]);
  for(const y of [.93,2.51])add('TimberRail_'+y,await roundedBoxGeo(.14,.085,2.58,.02,{segments:4}),timber,[.005,y,0]);
  for(const z of [-.93,.93]){
    add('TimberUpright_'+z,await roundedBoxGeo(.12,2.25,.12,.02,{segments:4}),timber,[-.075,1.20,z]);
    add('TimberFoot_'+z,await roundedBoxGeo(.75,.10,.23,.035,{segments:5}),timber,[-.05,.05,z]);
    add('BrassJoint_'+z,new THREE.CylinderGeometry(.04,.04,.018,20),brass,[.052,1.10,z],[0,0,90]);
  }
  add('TimberTray',await roundedBoxGeo(.25,.07,2.35,.018,{segments:4}),timber,[.10,.89,0]);
  return root;
}
