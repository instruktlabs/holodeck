// Prerender the project site's scene shelf from site/scenes.json, with its JSON-LD,
// sitemap.xml and robots.txt. The shelf needs no script at runtime.
// Usage: node scripts/render-site.mjs [--check] [site directory]
import {readFile,writeFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SITE_URL='https://holodeck.kilnstudio.tools/';
const REPOSITORY='https://github.com/instruktlabs/holodeck';
const CC0='https://creativecommons.org/publicdomain/zero/1.0/';
const KILN_PACKS='https://kilnstudio.tools/packs/';
// The shelf's own pages and the date each last changed in substance (its copy, links or structured
// data), as the sitemap's lastmod; a scene's date is its catalog `updated`. Update a date in the commit
// that changes the page: server/site.test.mjs checks each against git history when the checkout has it.
export const PAGES=[{path:'',updated:'2026-10-26'},{path:'about/',updated:'2026-10-26'}];
const W3C_DATE=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
// A hero tile is 1920×1080 with a 960×540 variant beside it, named -960.
const smallTile=src=>src.replace(/\.webp$/,'-960.webp'),tileSet=src=>`${smallTile(src)} 960w, ${src} 1920w`,TILE_SIZES='(max-aspect-ratio:1/1) 100vw, 50vw';
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
  if(Object.keys(scene).some(key=>!['id','example','kicker','title','summary','shots','path','updated','gallery','hero'].includes(key)))fail('Unexpected scene catalog field');
  if(!/^[a-z][a-z0-9-]{0,63}$/.test(scene.id)||ids.has(scene.id))fail('Scene ids must be unique slugs');ids.add(scene.id);
  // The deployed scene is exported from this bundled example by scripts/build-site.mjs, with site/cards/<id>.jpg as its card.
  if(typeof scene.example!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(scene.example))fail(`Scene ${scene.id} needs the example it is built from`);
  const card=imageSize(await file(site,`cards/${scene.id}.jpg`,'Scene card'));if(card.width!==1200||card.height!==630)fail(`Scene ${scene.id} card must be 1200×630`);
  for(const key of ['title','summary'])if(typeof scene[key]!=='string'||!scene[key].trim())fail(`Scene ${scene.id} needs a ${key}`);
  if(scene.kicker!==undefined&&(typeof scene.kicker!=='string'||!scene.kicker.trim()))fail(`Scene ${scene.id} kicker must be text`);
  // Feature + 3: the first shot is the large one, the other three sit beneath it.
  if(!Array.isArray(scene.shots)||scene.shots.length!==4)fail(`Scene ${scene.id} needs four shots`);
  for(const shot of scene.shots)if(Object.keys(shot).join()!=='src,alt'||typeof shot.src!=='string'||typeof shot.alt!=='string'||!shot.alt.trim())fail(`Scene ${scene.id} shots need a src and alt`);
  if(scene.path!==`worlds/${scene.id}/`)fail(`Scene ${scene.id} must live at worlds/${scene.id}/`);
  // updated: the date the scene's example or card last changed, the sitemap lastmod of its page.
  if(typeof scene.updated!=='string'||!W3C_DATE.test(scene.updated))fail(`Scene ${scene.id} needs an updated date (YYYY-MM-DD)`);
  if(scene.gallery!==undefined&&!/^https:\/\/kilnstudio\.tools\//.test(scene.gallery))fail(`Scene ${scene.id} gallery must be a kilnstudio.tools page`);
  // hero: the scene's tile in the hero collage.
  if(scene.hero!==undefined){
   if(Object.keys(scene.hero).join()!=='src,alt'||!/^images\/hero-[a-z0-9-]+\.webp$/.test(scene.hero.src)||typeof scene.hero.alt!=='string'||!scene.hero.alt.trim())fail(`Scene ${scene.id} hero needs an images/hero-*.webp src and alt`);
   for(const [src,width,height] of [[scene.hero.src,1920,1080],[smallTile(scene.hero.src),960,540]]){const size=imageSize(await file(site,src,'Hero tile'));if(size.width!==width||size.height!==height)fail(`Hero tile ${src} must be ${width}×${height}`);}
  }
  const url=new URL(scene.path,SITE_URL).href,shots=[];
  for(const [i,shot] of scene.shots.entries()){
   const size=imageSize(await file(site,shot.src,'Scene shot'));
   shots.push(`
            <img${i?'':' class="feature"'} src="${escapeHtml(shot.src)}" width="${size.width}" height="${size.height}" alt="${escapeHtml(shot.alt)}" loading="lazy" decoding="async">`);
  }
  cards.push(`
        <article class="scene" id="scene-${scene.id}">
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
 // A page with hero markers has a collage of the four scenes marked hero, in catalog order;
 // each tile opens its world. The preload and the Scenes menu fill their markers where present.
 const marked=name=>index.includes(`<!-- ${name}:start -->`),heroes=scenes.filter(scene=>scene.hero);
 if(marked('hero')&&heroes.length!==4)fail('Mark exactly four scenes as hero tiles');
 const tiles=heroes.map((scene,i)=>`
        <a class="hero-tile" href="${scene.path}"><img src="${escapeHtml(scene.hero.src)}" srcset="${escapeHtml(tileSet(scene.hero.src))}" sizes="${TILE_SIZES}" width="1920" height="1080"${i?'':' fetchpriority="high"'} alt="${escapeHtml(scene.hero.alt)}"><span>${escapeHtml(scene.title)}</span></a>`);
 const preload=heroes.length&&`<link rel="preload" as="image" href="${escapeHtml(heroes[0].hero.src)}" imagesrcset="${escapeHtml(tileSet(heroes[0].hero.src))}" imagesizes="${TILE_SIZES}" fetchpriority="high">`;
 // The Scenes menu lists every scene's world, then the shelf and Kiln's asset packs. It needs no script.
 const menu=`<details class="scenes-menu"><summary>Scenes</summary><div>${scenes.map(scene=>`<a href="${scene.path}">${escapeHtml(scene.title)}</a>`).join('')}<a href="#scenes">All scenes</a><a href="${KILN_PACKS}">Asset packs on Kiln ↗</a></div></details>`;
 if(marked('preload')&&heroes.length)index=between(index,'preload',preload);
 if(marked('menu'))index=between(index,'menu',menu);
 if(marked('hero'))index=between(index,'hero',tiles.join('')+'\n      ');
 index=between(index,'scenes',cards.join('')+'\n        ');
 index=between(index,'jsonld',`<script type="application/ld+json">${jsonLd(data)}</script>`);
 for(const page of PAGES){if(!W3C_DATE.test(page.updated))fail(`Page /${page.path} needs an updated date (YYYY-MM-DD)`);if(page.path)await file(site,`${page.path}index.html`,'Site page');}
 const urls=[...PAGES,...scenes].map(page=>({loc:new URL(page.path,SITE_URL).href,lastmod:page.updated}));
 const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${url.loc}</loc><lastmod>${url.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
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
