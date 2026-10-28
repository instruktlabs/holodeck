import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url);
const source=await readFile(new URL('authoring/opening-case-megascans.kiln.js',root),'utf8');
const mat=JSON.parse(await readFile(new URL('materials/polyhaven/fine_grained_wood/material.json',root),'utf8'));
const old=source.split('\n').find(l=>l.includes('const wood=await'));
const edits=[{oldString:old,newString:' const wood=await compilePortableMaterialSpecV2('+JSON.stringify(mat.portableSpec)+');'},
{oldString:'  const g=geometry.clone();g.rotateX',newString:`  const g=geometry.clone();
  if(group===0){
   const pos=g.attributes.position,normal=g.attributes.normal,uv=g.attributes.uv;
   const offsetU=((x*71+y*43+z*97)%1+1)%1,offsetV=((x*37+y*83+z*59)%1+1)%1;
   for(let i=0;i<pos.count;i++){
    const px=pos.getX(i),py=pos.getY(i),pz=pos.getZ(i);
    const nx=Math.abs(normal.getX(i)),ny=Math.abs(normal.getY(i)),nz=Math.abs(normal.getZ(i));
    // Long-grain follows Y on standing slats; Z along lid and end panels.
    const alongZ=y>=.64 || Math.abs(x)>.45;
    const u=alongZ?(nx>.5?py:px):(nz>.5?px:pz);
    const v=alongZ?(ny>.5||nx>.5?pz:py):(ny>.5?px:py);
    uv.setXY(i,u/.6+offsetU,v/.6+offsetV);
   }
  }
  g.rotateX`},
{oldString:'  // The veneer scan repeats every 0.5 m across U and 1 m across V.\n  if(i===0){for(let j=1;j<uv.length;j+=2)geo.attributes.uv.array[j]*=.5;}',newString:'  // Timber UVs use the measured 0.6 m tile with deterministic per-board offsets.'}];
await writeFile(new URL('evidence/fine-wood-edits.json',root),JSON.stringify(edits,null,2));
