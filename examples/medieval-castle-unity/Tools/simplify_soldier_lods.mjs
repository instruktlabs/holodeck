// Pinned meshoptimizer, MIT; CPU-only indexed simplification retains source vertex values.
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const [input, output, packagePath, protectionPath] = process.argv.slice(2);
const packageInfo=JSON.parse(fs.readFileSync(path.join(path.dirname(packagePath),'package.json'),'utf8'));
if(packageInfo.name!=='meshoptimizer'||packageInfo.version!=='1.1.1')throw new Error('Requires pinned meshoptimizer 1.1.1');
const {MeshoptSimplifier:S} = await import(pathToFileURL(packagePath).href);
await S.ready;
const job=JSON.parse(fs.readFileSync(input,'utf8'));
if(!/^[a-f0-9]{64}$/.test(job.sourceSha256||''))throw new Error('Input must identify exact LOD0 GLB hash');
const protection=protectionPath?JSON.parse(fs.readFileSync(protectionPath,'utf8')):null;
if(protection&&protection.sourceSha256!==job.sourceSha256)throw new Error('Layer-clearance protection source hash mismatch');
const lods=[];
function components(p) {
  const parent=p.POSITION.map((_,i)=>i);
  function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
  function join(a,b){parent[find(b)]=find(a);}
  for(let i=0;i<p.indices.length;i+=3){join(p.indices[i],p.indices[i+1]);join(p.indices[i],p.indices[i+2]);}
  return parent.map((_,i)=>find(i));
}
function triangleKey(a,b,c){return a<b&&a<c?`${a},${b},${c}`:b<a&&b<c?`${b},${c},${a}`:`${c},${a},${b}`;}
function opposingComponents(indices,p,ids,unchanged=new Set()) {
  const bad=new Set();let worst=1,badTriangles=0;
  for(let i=0;i<indices.length;i+=3){
    const tri=[indices[i],indices[i+1],indices[i+2]],a=p.POSITION[tri[0]],b=p.POSITION[tri[1]],c=p.POSITION[tri[2]];
    const u=b.map((x,j)=>x-a[j]),v=c.map((x,j)=>x-a[j]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...n);
    if(length<1e-12)throw new Error('Degenerate simplified triangle');
    let minimum=1;
    for(const index of tri){const normal=p.NORMAL[index];minimum=Math.min(minimum,n.reduce((s,x,j)=>s+x*normal[j],0)/(length*Math.hypot(...normal)));}
    worst=Math.min(worst,minimum);
    if(minimum<-.25&&!unchanged.has(triangleKey(...tri))){badTriangles++;for(const index of tri)bad.add(ids[index]);}
  }
  return {bad,worst,badTriangles};
}
for (const [name,ratio,error] of [['Garrison-LOD1',.42,.006],['Garrison-LOD2',.16,.018]]) {
  const primitives=[];
  for (const [primitiveIndex,p] of job.primitives.entries()) {
    const positions=new Float32Array(p.POSITION.flat()),indices=new Uint32Array(p.indices);
    const attrs=[];
    for(let i=0;i<p.POSITION.length;i++) attrs.push(...p.NORMAL[i],...p.COLOR_0[i],...p.WEIGHTS_0[i],...p.JOINTS_0[i].map(x=>x/255),...p.TEXCOORD_0[i]);
    const weights=[.1,.1,.1,.2,.2,.2,.2,.25,.25,.25,.25,.5,.5,.5,.5,.01,.01];
    const ids=components(p),locked=new Uint8Array(p.POSITION.length),passes=[];
    const baseline=opposingComponents(indices,p,ids),lockedComponents=new Set(baseline.bad),unchanged=new Set();
    for(let i=0;i<indices.length;i+=3)unchanged.add(triangleKey(indices[i],indices[i+1],indices[i+2]));
    // Shared smooth normals on original hard edges can already oppose one face.
    // Preserve those complete source components; exempt only exact oriented
    // source triangles, not new faces whose attributes merely look similar.
    for(let i=0;i<locked.length;i++)if(lockedComponents.has(ids[i]))locked[i]=1;
    for(const range of job.primitiveMapping||[]){
      if(range.outputPrimitive!==primitiveIndex||!protection?.sourceMaterials.includes(range.sourceMaterial))continue;
      for(let i=range.vertexStart;i<range.vertexStart+range.vertices;i++)locked[i]=1;
    }
    let result,actualError,check;
    for(let pass=0;pass<8;pass++){
      [result,actualError]=S.simplifyWithAttributes(indices,positions,3,new Float32Array(attrs),17,weights,locked,Math.floor(indices.length*ratio/3)*3,error,['LockBorder','ErrorAbsolute']);
      check=opposingComponents(result,p,ids,unchanged);
      passes.push({pass,triangles:result.length/3,opposingTriangles:check.badTriangles,worstNormalDot:check.worst,lockedVertices:locked.reduce((n,x)=>n+x,0)});
      if(!check.badTriangles)break;
      // Thin closed cuffs, eye overlays and rolled rims can collapse across their
      // thickness despite a small positional error. Keep the affected original
      // connected surface intact; never flip faces or hide it with two-sided PBR.
      for(const id of check.bad)lockedComponents.add(id);
      for(let i=0;i<locked.length;i++)if(lockedComponents.has(ids[i]))locked[i]=1;
    }
    if(check.badTriangles)throw new Error('Unresolved opposing normals after protected-surface retries');
    primitives.push({indices:Array.from(result),error:actualError,originalTriangles:indices.length/3,triangles:result.length/3,sourceOpposingCornerTriangles:baseline.badTriangles,protectedComponents:lockedComponents.size,passes});
  }
  lods.push({name,ratio,error,primitives});
}
fs.writeFileSync(output,JSON.stringify({sourceSha256:job.sourceSha256,protection,method:'meshoptimizer 1.1.1 simplifyWithAttributes, LockBorder, ErrorAbsolute, exact source vertex attributes retained; connected thin surfaces protected on new normal opposition below -0.25; optional hash-pinned layered garment/head protection',lods}));
console.log(JSON.stringify(lods.map(l=>({name:l.name,triangles:l.primitives.reduce((n,p)=>n+p.triangles,0),errorM:Math.max(...l.primitives.map(p=>p.error))}))));
