// Pattern 1742 musket v3 (ramrod owner) against v2: game-mesh triangle checks on the exact GLBs (round v14).
// Usage (workspace root): node pipeline/flintlock-v3-verify.mjs <v3.glb> [v2.glb] [out.json]
// Proves the v3 split moved only the stored ramrod's triangles into Joint_Ramrod: same triangle count, the same
// world-space triangles (positions, normals, UVs at 1e-5 m) per material, identical world-space ramrod vertices at rest,
// every other node, extra, clip, material and texture unchanged, and root extras under Kiln's 4096-byte limit.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadMusket,clearance,transformTris} from './flintlock-geometry.mjs';
const [v3Path,v2Path='authoring/assets/kiln/a_0a31fd5eeb864b529202724a65de4623/revisions/r_209f60c0d25c48c78b470b192e5f5942/asset.glb',outPath]=process.argv.slice(2);
if(!v3Path)throw Error('usage: flintlock-v3-verify.mjs <v3.glb> [v2.glb] [out.json]');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const ident=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
function mul(a,b){const c=Array(16).fill(0);for(let r=0;r<4;r++)for(let k=0;k<4;k++)for(let j=0;j<4;j++)c[j*4+r]+=a[k*4+r]*b[j*4+k];return c;}
function trs(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){const [x,y,z,w]=q;return [(1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0,...t,1];}
const local=n=>n.matrix??trs(n.translation,n.rotation,n.scale);
function transform(m,v,normal=false){const a=[m[0]*v[0]+m[4]*v[1]+m[8]*v[2]+(normal?0:m[12]),m[1]*v[0]+m[5]*v[1]+m[9]*v[2]+(normal?0:m[13]),m[2]*v[0]+m[6]*v[1]+m[10]*v[2]+(normal?0:m[14])];if(normal){const l=Math.hypot(...a)||1;return a.map(x=>x/l);}return a;}
const R5=a=>a.map(x=>Math.round(x*1e5));
function load(path){
 const b=fs.readFileSync(path);let json,bin;for(let off=12;off<b.length;){const len=b.readUInt32LE(off),kind=b.readUInt32LE(off+4),data=b.subarray(off+8,off+8+len);if(kind===0x4e4f534a)json=JSON.parse(data.toString());if(kind===0x004e4942)bin=data;off+=8+len;}
 function accessor(index){const a=json.accessors[index],v=json.bufferViews[a.bufferView],sizes={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},bytes={5121:1,5123:2,5125:4,5126:4},count=sizes[a.type],size=bytes[a.componentType],start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??count*size,out=[];for(let i=0;i<a.count;i++){const p=[];for(let j=0;j<count;j++){const at=start+i*stride+j*size;p.push(a.componentType===5126?bin.readFloatLE(at):a.componentType===5125?bin.readUInt32LE(at):a.componentType===5123?bin.readUInt16LE(at):bin.readUInt8(at));}out.push(p);}return out;}
 const tris=[],nodes=[],verts=[];let draws=0,vertexCount=0;
 function walk(index,parent,owners){const n=json.nodes[index],m=mul(parent,local(n)),own=/^Joint_/.test(n.name??'')?[...owners,n.name]:owners;
  nodes.push({name:n.name,parent:owners.at(-1)??'root',worldMatrix:m.map(x=>Math.round(x*1e7)/1e7),extras:n.extras??null,mesh:n.mesh!==undefined});
  if(n.mesh!==undefined)for(const p of json.meshes[n.mesh].primitives){draws++;const pos=accessor(p.attributes.POSITION),norm=accessor(p.attributes.NORMAL),uv=accessor(p.attributes.TEXCOORD_0),idx=p.indices===undefined?pos.map((_,i)=>i):accessor(p.indices).flat(),mat=json.materials[p.material]?.name??'';vertexCount+=pos.length;
   const W=pos.map(v=>transform(m,v)),N=norm.map(v=>transform(m,v,true));
   for(let i=0;i<pos.length;i++)verts.push({mesh:n.name,mat,p:W[i],n:N[i],uv:uv[i],local:pos[i]});
   for(let i=0;i<idx.length;i+=3){const k=idx.slice(i,i+3);tris.push({mesh:n.name,owner:own.at(-1)??'root',mat,points:k.map(j=>W[j]),key:mat+'|'+k.map(j=>[...R5(W[j]),...R5(N[j]),...uv[j].map(x=>Math.round(x*1e5))].join(',')).sort().join('|')});}}
  for(const c of n.children??[])walk(c,m,own);}
 for(const n of json.scenes[json.scene??0].nodes)walk(n,ident(),[]);
 const clips=(json.animations??[]).map(a=>({name:a.name,channels:a.channels.map(c=>({target:json.nodes[c.target.node].name,path:c.target.path,interpolation:a.samplers[c.sampler].interpolation??'LINEAR',input:accessor(a.samplers[c.sampler].input),output:accessor(a.samplers[c.sampler].output)}))}));
 const images=(json.images??[]).map(im=>{const v=json.bufferViews[im.bufferView];return {name:im.name??null,mimeType:im.mimeType,sha256:hash(bin.subarray(v.byteOffset??0,(v.byteOffset??0)+v.byteLength))};});
 return {path,sha256:hash(b),bytes:b.length,json,tris,nodes,verts,draws,vertexCount,clips,images,materials:json.materials,textures:json.textures??[],samplers:json.samplers??[]};}
const v2=load(v2Path),v3=load(v3Path),ROOT='Flintlock1742_Exterior',RAM='Joint_Ramrod',RAM_MESH='Mesh_Joint_Ramrod_Flintlock_Steel';
const N2=Object.fromEntries(v2.nodes.map(n=>[n.name,n])),N3=Object.fromEntries(v3.nodes.map(n=>[n.name,n])),pos=n=>n.worldMatrix.slice(12,15);
const count=keys=>{const m=new Map();for(const k of keys)m.set(k,(m.get(k)??0)+1);return m;};
const diff=(A,B)=>{const a=count(A),b=count(B);let onlyA=0,onlyB=0;for(const [k,n]of a)onlyA+=Math.max(0,n-(b.get(k)??0));for(const [k,n]of b)onlyB+=Math.max(0,n-(a.get(k)??0));return {onlyA,onlyB};};
// 1. Counts and per-material world-space triangle multisets (mesh node ignored: the ramrod moved to its own mesh).
const mats=[...new Set([...v2.tris,...v3.tris].map(t=>t.mat))].sort();
const perMaterial=Object.fromEntries(mats.map(mat=>{const a=v2.tris.filter(t=>t.mat===mat),b=v3.tris.filter(t=>t.mat===mat),d=diff(a.map(t=>t.key),b.map(t=>t.key));
 const va=v2.verts.filter(v=>v.mat===mat),vb=v3.verts.filter(v=>v.mat===mat),vk=v=>[...R5(v.p),...R5(v.n),...v.uv.map(x=>Math.round(x*1e5))].join(),ua=new Set(va.map(vk)),ub=new Set(vb.map(vk));
 const uniqueEqual=ua.size===ub.size&&[...ua].every(k=>ub.has(k));
 return [mat,{trianglesV2:a.length,trianglesV3:b.length,verticesV2:va.length,verticesV3:vb.length,uniqueVerticesV2:ua.size,uniqueVerticesV3:ub.size,uniqueVertexSetsEqual:uniqueEqual,onlyInV2:d.onlyA,onlyInV3:d.onlyB,identical:a.length===b.length&&d.onlyA===0&&d.onlyB===0&&uniqueEqual}];}));
const weldNote='Exported vertex buffers are welded per primitive; the ramrod is now its own primitive, so vertices it shared with other Body steel parts in v2 are stored once more in v3. The distinct (position, normal, UV) vertices per material are the same sets.';
// 2. Per mesh: v3 Body steel + v3 ramrod mesh equals v2 Body steel; every other mesh identical by name.
const meshNames=[...new Set([...v2.tris,...v3.tris].map(t=>t.mesh))].sort();
const perMesh=Object.fromEntries(meshNames.map(name=>{const a=v2.tris.filter(t=>t.mesh===name),b=v3.tris.filter(t=>t.mesh===name),d=diff(a.map(t=>t.key),b.map(t=>t.key));return [name,{v2:a.length,v3:b.length,onlyInV2:d.onlyA,onlyInV3:d.onlyB}];}));
// v2 ramrod triangles by authored part (StoredRamrod and RamrodTip boxes, steel, Joint_Body owner).
const m2=await loadMusket(v2Path),m3=await loadMusket(v3Path);
const ramV2=m2.byPart.filter(p=>p.owner==='Joint_Body'&&['StoredRamrod','RamrodTip'].includes(p.role)).flatMap(p=>p.tris);
const ramV3=v3.tris.filter(t=>t.mesh===RAM_MESH);
const keyP=t=>t.map(p=>R5(p).join(',')).sort().join('|');
const ramDiff=diff(ramV2.map(keyP),ramV3.map(t=>keyP(t.points)));
const bodySteelV2=v2.tris.filter(t=>t.mesh==='Mesh_Joint_Body_Flintlock_Steel').map(t=>t.key),bodySteelV3=v3.tris.filter(t=>t.mesh==='Mesh_Joint_Body_Flintlock_Steel').map(t=>t.key);
const splitDiff=diff(bodySteelV2,[...bodySteelV3,...ramV3.map(t=>t.key)]);
// 3. Ramrod vertex identity: each v3 ramrod vertex (world, at rest) against the nearest v2 steel vertex with the same UV and normal.
const bucket=new Map();for(const v of v2.verts.filter(v=>v.mesh==='Mesh_Joint_Body_Flintlock_Steel')){const k=v.uv.map(x=>Math.round(x*1e5)).join()+'|'+v.n.map(x=>Math.round(x*1e4)).join();if(!bucket.has(k))bucket.set(k,[]);bucket.get(k).push(v);}
let worstVertex={d:0},matched=0;const ramVerts=v3.verts.filter(v=>v.mesh===RAM_MESH);
for(const v of ramVerts){const k=v.uv.map(x=>Math.round(x*1e5)).join()+'|'+v.n.map(x=>Math.round(x*1e4)).join(),c=bucket.get(k)??[];let best=Infinity;for(const w of c){const d=Math.hypot(v.p[0]-w.p[0],v.p[1]-w.p[1],v.p[2]-w.p[2]);if(d<best)best=d;}if(best<1e-4)matched++;if(best>worstVertex.d)worstVertex={d:best,at:v.p};}
const ramLocal=ramVerts.map(v=>v.local),lx=ramLocal.map(p=>p[0]),lr=ramLocal.map(p=>Math.hypot(p[1],p[2]));
const ramrodFrame={node:RAM,worldPosition:pos(N3[RAM]),worldRotationIdentity:JSON.stringify(N3[RAM].worldMatrix.slice(0,12))===JSON.stringify([1,0,0,0,0,1,0,0,0,0,1,0]),localXRange:[Math.min(...lx),Math.max(...lx)],maxRadiusM:Math.max(...lr),extras:N3[RAM].extras,
 note:'Origin at the head end face (local x max 0); the rod runs back along local -X, so drawing it is +X (toward the muzzle).'};
// 4. Free draw: the rod's rear end must pass the front pipe and rim; then the drawn rod is clear of the body at drawMetres.
const near=t=>t.every(p=>Math.abs(p[1]+.04)<.008&&Math.abs(p[2])<.008);
const pipes=m3.byPart.filter(p=>p.owner==='Joint_Body'&&['RamrodPipe','PipeRim','EntryPipeApron'].includes(p.role)).flatMap(p=>p.tris);
const pipeFront=Math.max(...pipes.flat().map(p=>p[0])),rodRear=Math.min(...ramV3.flatMap(t=>t.points.map(p=>p[0]))),rodTris=ramV3.map(t=>t.points);
const body=m3.byPart.filter(p=>p.owner==='Joint_Body').flatMap(p=>p.tris),wood=m3.byPart.filter(p=>p.owner==='Joint_Body'&&p.role==='WalnutFurniture').flatMap(p=>p.tris);
const drawAt=d=>transformTris(rodTris,p=>[p[0]+d,p[1],p[2]]);
const clearAt=d=>{const q=clearance(drawAt(d),body.filter(t=>t.some(p=>p[0]>rodRear+d-.01)));return {drawM:d,clearanceMM:q.distance===null?null:+(q.distance*1000).toFixed(2),intersects:q.intersects};};
const DRAW=.93,freeDraw={pipeFrontX:pipeFront,rodRearX:rodRear,freeDrawM:pipeFront-rodRear,checks:[clearAt(.90),clearAt(.912),clearAt(DRAW)],chosenDrawM:DRAW,basis:'Model: rear end passes the front pipe rim; 18 mm margin (motion.ramrod.drawMetres)'};
// 5. Nodes, extras, clips, materials, textures.
const moved=new Set(['part_StoredRamrod_0','part_RamrodTip_0']);
const nodeDiffs=[];for(const a of v2.nodes){const b=N3[a.name];if(!b){nodeDiffs.push({name:a.name,status:'missing'});continue;}
 let ea=a.extras,eb=b.extras;if(a.name===ROOT&&eb){const {lock,...rest}=eb;eb=rest;}
 const mat=JSON.stringify(a.worldMatrix)!==JSON.stringify(b.worldMatrix),ex=JSON.stringify(ea)!==JSON.stringify(eb),par=a.parent!==b.parent;
 if(mat||ex||par)nodeDiffs.push({name:a.name,status:'changed',matrixChanged:mat,extrasChanged:ex,parentChanged:par,v2Parent:a.parent,v3Parent:b.parent});}
const movedMarkers=[...moved].map(name=>{const a=N2[name],b=N3[name],o=pos(N3[RAM]),sa=a.extras.sourceBounds,sb=b.extras.sourceBounds;
 const err=Math.max(...[0,1,2].flatMap(k=>[Math.abs(sb.min[k]+o[k]-sa.min[k]),Math.abs(sb.max[k]+o[k]-sa.max[k])]));return {name,v2Parent:a.parent,v3Parent:b.parent,sourceBoundsShiftErrorM:err,roleEqual:a.extras.role===b.extras.role};});
const unexpected=nodeDiffs.filter(d=>!moved.has(d.name));
const added=v3.nodes.filter(n=>!N2[n.name]).map(n=>({name:n.name,parent:n.parent,position:pos(n),extras:n.extras}));
const expectedAdded=['Joint_Ramrod',RAM_MESH,'anchor_interaction_ramrod','anchor_vfx_pan'];
const rootExtras=N3[ROOT].extras,rootBytes=Buffer.byteLength(JSON.stringify(rootExtras)),rootBytesV2=Buffer.byteLength(JSON.stringify(N2[ROOT].extras));
const clipsEqual=JSON.stringify(v2.clips)===JSON.stringify(v3.clips),materialsEqual=JSON.stringify(v2.materials)===JSON.stringify(v3.materials),
 texturesEqual=JSON.stringify(v2.images)===JSON.stringify(v3.images)&&JSON.stringify(v2.textures)===JSON.stringify(v3.textures)&&JSON.stringify(v2.samplers)===JSON.stringify(v3.samplers);
// 6. New anchors on geometry.
const panTop=m3.byPart.filter(p=>p.role==='PanExterior').flatMap(p=>p.tris);let A=0;const c=[0,0,0];for(const t of panTop){const e1=t[1].map((v,i)=>v-t[0][i]),e2=t[2].map((v,i)=>v-t[0][i]),n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],l=Math.hypot(...n);if(l<1e-12||n[1]/l<.99)continue;A+=l/2;for(let k=0;k<3;k++)c[k]+=l/2*(t[0][k]+t[1][k]+t[2][k])/3;}
const panCentroid=c.map(v=>v/A),vfxPan=pos(N3.anchor_vfx_pan),grasp=pos(N3.anchor_interaction_ramrod);
const tipBox=m3.parts.find(p=>p.role==='RamrodTip');
const anchors={anchor_vfx_pan:{position:vfxPan,panTopCentroid:panCentroid,errorM:Math.hypot(...vfxPan.map((v,i)=>v-panCentroid[i]))},anchor_interaction_ramrod:{position:grasp,ramrodTipBox:tipBox&&{min:tipBox.min,max:tipBox.max},insideTipBox:!!tipBox&&grasp.every((v,i)=>v>=tipBox.min[i]-1e-6&&v<=tipBox.max[i]+1e-6)}};
const out={schema:'flintlock-1742-v3-ramrod.comparison.v1',generated:new Date().toISOString(),
 v2:{path:v2.path,sha256:'sha256:'+v2.sha256,bytes:v2.bytes,triangles:v2.tris.length,vertices:v2.vertexCount,draws:v2.draws,nodes:v2.nodes.length},
 v3:{path:v3.path,sha256:'sha256:'+v3.sha256,bytes:v3.bytes,triangles:v3.tris.length,vertices:v3.vertexCount,draws:v3.draws,nodes:v3.nodes.length},
 method:'World-space triangles at rest keyed by material and sorted vertex (position, normal at 1e-5; UV at 1e-5); multiset differences per material and per mesh. Ramrod vertices matched to the nearest v2 steel vertex with the same UV and normal.',
 perMaterial,weldNote,perMesh,ramrod:{v2Triangles:ramV2.length,v3Triangles:ramV3.length,onlyInV2:ramDiff.onlyA,onlyInV3:ramDiff.onlyB,bodySteelSplit:{v2BodySteel:bodySteelV2.length,v3BodySteelPlusRamrod:bodySteelV3.length+ramV3.length,...splitDiff},
  vertices:{v3RamrodVertices:ramVerts.length,matchedWithin0_1mm:matched,maxWorldErrorM:worstVertex.d,at:worstVertex.at},frame:ramrodFrame,freeDraw},
 nodes:{unexpectedChanges:unexpected,movedMarkers,added,expectedAdded,addedAsExpected:JSON.stringify(added.map(a=>a.name).sort())===JSON.stringify([...expectedAdded].sort())},
 rootExtras:{bytesV2:rootBytesV2,bytesV3:rootBytes,limit:4096,lock:rootExtras.lock??null},clipsEqual,materialsEqual,texturesEqual,anchors};
