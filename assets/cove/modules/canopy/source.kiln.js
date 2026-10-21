const meta = { name: 'Cove / linen canopy and timber supports', role: 'building' };
async function build() {
  const root = createRoot('HearthCove');
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, ...extra });
  const clay = mat(0xc8aa89), rim = mat(0xdbc5a4), wood = mat(0x8c6344), moss = mat(0x70734f), linen = mat(0xe9d5b0, { side: THREE.DoubleSide });
  const core = mat(0x4d453e, { roughness: 0.78 }), glow = mat(0xeeb571, { emissive: 0xffb456, emissiveIntensity: 2 });
  const add = (name, geo, material, position=[0,0,0], scale=[1,1,1], rotation=[0,0,0]) => createPart(name,geo,material,{parent:root,position,scale,rotation});
  const orb = new THREE.SphereGeometry(1,24,16);
  function arc(name, inner, outer, bottom, top, start, end, material) {
    const shape = new THREE.Shape();
    shape.absarc(0,0,outer,start,end,false);
    shape.lineTo(inner*Math.cos(end),inner*Math.sin(end));
    shape.absarc(0,0,inner,end,start,true); shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{depth:top-bottom,bevelEnabled:true,bevelThickness:0.025,bevelSize:0.025,bevelSegments:2,curveSegments:40,steps:1});
    if(name==='CurvedBack'||name==='SeatTop') {
      const p=geo.attributes.position;
      for(let i=0;i<p.count;i++) {
        const x=p.getX(i),y=p.getY(i),z=p.getZ(i),r=Math.hypot(x,y);
        const wobble=.018*Math.sin(x*2.2+y*3.1)+.008*Math.sin(x*9-y*5);
        p.setXYZ(i,x+x/r*wobble,y+y/r*wobble,z+.045*Math.sin(x*1.4+y*.8)*Math.max(0,z/(top-bottom)));
      }
      geo.computeVertexNormals();
    }
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
  function stonePoint(x,y,z,offset=0) {
    const radial=1+0.11*Math.sin(x*3.4+y*1.8+.4)*Math.sin(z*4.2-y)+0.035*Math.sin(x*12+y*7+z*9);
    return new THREE.Vector3(x*(radial+offset)*.49+y*.055,y*(radial+offset)*.39,z*(radial+offset)*.405);
  }
  const stoneGeo=new THREE.SphereGeometry(1,64,40).toNonIndexed();
  const vertices=stoneGeo.attributes.position;
  for(let i=0;i<vertices.count;i++) { const p=stonePoint(vertices.getX(i),vertices.getY(i),vertices.getZ(i));vertices.setXYZ(i,p.x,p.y,p.z); }
  stoneGeo.computeVertexNormals();
  const smoothNormals=new Map(),sn=stoneGeo.attributes.normal;
  const vertexKey=i=>[vertices.getX(i),vertices.getY(i),vertices.getZ(i)].map(n=>Math.round(n*100000)).join(',');
  for(let i=0;i<vertices.count;i++){const key=vertexKey(i);if(!smoothNormals.has(key))smoothNormals.set(key,new THREE.Vector3());smoothNormals.get(key).add(new THREE.Vector3(sn.getX(i),sn.getY(i),sn.getZ(i)));}
  for(let i=0;i<vertices.count;i++){const n=smoothNormals.get(vertexKey(i)).clone().normalize();sn.setXYZ(i,n.x,n.y,n.z);}
  add('KilnSeedstone',stoneGeo,core,[tableX,1.22,tableZ]);
  function fissure(name,from,to,branch=false) {
    const points=[];
    for(let i=0;i<=90;i++) {
      const t=from+(to-from)*i/90;
      const x=(branch?.16+.32*(i/90):.10*Math.sin(t*4)+.035*Math.sin(t*15));
      const yz=Math.sqrt(1-x*x);
      points.push(stonePoint(x,yz*Math.cos(t),yz*Math.sin(t),.013));
    }
    add(name,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),110,branch?.004:.007,6,false),glow,[tableX,1.22,tableZ]);
  }
  fissure('KilnAmberSeam',.13,3.02);
  fissure('KilnBranchSeam',1.25,2.35,true);
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
  // The reference board is now a separately movable Kiln asset.
  // Small earthen pockets give each fern a visible planted attachment above the wall.
  const leafMaterial=mat(0x526638,{side:THREE.DoubleSide});
  const stemMaterial=mat(0x657448);
  function leaflet(length,width){
    const p=[0,0,0],uv=[0,.5],indices=[];
    for(let i=1;i<7;i++){const t=i/7,w=Math.sin(t*Math.PI)*width;p.push(-w,Math.sin(t*Math.PI)*.018,t*length,w,Math.sin(t*Math.PI)*.018,t*length);uv.push(0,t,1,t);}
    p.push(0,0,length);uv.push(.5,1);indices.push(0,1,2);
    for(let i=0;i<5;i++){const k=1+i*2;indices.push(k,k+2,k+1,k+1,k+2,k+3);}indices.push(11,13,12);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
  }
  const fernLeaf=leaflet(.14,.035);
  for(let i=0;i<11;i++){
    const a=.4+i*.28,x=4.08*Math.cos(a),z=4.08*Math.sin(a),base=1.50+.045*Math.sin(x*1.4-z*.8);
    add('FernPocket_'+i,new THREE.CylinderGeometry(.14,.105,.10,18),clay,[x,base-.045,z]);
    add('FernSoil_'+i,new THREE.CircleGeometry(.125,18),mat(0x403a2b),[x,base+.007,z],[1,1,1],[-90,0,0]);
    for(let j=0;j<5;j++){
      const angle=a+j*2.4,reach=.28+.10*Math.sin(i+j),height=.25+.09*Math.cos(i*2+j);
      const points=[];for(let k=0;k<=12;k++){const t=k/12;points.push(new THREE.Vector3(x+Math.cos(angle)*reach*t,base+height*Math.sin(t*2.1),z+Math.sin(angle)*reach*t));}
      add('FernStem_'+i+'_'+j,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),16,.004,4,false),stemMaterial);
      for(let k=2;k<11;k++)for(const side of [-1,1]){
        const t=k/12,p=points[k],size=Math.sin(t*Math.PI)*(.7+.2*Math.sin(i+j));
        add('FernLeaf_'+i+'_'+j+'_'+k+'_'+side,fernLeaf,leafMaterial,[p.x,p.y,p.z],[size,size,size],[20,90-angle*180/Math.PI+side*65,side*18]);
      }
    }
  }
  // Soft textiles and small climbing leaves bring the origin kit to human scale.
  const pillow=await roundedBoxGeo(.70,.58,.22,.10,{segments:8,smooth:true});
  for(let i=0;i<3;i++){
    const a=1.8+i*.62;
    add('LinenPillow_'+i,pillow,i===1?moss:linen,[3.68*Math.cos(a),.975,3.68*Math.sin(a)],[1,1,1],[8,90-a*180/Math.PI,0]);
  }
  add('WovenRug',new THREE.CylinderGeometry(1,1,.016,80),linen,[.45,.012,.7],[2.1,1,1.65]);
  const leaf=new THREE.SphereGeometry(1,10,7);
  for(let i=0;i<30;i++){
    const y=.5+i*.075,x=-3.25+.12*Math.cos(i*1.8),z=-1.7+.12*Math.sin(i*1.8);
    add('ClimbingLeaf_'+i,leaf,moss,[x,y,z],[.10,.028,.17],[i*17,i*73,30]);
  }
  // Export with the Kiln asset convention: +X faces out of the cove.
  root.rotation.y=-Math.PI/2;
  for(const child of [...root.children]){if(!/CanopyMast|Lashing|LinenCanopy|ClimbingLeaf/.test(child.name))root.remove(child);else child.position.sub(new THREE.Vector3(0,0,0));}
  return root;
}
