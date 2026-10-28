import assert from 'node:assert/strict';
import {readGLB,topology} from './glb-analysis.mjs';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const before=await readGLB('authoring/first-hands-v5.glb'),after=await readGLB('authoring/first-hands-v6.glb');
const hash=b=>createHash('sha256').update(b).digest('hex');
const skeleton=g=>g.j.skins.map(s=>({joints:s.joints.map(i=>g.j.nodes[i]),inverse:g.data(s.inverseBindMatrices)}));
assert.deepEqual(skeleton(after),skeleton(before));
const clips=g=>g.j.animations.map(a=>({name:a.name,channels:a.channels.map(c=>{const s=a.samplers[c.sampler];return {node:g.j.nodes[c.target.node].name,path:c.target.path,interpolation:s.interpolation,times:g.data(s.input),values:g.data(s.output)};})}));
assert.deepEqual(clips(after),clips(before));
assert.deepEqual(after.j.materials,before.j.materials);
const images=g=>g.j.images.map(i=>{const v=g.j.bufferViews[i.bufferView],len=g.b.readUInt32LE(12);return hash(g.b.subarray(28+len+v.byteOffset,28+len+v.byteOffset+v.byteLength));});
assert.deepEqual(images(after),images(before));
function distal(g){const skin=g.j.skins[0],sets={};for(const p of g.j.meshes[g.j.nodes.find(n=>n.name==='Mesh_Gloves').mesh].primitives){const pos=g.data(p.attributes.POSITION),j=g.data(p.attributes.JOINTS_0),w=g.data(p.attributes.WEIGHTS_0);for(let i=0;i<pos.length;i++){for(let k=0;k<4;k++){const name=g.j.nodes[skin.joints[j[i][k]]].name;if(w[i][k]>.8&&name.endsWith('_tip')){(sets[name]??=new Set()).add(JSON.stringify({p:pos[i],j:j[i],w:w[i]}));break;}}}}return Object.fromEntries(Object.entries(sets).sort().map(([k,v])=>[k,[...v].sort()]));}
const a=distal(before),b=distal(after),distalPreserved=JSON.stringify(a)===JSON.stringify(b);
assert(distalPreserved,'Distal contact vertices or weights changed; remeasure required');
const topo=['Mesh_Gloves','Mesh_Sleeves'].map(n=>topology(after,n));
for(const t of topo){assert.equal(t.boundaryEdges,0);assert.equal(t.nonManifoldEdges,0);assert.equal(t.degenerate,0);assert.equal(t.components.length,2);}
const report={ok:true,beforeSha256:hash(before.b),afterSha256:hash(after.b),bonesUnchanged:true,animationChannelsUnchanged:true,materialDefinitionsAndImageBytesUnchanged:true,distalContactVerticesAndWeightsUnchanged:distalPreserved,distalVertices:Object.fromEntries(Object.entries(a).map(([k,v])=>[k,v.length])),topology:topo,scope:'Exact exported rig/animation/material comparison. Distal contact positions and weights are identical, preserving the previous sampled contact evidence; full wrist/forearm continuous collision is not certified.'};
await writeFile('evidence/wrist-v6-preservation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
