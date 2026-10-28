import {readGLB,poseGLB} from './glb-analysis.mjs';
import {rotate} from './glb-analysis.mjs';
const g=await readGLB(process.argv[2]);const pose=poseGLB(g,null,0);
const {j}=g;const parent=new Map();j.nodes.forEach((n,i)=>(n.children??[]).forEach(c=>parent.set(c,i)));
for(const [i,n] of j.nodes.entries()){if(n.mesh===undefined)continue;const w=pose.get(n.name);let min=[1e9,1e9,1e9],max=[-1e9,-1e9,-1e9];for(const p of j.meshes[n.mesh].primitives){const a=j.accessors[p.attributes.POSITION];const lo=rotate(w.q,a.min).map((v,k)=>v+w.p[k]),hi=rotate(w.q,a.max).map((v,k)=>v+w.p[k]);for(let k=0;k<3;k++){min[k]=Math.min(min[k],lo[k],hi[k]);max[k]=Math.max(max[k],lo[k],hi[k]);}}
console.log(n.name.padEnd(60),'parent',j.nodes[parent.get(i)]?.name,'min',min.map(v=>v.toFixed(3)).join(','),'max',max.map(v=>v.toFixed(3)).join(','));}
console.log('anims',(j.animations??[]).map(a=>a.name));
