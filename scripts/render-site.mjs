// Prerender the project site's scene shelf from site/scenes.json, with its JSON-LD,
// sitemap.xml and robots.txt. The shelf needs no script at runtime.
// Usage: node scripts/render-site.mjs [--check] [site directory]
import {readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SITE_URL='https://holodeck.kilnstudio.tools/';
const REPOSITORY='https://github.com/instruktlabs/holodeck';
const CC0='https://creativecommons.org/publicdomain/zero/1.0/';
const escapeHtml=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const jsonLd=value=>JSON.stringify(value,null,1).replace(/</g,'\\u003c');
const fail=message=>{throw new Error(message);};

export function imageSize(bytes){
 if(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'){
  const chunk=bytes.subarray(12,16).toString();
  if(chunk==='VP8X')return {width:1+bytes.readUIntLE(24,3),height:1+bytes.readUIntLE(27,3)};
  if(chunk==='VP8 ')return {width:bytes.readUInt16LE(26)&0x3fff,height:bytes.readUInt16LE(28)&0x3fff};
  if(chunk==='VP8L'){const bits=bytes.readUInt32LE(21);return {width:1+(bits&0x3fff),height:1+((bits>>14)&0x3fff)};}
 }
 if(bytes[0]===0xff&&bytes[1]===0xd8)for(let i=2;i+9<bytes.length;){if(bytes[i]!==0xff){i++;continue;}const marker=bytes[i+1];if(marker>=0xc0&&marker<=0xcf&&![0xc4,0xc8,0xcc].includes(marker))return {width:bytes.readUInt16BE(i+7),height:bytes.readUInt16BE(i+5)};i+=2+bytes.readUInt16BE(i+2);}
 fail('Site image must be a PNG, JPEG or WebP');
}
async function file(site,relative,label){
 const target=path.resolve(site,relative);if(path.relative(site,target).startsWith('..'))fail(`${label} escapes the site`);
 const info=await lstat(target).catch(()=>fail(`${label} is missing: ${relative}`));if(!info.isFile())fail(`${label} is not a file: ${relative}`);return readFile(target);
}
const between=(text,name,body)=>{
 const start=`<!-- ${name}:start -->`,end=`<!-- ${name}:end -->`,a=text.indexOf(start),b=text.indexOf(end);
 if(a<0||b<a)fail(`site/index.html is missing the ${name} markers`);return text.slice(0,a+start.length)+body+text.slice(b);
};

export async function renderSite(site){
 site=path.resolve(site);const scenes=JSON.parse((await file(site,'scenes.json','Scene catalog')).toString('utf8'));
 if(!Array.isArray(scenes)||!scenes.length)fail('Scene catalog needs at least one scene');const ids=new Set();
 const cards=[],items=[];
 for(const [index,scene] of scenes.entries()){
  if(Object.keys(scene).some(key=>!['id','kicker','title','summary','shots','path','gallery'].includes(key)))fail('Unexpected scene catalog field');
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(scene.id)||ids.has(scene.id))fail('Scene ids must be unique slugs');ids.add(scene.id);
  for(const key of ['title','summary'])if(typeof scene[key]!=='string'||!scene[key].trim())fail(`Scene ${scene.id} needs a ${key}`);
  if(scene.kicker!==undefined&&(typeof scene.kicker!=='string'||!scene.kicker.trim()))fail(`Scene ${scene.id} kicker must be text`);
  // Feature + 3: the first shot is the large one, the other three sit beneath it.
  if(!Array.isArray(scene.shots)||scene.shots.length!==4)fail(`Scene ${scene.id} needs four shots`);
  for(const shot of scene.shots)if(Object.keys(shot).join()!=='src,alt'||typeof shot.src!=='string'||typeof shot.alt!=='string'||!shot.alt.trim())fail(`Scene ${scene.id} shots need a src and alt`);
  if(scene.path!==`worlds/${scene.id}/`)fail(`Scene ${scene.id} must live at worlds/${scene.id}/`);
  if(scene.gallery!==undefined&&!/^https:\/\/kilnstudio\.tools\//.test(scene.gallery))fail(`Scene ${scene.id} gallery must be a kilnstudio.tools page`);
  // Each export must already carry its own canonical page and social card.
  const url=new URL(scene.path,SITE_URL).href,page=(await file(site,`${scene.path}index.html`,'Scene export')).toString('utf8');
  if(!page.includes(`<link rel="canonical" href="${url}">`))fail(`Scene ${scene.id} export lacks its canonical link; export it with --url ${url}`);
  await file(site,`${scene.path}preview.jpg`,'Scene card');
  const shots=[];
  for(const [i,shot] of scene.shots.entries()){
   const size=imageSize(await file(site,shot.src,'Scene shot'));
   shots.push(`
            <img${i?'':' class="feature"'} src="${escapeHtml(shot.src)}" width="${size.width}" height="${size.height}" alt="${escapeHtml(shot.alt)}" loading="lazy" decoding="async">`);
  }
  cards.push(`
        <article class="scene">
          <div class="scene-shots">${shots.join('')}
          </div>
          <div class="scene-copy">
            <div>${scene.kicker?`<p class="kicker">${escapeHtml(scene.kicker)}</p>`:''}<h3><a href="${scene.path}">${escapeHtml(scene.title)}</a></h3><p>${escapeHtml(scene.summary)}</p></div>
            <p class="scene-links"><a class="enter" href="${scene.path}">Enter the scene ↗</a>${scene.gallery?`<a class="gallery" href="${escapeHtml(scene.gallery)}">Its assets in the Kiln gallery</a>`:''}</p>
          </div>
        </article>`);
  items.push({'@type':'ListItem',position:index+1,item:{'@type':'CreativeWork',name:scene.title,description:scene.summary,url,image:new URL('preview.jpg',url).href,license:CC0}});
 }
 const data={'@context':'https://schema.org','@graph':[
  {'@type':'WebSite','@id':`${SITE_URL}#website`,name:'Holodeck',url:SITE_URL},
  {'@type':'SoftwareSourceCode','@id':`${SITE_URL}#software`,name:'Holodeck',description:'A local workspace where you and your coding agent build 3D worlds with Kiln assets, then walk them in the browser.',url:SITE_URL,codeRepository:REPOSITORY,programmingLanguage:'JavaScript',license:'https://opensource.org/license/mit'},
  {'@type':'ItemList','@id':`${SITE_URL}#scenes`,name:'Holodeck scenes',itemListElement:items},
 ]};
 let index=(await file(site,'index.html','Site page')).toString('utf8');
 index=between(index,'scenes',cards.join('')+'\n        ');
 index=between(index,'jsonld',`<script type="application/ld+json">${jsonLd(data)}</script>`);
 const urls=[SITE_URL,...scenes.map(scene=>new URL(scene.path,SITE_URL).href)];
 const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${url}</loc></url>`).join('\n')}\n</urlset>\n`;
 const robots=`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`;
 return {'index.html':index,'sitemap.xml':sitemap,'robots.txt':robots};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const check=process.argv.includes('--check'),site=process.argv.slice(2).find(arg=>!arg.startsWith('--'))??fileURLToPath(new URL('../site/',import.meta.url));
 const files=await renderSite(site),stale=[];
 for(const [name,text] of Object.entries(files)){
  const target=path.join(site,name),current=await readFile(target,'utf8').catch(()=>null);
  if(current===text)continue;if(check)stale.push(name);else await writeFile(target,text);
 }
 if(stale.length){console.error(`Site is stale: ${stale.join(', ')}. Run node scripts/render-site.mjs`);process.exit(1);}
 console.log(check?'Site is current.':`Rendered ${Object.keys(files).join(', ')}.`);
}