const checks={triangleCountEqual:v2.tris.length===v3.tris.length,everyMaterialIdentical:Object.values(perMaterial).every(m=>m.identical),otherMeshesIdentical:Object.entries(perMesh).filter(([k])=>!['Mesh_Joint_Body_Flintlock_Steel',RAM_MESH].includes(k)).every(([,m])=>m.onlyInV2===0&&m.onlyInV3===0),
 bodySteelSplitExact:splitDiff.onlyA===0&&splitDiff.onlyB===0,ramrodTrianglesIdentical:ramDiff.onlyA===0&&ramDiff.onlyB===0&&ramV2.length===ramV3.length,ramrodVerticesIdentical:worstVertex.d<1e-6&&matched===ramVerts.length,
 ramrodOriginAtHead:Math.abs(ramrodFrame.localXRange[1])<1e-6&&ramrodFrame.worldRotationIdentity,drawnRodClear:freeDraw.checks.at(-1).intersects===false&&freeDraw.checks.at(-1).clearanceMM>0,
 noUnexpectedNodeChanges:unexpected.length===0,movedMarkersConsistent:movedMarkers.every(m=>m.sourceBoundsShiftErrorM<1e-6&&m.roleEqual&&m.v3Parent===RAM),addedAsExpected:out.nodes.addedAsExpected,
 rootExtrasUnderLimit:rootBytes<4096,rootLockPresent:!!rootExtras.lock,clipsEqual,materialsEqual,texturesEqual,vfxPanOnPanTop:anchors.anchor_vfx_pan.errorM<2e-4,graspOnRamrodHead:anchors.anchor_interaction_ramrod.insideTipBox};
out.checks=checks;out.pass=Object.values(checks).every(Boolean);
if(outPath)fs.writeFileSync(outPath,JSON.stringify(out,null,1)+'\n');
console.log(JSON.stringify({pass:out.pass,checks,v2:out.v2,v3:out.v3,perMaterial,ramrod:{...out.ramrod,frame:{...ramrodFrame,extras:undefined}},rootExtras:{bytesV2:rootBytesV2,bytesV3:rootBytes},anchors,unexpected:unexpected.length,added:added.map(a=>a.name)},null,1));
if(!out.pass)process.exitCode=1;
