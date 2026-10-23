import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {DEFAULT_WORLD} from '../src/world/contract.mjs';
const packageRoot=fileURLToPath(new URL('../',import.meta.url));
// Foliage bindings are schema v2 records; v1 worlds keep the same authored ferns without wind.
export async function installStarter(root,{schemaVersion=1}={}){
  const w=structuredClone(DEFAULT_WORLD),manifest=JSON.parse(await readFile(path.join(packageRoot,'assets/cove/modules/manifest.json'),'utf8'));
  w.scene.assets=[];w.scene.origin='structure';
  for(const m of manifest){
    const file=`assets/imports/cove-${m.id}-${m.revisionId}.glb`;
    await writeFile(path.join(root,file),await readFile(path.join(packageRoot,`public/assets/cove-modules/${m.id}.glb`)));
    await writeFile(path.join(root,`assets/source/cove-${m.id}.kiln.js`),await readFile(path.join(packageRoot,`assets/cove/modules/${m.id}/source.kiln.js`)),{flag:'wx'}).catch(e=>{if(e.code!=='EEXIST')throw e;});
    w.scene.assets.push({id:m.id,file,provenance:{assetId:m.assetId,revisionId:m.revisionId,collection:'project'},...(m.foliage&&schemaVersion===2?{foliage:m.foliage}:{})});
  }
  // Foliage modules keep their authored materials and frame; the rest use cove batching.
  const foliage=new Set(manifest.filter(m=>m.foliage).map(m=>m.id));
  const place=(id,asset,position,collider=null,light)=>({id,asset,position,rotation:[0,0,0],scale:[1,1,1],layer:'origin',...(foliage.has(asset)?{}:{materialStyle:'cove'}),collider,...(light?{light}:{})});
  const box=(size,offset)=>({type:'box',size,offset});
  const light=(intensity,offset)=>({color:'#ffba79',intensity,distance:3.5,offset});
  w.scene.objects=[
    place('cove-canopy','canopy',[0,0,0],{type:'compound',boxes:[[-3.25,-1.7],[2.55,-1.7],[-3.25,2.55],[2.55,2.55]].map(([x,z])=>({size:[.2,3.25,.2],offset:[x,1.625,z]}))}),
    place('cove-seating','seating',[0,0,0]),place('cove-hearth','hearth',[-1.12,0,.08],box([2.38,.85,2.38],[0,.425,0]),light(1.3,[0,1.45,0])),
    place('cove-planting','planting',[0,0,0]),place('cove-rug','rug',[.45,0,.7]),
    place('cove-lamp-left','lamp',[-2.35,0,-1],box([.56,.66,.56],[0,.33,0]),light(3,[0,.36,0])),
    place('cove-lamp-right','lamp',[2.5,0,.7],box([.56,.66,.56],[0,.33,0]),light(3,[0,.36,0])),
  ];
  w.scene.moodboard={asset:'moodboard',position:[1.05,0,-2.45],rotation:[0,-Math.PI/2,0],page:0,title:'The world we are imagining',theme:'linen'};
  w.references=[];
  for(const [i,name] of ['01-discuss','02-direct'].entries()){
    const bytes=await readFile(path.join(packageRoot,`public/design/first-person/${name}.png`)),hash=createHash('sha256').update(bytes).digest('hex'),file=`references/files/${hash}.png`;
    await writeFile(path.join(root,file),bytes);
    w.references.push({id:`ref-${hash.slice(0,12)}`,kind:'image',file,title:i?'Building around the cove':'A quiet place to begin',notes:'Generated concept reference, not a capture of the live world.',group:'Atmosphere',status:'exploring',page:0,layout:{x:30+i*405,y:115,w:385,h:385}});
  }
  w.references.push({id:'cove-intention',kind:'note',title:'A place to make worlds',notes:'Warm clay. Linen overhead. A living ember at the origin.\n\nKeep the path clear. Let the cove disappear when we enter the world.',group:'Experience',status:'exploring',page:0,layout:{x:840,y:115,w:330,h:385}});
  return w;
}
