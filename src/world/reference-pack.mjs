// Reference packs: a dropped folder or .zip of images and notes, with an optional
// manifest.json giving titles, categories, notes and status. Pure data; the board
// uploads each planned file through the existing import routes, which hash it.
// A dogfood input proposal (input-manifest.json) lists its images under `images`
// with provenance and SHA-256, and names the user's brief in `userBriefFile`.
export const DEFAULT_CATEGORIES=['Scene','Layout','Kit','Asset','Material','Atmosphere','Architecture','Rules'];
export const PACK_LIMIT=200;
const IMAGE=/\.(png|jpe?g|webp)$/i,FILE=/\.(md|txt|json|pdf|glb)$/i,STATUS={approved:'approved',exploring:'exploring',rejected:'rejected',avoid:'rejected'};
const MANIFESTS=['manifest.json','input-manifest.json'],SHA256=/^[0-9a-f]{64}$/i;
const hex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');

// Mirrors the host's readable default title: no extension, no leading number.
export function packTitle(path){
  const stem=path.split('/').at(-1).replace(/\.[^.]+$/,''),words=stem.replace(/^\d+[-_. ]+/,'').replace(/[-_]+/g,' ').trim()||stem;
  return (words.charAt(0).toUpperCase()+words.slice(1)).slice(0,160);
}

// Read a .zip held in memory: stored and deflated entries only (no ZIP64, no encryption).
export async function readZip(bytes){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  let end=-1;for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('This file is not a readable .zip archive');
  const count=view.getUint16(end+10,true);let at=view.getUint32(end+16,true);
  if(count>PACK_LIMIT*2)throw new Error(`A pack holds at most ${PACK_LIMIT} references`);
  const entries=[];
  for(let n=0;n<count;n++){
    if(view.getUint32(at,true)!==0x02014b50)throw new Error('The .zip directory is damaged');
    const flags=view.getUint16(at+8,true),method=view.getUint16(at+10,true),size=view.getUint32(at+20,true),nameLength=view.getUint16(at+28,true),extra=view.getUint16(at+30,true),comment=view.getUint16(at+32,true),local=view.getUint32(at+42,true);
    const name=new TextDecoder().decode(data.subarray(at+46,at+46+nameLength));at+=46+nameLength+extra+comment;
    if(name.endsWith('/'))continue;
    if(flags&1)throw new Error(`${name} is encrypted`);
    if(size===0xffffffff)throw new Error('Large (ZIP64) archives are not supported');
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true),raw=data.subarray(start,start+size);
    if(method!==0&&method!==8)throw new Error(`${name} uses an unsupported compression method`);
    entries.push({path:name,read:async()=>method===0?raw.slice():new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())});
  }
  return entries;
}

const clean=path=>path.replace(/\\/g,'/').replace(/^\.\//,'');
const hidden=path=>path.split('/').some(part=>part.startsWith('.')||part==='__MACOSX');
// Entries carry a path and read(); a folder pick gives File objects, a zip gives readZip entries.
export async function planPack(entries,{packName='pack'}={}){
  const files=entries.map(e=>({...e,path:clean(e.path)})).filter(e=>!hidden(e.path));
  // A common top folder (zipping a folder) is not part of the manifest's paths.
  const top=files.length&&files.every(f=>f.path.includes('/')&&f.path.split('/')[0]===files[0].path.split('/')[0])?files[0].path.split('/')[0]+'/':'';
  const rel=f=>top&&f.path.startsWith(top)?f.path.slice(top.length):f.path;
  const manifestEntry=files.find(f=>MANIFESTS.includes(rel(f).toLowerCase()));
  let manifest=[];
  if(manifestEntry){
    let parsed;try{parsed=JSON.parse(new TextDecoder().decode(await manifestEntry.read()));}catch{throw new Error(`${rel(manifestEntry)} is not valid JSON`);}
    manifest=Array.isArray(parsed)?parsed:Array.isArray(parsed?.references)?parsed.references:Array.isArray(parsed?.images)?parsed.images:[];
    // The brief is the user's own direction, so it lands approved under its own category.
    if(typeof parsed?.userBriefFile==='string'&&!manifest.some(m=>m?.file===parsed.userBriefFile))manifest=[...manifest,{file:parsed.userBriefFile,title:typeof parsed.title==='string'?`${parsed.title}: brief`:'Brief',category:'Brief',status:'approved'}];
  }
  const byFile=new Map(manifest.filter(m=>typeof m?.file==='string').map(m=>[clean(m.file),m]));
  const items=[],skipped=[];
  for(const f of files){
    const path=rel(f);if(f===manifestEntry)continue;
    const kind=IMAGE.test(path)?'image':FILE.test(path)?'file':null;
    if(!kind){skipped.push({path,reason:'unsupported type'});continue;}
    if(items.length>=PACK_LIMIT){skipped.push({path,reason:'over the pack limit'});continue;}
    const m=byFile.get(path)||{};
    if(typeof m.sha256==='string'&&SHA256.test(m.sha256)&&hex(await crypto.subtle.digest('SHA-256',await f.read()))!==m.sha256.toLowerCase()){skipped.push({path,reason:'differs from its manifest hash'});continue;}
    // Provenance (a user photo, a generated concept) stays on the card, apart from measured evidence.
    const notes=[m.notes,m.provenance&&`Provenance: ${m.provenance}`].filter(v=>typeof v==='string'&&v).join('\n\n').slice(0,1800);
    // A category that only differs in case from a default joins it, so the filter shows one Scene.
    const group=String(m.category||m.group||'').slice(0,64),known=DEFAULT_CATEGORIES.find(c=>c.toLowerCase()===group.toLowerCase());
    items.push({path,read:f.read,kind,title:String(m.title||packTitle(path)).slice(0,160),group:known||group||null,status:STATUS[String(m.status||'').toLowerCase()]||'exploring',
      // The schema has no provenance field; the pack and original path stay readable in the notes.
      notes:`${notes}${notes?'\n\n':''}From ${packName}: ${path}`});
  }
  items.sort((a,b)=>a.path.localeCompare(b.path,undefined,{numeric:true}));
  return {items,skipped,manifest:!!manifestEntry};
}

// Category suggestions: the stable defaults plus whatever this board already uses.
export const categorySuggestions=refs=>[...new Set([...DEFAULT_CATEGORIES,...refs.map(r=>r.group).filter(Boolean)])];
