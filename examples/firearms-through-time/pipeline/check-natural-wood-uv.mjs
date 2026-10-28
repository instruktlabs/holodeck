import {readFile,writeFile} from 'node:fs/promises';import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url);
async function glb(path){const b=await readFile(new URL(path,root)),n=b.readUInt32LE(12),g=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(28+n);return {g,read(i){const a=g.accessors[i],v=g.bufferViews[a.bufferView],offset=(v.byteOffset??0)+(a.byteOffset??0),nc={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5123:2,5125:4,5126:4}[a.componentType],step=v.byteStride??nc*size,out=[];for(let j=0;j<a.count;j++)for(let k=0;k<nc;k++){const at=offset+j*step+k*size;out.push(a.componentType===5126?bin.readFloatLE(at):a.componentType===5125?bin.readUInt32LE(at):bin.readUInt16LE(at));}return out;}};}
const before=await glb('authoring/opening-case-procedural-wood.glb'),after=await glb('authoring/opening-case-natural-wood.glb');assert.deepEqual(before.g.nodes,after.g.nodes);assert.equal(before.g.meshes.length,after.g.meshes.length);let endTriangles=0,longTriangles=0;
for(let i=0;i<after.g.meshes.length;i++){
 const a=after.g.meshes[i],b=before.g.meshes[i];assert.equal(a.name,b.name);assert.equal(a.primitives.length,b.primitives.length);
 for(let j=0;j<a.primitives.length;j++){
  const x=a.primitives[j],y=b.primitives[j];assert.equal(x.material,y.material);
  for(const semantic of ['POSITION','NORMAL'])assert.deepEqual(after.read(x.attributes[semantic]),before.read(y.attributes[semantic]),a.name+' '+semantic);
  const idx=after.read(x.indices);assert.deepEqual(idx,before.read(y.indices));const uv=after.read(x.attributes.TEXCOORD_0);
  if(!a.name.includes('TimberPanels')){assert.deepEqual(uv,before.read(y.attributes.TEXCOORD_0));continue;}
  for(let k=0;k<idx.length;k+=3){const face=idx.slice(k,k+3).map(v=>{const u=uv[v*2],t=uv[v*2+1],end=u>.5;assert(u>=(end?1040:16)/2048-1e-6&&u<=(end?2032:1008)/2048+1e-6);assert(t>=16/1024-1e-6&&t<=1008/1024+1e-6);return end;});assert(face.every(v=>v===face[0]),'triangle crosses atlas regions');if(face[0])endTriangles++;else longTriangles++;}
 }
}
assert(endTriangles>0&&longTriangles>0);
const r={ok:true,endTriangles,longTriangles,checks:['nodes_and_hinge_unchanged','all_positions_normals_indices_material_slots_unchanged','nonwood_UVs_unchanged','wood_UVs_inside_padded_regions','no_triangle_crosses_long_end_regions'],limits:['Atlas assignment proves face mapping; continuous volumetric ring phase across edges is not modeled']};await writeFile(new URL('evidence/natural-wood-geometry-uv-check.json',root),JSON.stringify(r,null,2));console.log(JSON.stringify(r));
