import * as THREE from 'three/webgpu';

const fract=x=>x-Math.floor(x);
const hash=(x,y)=>fract(Math.sin(x*127.1+y*311.7)*43758.5453);
const smooth=x=>x*x*(3-2*x);
function noise(x,y){
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(fract(x)),v=smooth(fract(y));
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iy),hash(ix+1,iy),u),THREE.MathUtils.lerp(hash(ix,iy+1),hash(ix+1,iy+1),u),v);
}
const fbm=(x,y)=>noise(x,y)*.55+noise(x*2,y*2)*.25+noise(x*4,y*4)*.13+noise(x*8,y*8)*.07;
function texture(kind){
  const size=512,c=document.createElement('canvas');c.width=c.height=size;
  const ctx=c.getContext('2d'),img=ctx.createImageData(size,size),height=new Float32Array(size*size);
  const rgb={clay:[214,192,161],stone:[99,89,78],linen:[232,216,183],cushion:[125,132,87],wood:[151,110,74],rug:[182,154,112]}[kind];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,u=x/size,v=y/size,n=fbm(u*7,v*7),fine=hash(x,y);
    let shade=.88+n*.21,h=n*.65+fine*.20;
    if(kind==='clay'){shade=.94+n*.08+(fine-.5)*.025;h=n*.25+fine*.15;if(fine>.985){shade-=.14;h-=.2;}}
    if(kind==='stone'){const vein=Math.pow(.5+.5*Math.sin(u*30+v*19+n*12),12);shade=.75+n*.28+vein*.07;h=n*.8+fine*.07;}
    if(kind==='wood'){const grain=.5+.5*Math.sin(u*230+noise(u*12,v*2)*7);shade=.65+n*.28+grain*.23;h=grain*.5+n*.25;}
    if(['linen','cushion','rug'].includes(kind)){
      const spacing=kind==='rug'?8:5,warp=.5+.5*Math.sin(x/spacing*Math.PI*2),weft=.5+.5*Math.sin(y/spacing*Math.PI*2);
      const checker=(Math.floor(x/spacing)+Math.floor(y/spacing))%2;
      h=(checker?warp:weft)*.7+n*.2;shade=.9+h*.07+fine*.025;
      if(kind==='rug'&&(x%128<8||y%128<8))shade*=.86;
    }
    height[i]=h;img.data.set([...rgb.map(c=>Math.min(255,c*shade)),255],i*4);
  }
  ctx.putImageData(img,0,0);const color=new THREE.CanvasTexture(c);color.colorSpace=THREE.SRGBColorSpace;
  const normalCanvas=document.createElement('canvas');normalCanvas.width=normalCanvas.height=size;
  const nc=normalCanvas.getContext('2d'),ni=nc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sx=(x+1)%size,px=(x+size-1)%size,sy=(y+1)%size,py=(y+size-1)%size;
    const dx=(height[y*size+px]-height[y*size+sx])*1.8,dy=(height[py*size+x]-height[sy*size+x])*1.8;
    const n=new THREE.Vector3(dx,dy,1).normalize();ni.data.set([(n.x*.5+.5)*255,(n.y*.5+.5)*255,(n.z*.5+.5)*255,255],(y*size+x)*4);
  }
  nc.putImageData(ni,0,0);const normal=new THREE.CanvasTexture(normalCanvas);
  for(const t of [color,normal]){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;}
  return {color,normal};
}
export function coveRole(name){
  if(/Seedstone/.test(name))return 'stone';
  if(/AmberSeam|BranchSeam/.test(name))return 'ember';
  if(/LightStone/.test(name))return 'lamp';
  if(/MossCushion|LinenPillow_1/.test(name))return 'cushion';
  if(/WovenRug/.test(name))return 'rug';
  if(/Canopy$|Pillow|Lashing/.test(name))return 'linen';
  if(/Mast|Ledge|Inlay/.test(name))return 'wood';
  if(/Garden|Greenery|Leaf|CoreBed|FernStem/.test(name))return 'leaf';
  if(/Bible|Tea|FernSoil/.test(name))return 'prop';
  return 'clay';
}
const sharedTextures=new Map();
export function makeCoveMaterials(){
  const textures=new Map();
  return {
    create(source,role){
      const m=source.clone();
      // Kiln-authored surfaces carry their own maps and UVs; only legacy flat modules are derived here.
      if(source.map)return m;
      if(['clay','stone','linen','cushion','wood','rug'].includes(role)){
        if(!textures.has(role)){let shared=sharedTextures.get(role);if(!shared){shared={...texture(role),refs:0};sharedTextures.set(role,shared);}shared.refs++;textures.set(role,shared);}
        const t=textures.get(role);m.color.set('white');m.map=t.color;m.normalMap=t.normal;
        m.normalScale.setScalar(role==='stone'?.45:role==='clay'?.18:role==='linen'?.16:.3);
        m.roughness=role==='stone'?.72:.94;
      }
      if(role==='ember'){m.color.set('#ffb54e');m.emissive.set('#ff8c24');m.emissiveIntensity=3;}
      if(role==='lamp'){m.emissive.set('#ffa850');m.emissiveIntensity=1.3;}
      if(role==='leaf'){m.color.set('#6b7749');m.roughness=.95;}
      return m;
    },
    dispose(){for(const [role,t] of textures){if(--t.refs===0){t.color.dispose();t.normal.dispose();sharedTextures.delete(role);}}textures.clear();}
  };
}
export function applyCoveUVs(geometry,role){
  if(!['clay','linen','cushion','rug'].includes(role))return;
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=new Float32Array(p.count*2),density=role==='linen'?1.4:role==='cushion'?1.3:1;
  for(let i=0;i<p.count;i++){
    const a=[Math.abs(n.getX(i)),Math.abs(n.getY(i)),Math.abs(n.getZ(i))];
    let u,v;if(a[1]>a[0]&&a[1]>a[2]){u=p.getX(i);v=p.getZ(i);}else if(a[0]>a[2]){u=p.getZ(i);v=p.getY(i);}else{u=p.getX(i);v=p.getY(i);}
    uv[i*2]=u*density;uv[i*2+1]=v*density;
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
}
