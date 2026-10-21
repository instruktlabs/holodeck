const meta = { name: 'Hearth Cove / origin kit', role: 'building' };
async function build() {
  const root = createRoot('HearthCove');
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...extra });
  const clay = mat(0xcabb9e), rim = mat(0xe2d5ba), wood = mat(0x70503a), moss = mat(0x626647), linen = mat(0xd8c6a0, { side: THREE.DoubleSide });
  const core = mat(0x333830, { roughness: 0.42 }), glow = mat(0xeeb571, { emissive: 0xffb456, emissiveIntensity: 2 });
  const add = (name, geo, material, position=[0,0,0], scale=[1,1,1], rotation=[0,0,0]) => createPart(name,geo,material,{parent:root,position,scale,rotation});
  const orb = new THREE.SphereGeometry(1,24,16);
  function arc(name, inner, outer, bottom, top, start, end, material) {
    const shape = new THREE.Shape();
    shape.absarc(0,0,outer,start,end,false);
    shape.lineTo(inner*Math.cos(end),inner*Math.sin(end));
    shape.absarc(0,0,inner,end,start,true); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:true,bevelThickness:0.025,bevelSize:0.025,bevelSegments:2,curveSegments:40,steps:1});
    // Extrusion +Z becomes world +Y; XY profile's second axis becomes -Z.
    add(name,geo,material,[0,bottom,0],[1,1,1],[-90,0,0]);
  }
  add('Platform',new THREE.CylinderGeometry(4.6,4.68,0.22,96),clay,[0,-0.11,0]);
  arc('PlatformInlay',4.46,4.49,0.002,0.009,0,Math.PI*2,wood);
  // Negative profile angles place the enclosure behind the observer and on the left.
  arc('CurvedBack',3.95,4.25,0.02,1.38,-3.65,-0.10,clay);
  arc('SeatPlinth',3.12,3.99,0.02,0.38,-3.6,-0.18,clay);
  arc('SeatTop',3.10,3.99,0.39,0.47,-3.6,-0.18,rim);
  const cushion = await roundedBoxGeo(0.86,0.18,0.67,0.08,{segments:6,smooth:true});
  for(let i=0;i<10;i++){
    const a=0.34+i*0.31;
    add('MossCushion_'+i,cushion,moss,[3.53*Math.cos(a),0.57,3.53*Math.sin(a)],[1,1,1],[0,90-a*180/Math.PI,0]);
  }
  const tableX=-1.12, tableZ=0.08;
  add('TableFoot',new THREE.CylinderGeometry(0.60,0.72,0.64,48),clay,[tableX,0.32,tableZ]);
  add('CreationTable',new THREE.CylinderGeometry(1.19,1.15,0.15,64),rim,[tableX,0.71,tableZ]);
  add('CoreBed',new THREE.CylinderGeometry(0.63,0.67,0.09,48),moss,[tableX,0.83,tableZ]);
  add('KilnSeedstone',orb,core,[tableX,1.12,tableZ],[0.43,0.38,0.38],[0,12,18]);
  const crackPoints=[];
  for(let i=0;i<=40;i++){const t=i/40*Math.PI;crackPoints.push(new THREE.Vector3(0.055*Math.sin(t*5),0.382*Math.cos(t),0.394*Math.sin(t)));}
  const seam = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(crackPoints),64,0.009,6,false);
  add('KilnAmberSeam',seam,glow,[tableX,1.12,tableZ],[1,1,1]);
  for(let i=0;i<17;i++) {
    const a=i*2.4;
    add('CoreGarden_'+i,orb,moss,[tableX+Math.cos(a)*0.52,0.91,tableZ+Math.sin(a)*0.5],[0.075,0.07,0.06]);
  }
  const paper=mat(0xece0c3),cover=mat(0x756d50);
  add('BibleCover',await roundedBoxGeo(0.38,0.045,0.50,0.015,{segments:4}),cover,[-0.40,0.81,0.48],[1,1,1],[0,-22,0]);
  add('BiblePages',new THREE.BoxGeometry(0.35,0.04,0.46),paper,[-0.40,0.845,0.48],[1,1,1],[0,-22,0]);
  add('TeaCup',new THREE.CylinderGeometry(0.09,0.07,0.12,24,1,true),rim,[-1.68,0.85,0.64]);
  add('Tea',new THREE.CircleGeometry(0.078,24),wood,[-1.68,0.898,0.64],[1,1,1],[-90,0,0]);
  // Four timber masts support the sagging linen at its exact corners.
  for(const [i,x,z] of [[0,-3.25,-1.7],[1,2.55,-1.7],[2,-3.25,2.55],[3,2.55,2.55]]) {
    add('CanopyMast_'+i,new THREE.CylinderGeometry(0.065,0.10,3.25,10),wood,[x,1.625,z]);
    for(let j=0;j<4;j++) add('Lashing_'+i+'_'+j,new THREE.TorusGeometry(0.079,0.012,5,12),linen,[x,3.06+j*0.025,z],[1,1,1],[90,0,0]);
  }
  const canopy=parametricSurface((u,v)=>[u,3.22-0.42*Math.sin((u+3.25)/5.8*Math.PI)-0.22*Math.sin((v+1.7)/4.25*Math.PI)+0.025*Math.sin(u*13)*Math.sin((v+1.7)/4.25*Math.PI),v],{u:[-3.25,2.55],v:[-1.7,2.55],uSegments:48,vSegments:32});
  add('LinenCanopy',canopy,linen);
  for(const [i,x,z] of [[0,-3.45,-1.55],[1,3.3,0.9]]) {
    add('LightStone_'+i,orb,mat(0xf6d7a2,{emissive:0xdba85e,emissiveIntensity:0.7}),[x,0.7,z],[0.20,0.31,0.19]);
    add('LightBase_'+i,new THREE.CylinderGeometry(0.24,0.28,0.10,24),clay,[x,0.45,z]);
  }
  const railGeo=await roundedBoxGeo(1.8,0.08,0.24,0.025,{segments:4});
  add('ReferenceLedge',railGeo,wood,[-2.8,1.08,1.65],[1,1,1],[0,-35,0]);
  for(let i=0;i<2;i++) add('ReferenceFrame_'+i,await roundedBoxGeo(0.78,0.61,0.055,0.023,{segments:4}),rim,[-3.12+i*0.68,1.43,1.45+i*0.48],[1,1,1],[0,-35,0]);
  // Deliberate sculpted foliage, all deterministic and attached to the back rim.
  for(let i=0;i<32;i++) {
    const a=0.4+i*0.094, x=4.02*Math.cos(a),z=4.02*Math.sin(a);
    add('RimGreenery_'+i,orb,moss,[x,1.43+0.06*Math.sin(i*2),z],[0.19,0.10,0.19]);
  }
  // Export with the Kiln asset convention: +X faces out of the cove.
  root.rotation.y=-Math.PI/2;
  return root;
}
