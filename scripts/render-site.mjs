// Prerender the project site's scene shelf from site/scenes.json, with its JSON-LD,
// sitemap.xml, robots.txt and llms.txt, and the experimental Lab from site/lab.json.
// The shelf and the Lab need no script at runtime.
// Usage: node scripts/render-site.mjs [--check] [site directory]
import {readFile,writeFile,lstat,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SITE_URL='https://holodeck.kilnstudio.tools/';
const REPOSITORY='https://github.com/instruktlabs/holodeck';
const CC0='https://creativecommons.org/publicdomain/zero/1.0/';
const KILN_PACKS='https://kilnstudio.tools/packs/';
// The shelf's own pages and the date each last changed in substance (its copy, links or structured
// data), as the sitemap's lastmod; a scene's date is its catalog `updated`. Update a date in the commit
// that changes the page: server/site.test.mjs checks each against git history when the checkout has it.
export const PAGES=[{path:'',updated:'2026-10-27'},{path:'about/',updated:'2026-10-27'}];
// The Lab's index, rendered from site/lab.json; each entry's page takes its catalog `updated`.
export const LAB={path:'lab/',updated:'2026-10-27'};
// A Lab video is an H.264 MP4 of at most 8 MB with its moov box first (ffmpeg -movflags +faststart),
// so it starts streaming at once, and a JPEG poster of the video's own size.
export const MAX_LAB_VIDEO_BYTES=8*1000*1000;
const W3C_DATE=/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
// A hero slide is 1920×1080 with a 960×540 variant beside it, named -960.
const smallTile=src=>src.replace(/\.webp$/,'-960.webp'),tileSet=src=>`${smallTile(src)} 960w, ${src} 1920w`,TILE_SIZES='(max-width:860px) 80vw, 66vw';
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
// The codec and coded size of an MP4's first video track, and whether its moov precedes its media data.
export function videoInfo(bytes){
 const boxes=(start,end)=>{
  const list=[];
  for(let i=start;i+8<=end;){
   let size=bytes.readUInt32BE(i),head=8;if(size===1){size=Number(bytes.readBigUInt64BE(i+8));head=16;}else if(size===0)size=end-i;
   if(size<head||i+size>end)fail('Lab video is not a complete MP4');list.push({type:bytes.toString('latin1',i+4,i+8),start:i+head,end:i+size});i+=size;
  }
  return list;
 };
 const child=(box,type)=>box&&boxes(box.start,box.end).find(b=>b.type===type);
 const top=boxes(0,bytes.length),types=top.map(b=>b.type);
 if(types[0]!=='ftyp')fail('Lab video must be an MP4');
 const moov=top.find(b=>b.type==='moov');if(!moov)fail('Lab video has no moov box');
 for(const trak of boxes(moov.start,moov.end).filter(b=>b.type==='trak')){
  const mdia=child(trak,'mdia'),hdlr=child(mdia,'hdlr');if(!hdlr||bytes.toString('latin1',hdlr.start+8,hdlr.start+12)!=='vide')continue;
  const stsd=child(child(child(mdia,'minf'),'stbl'),'stsd');if(!stsd)fail('Lab video track has no sample description');
  const entry=stsd.start+8;
  return {codec:bytes.toString('latin1',entry+4,entry+8),width:bytes.readUInt16BE(entry+32),height:bytes.readUInt16BE(entry+34),faststart:!types.includes('mdat')||types.indexOf('moov')<types.indexOf('mdat')};
 }
 fail('Lab video has no video track');
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
  // hero: the scene's slide in the home hero's carousel.
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
 // A page with hero markers has a carousel of the four scenes marked hero, in catalog order;
 // each slide opens its world. The preload and the Scenes menu fill their markers where present.
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
 const lab=await readLab(site),labFiles=lab?renderLab(lab):{};
 const urls=[...PAGES,...(lab?[LAB,...lab]:[]),...scenes].map(page=>({loc:new URL(page.path,SITE_URL).href,lastmod:page.updated}));
 const sitemap=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(url=>`  <url><loc>${url.loc}</loc><lastmod>${url.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
 const robots=`User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}sitemap.xml\n`;
 return {'index.html':index,'sitemap.xml':sitemap,'robots.txt':robots,'llms.txt':llmsText(scenes,lab),...labFiles};
}

// The Lab: experiments kept off the shelf, its hero, its Scenes menu and llms.txt's scene list.
// site/lab.json is optional. Each entry has two or more videos (H.264 MP4 with a JPEG poster of the
// same size), a 1200×630 card and, optionally, a playable scene that scripts/build-site.mjs exports
// from a bundled example at lab/<id>/play/. An entry's folder, site/lab/<id>/, holds its rendered
// page, card.jpg and the listed media, and nothing else.
const LAB_FIELDS=['id','title','blurb','status','updated','cardAlt','videos','scene'],VIDEO_FIELDS=['engine','mp4','poster','width','height','caption'];
const SLUG=/^[a-z][a-z0-9-]{0,63}$/;
const text=(value,label)=>{if(typeof value!=='string'||!value.trim())fail(`${label} needs text`);return value;};
export async function readLab(site){
 site=path.resolve(site);
 const source=await readFile(path.join(site,'lab.json'),'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
 if(source===null)return null;
 const entries=JSON.parse(source),ids=new Set();if(!Array.isArray(entries))fail('site/lab.json must be a list of entries');
 for(const entry of entries){
  if(typeof entry!=='object'||!entry||Object.keys(entry).some(key=>!LAB_FIELDS.includes(key)))fail('Unexpected Lab entry field');
  if(!SLUG.test(entry.id)||ids.has(entry.id))fail('Lab entry ids must be unique slugs');ids.add(entry.id);
  for(const key of ['title','blurb','status','cardAlt'])text(entry[key],`Lab entry ${entry.id} ${key}`);
  // The playable export's page description is "Experimental: <blurb> Walk it in your browser.", at most 300 characters.
  for(const [key,max] of [['title',60],['blurb',260],['status',240],['cardAlt',300]])if(entry[key].length>max)fail(`Lab entry ${entry.id} ${key} is longer than ${max} characters`);
  if(typeof entry.updated!=='string'||!W3C_DATE.test(entry.updated))fail(`Lab entry ${entry.id} needs an updated date (YYYY-MM-DD)`);
  const folder=`lab/${entry.id}/`,card=imageSize(await file(site,`${folder}card.jpg`,'Lab card'));
  if(card.width!==1200||card.height!==630)fail(`Lab entry ${entry.id} card must be 1200×630`);
  if(!Array.isArray(entry.videos)||entry.videos.length<2)fail(`Lab entry ${entry.id} needs two or more videos`);
  const engines=new Set(),media=new RegExp(`^lab/${entry.id}/[a-z0-9][a-z0-9-]{0,63}\\.(mp4|jpg)$`);
  for(const video of entry.videos){
   if(typeof video!=='object'||!video||Object.keys(video).some(key=>!VIDEO_FIELDS.includes(key)))fail(`Unexpected field in a video of Lab entry ${entry.id}`);
   const label=`Lab entry ${entry.id} video ${text(video.engine,`A video engine of Lab entry ${entry.id}`)}`;
   if(engines.has(video.engine))fail(`${label} is listed twice`);engines.add(video.engine);
   if(video.caption!==undefined)text(video.caption,`${label} caption`);
   if(media.exec(video.mp4??'')?.[1]!=='mp4')fail(`${label} mp4 must be a ${folder}<name>.mp4 file`);
   if(media.exec(video.poster??'')?.[1]!=='jpg')fail(`${label} poster must be a ${folder}<name>.jpg file`);
   if(![video.width,video.height].every(n=>Number.isInteger(n)&&n>0&&n<=3840))fail(`${label} needs its width and height in pixels`);
   const bytes=await file(site,video.mp4,'Lab video');if(bytes.length>MAX_LAB_VIDEO_BYTES)fail(`${label} is ${bytes.length} bytes; the cap is ${MAX_LAB_VIDEO_BYTES}`);
   const info=videoInfo(bytes);
   if(!['avc1','avc3'].includes(info.codec))fail(`${label} must be H.264 (avc1), not ${info.codec}`);
   if(!info.faststart)fail(`${label} must have its moov box first (ffmpeg -movflags +faststart)`);
   if(info.width!==video.width||info.height!==video.height)fail(`${label} is ${info.width}×${info.height}, not the listed ${video.width}×${video.height}`);
   const poster=imageSize(await file(site,video.poster,'Lab poster'));if(poster.width!==video.width||poster.height!==video.height)fail(`${label} poster must be ${video.width}×${video.height}`);
  }
  if(entry.scene!==undefined&&(typeof entry.scene!=='object'||!entry.scene||Object.keys(entry.scene).join()!=='example'||!SLUG.test(entry.scene.example)))fail(`Lab entry ${entry.id} scene names only the example it is built from`);
  entry.path=folder;
  const allowed=new Set(['index.html','card.jpg',...entry.videos.flatMap(video=>[video.mp4,video.poster].map(name=>name.slice(folder.length)))]);
  for(const name of await readdir(path.join(site,folder)))if(!allowed.has(name))fail(`site/${folder}${name} is not listed in site/lab.json`);
 }
 for(const name of await readdir(path.join(site,'lab')).catch(()=>[]))if(name!=='index.html'&&!ids.has(name))fail(`site/lab/${name} is not a Lab entry`);
 return entries;
}
// The playable Lab scenes, in the shape scripts/build-site.mjs exports and checks.
export const labScenes=entries=>(entries??[]).filter(entry=>entry.scene).map(entry=>({id:entry.id,example:entry.scene.example,
 title:`${entry.title} (Lab, experimental)`,summary:`Experimental: ${entry.blurb}`,path:`${entry.path}play/`,card:`${entry.path}card.jpg`,shots:[{alt:entry.cardAlt}]}));

const labHead=({title,description,url,image,imageAlt,data})=>`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#464b38">
  <link rel="icon" href="/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Holodeck">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${image}">
  <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">
  <link rel="stylesheet" href="/shelf.css">
  <script type="application/ld+json">${jsonLd(data)}</script>
</head>
<body>
  <!-- Rendered from site/lab.json by scripts/render-site.mjs. Every link is root-relative, as on the about page. -->
  <main>
    <section class="hero compact lab-hero">
      <header class="top">
        <a class="brand" href="/"><span class="mark" aria-hidden="true"></span>holodeck<span class="by">powered by Kiln</span></a>
        <nav><a href="/#scenes">Scenes</a><a href="/lab/">Lab</a><a href="https://kilnstudio.tools/">Kiln</a><a class="gh" href="https://github.com/instruktlabs/holodeck">GitHub</a></nav>
      </header>`;
const LAB_FOOT=`
  </main>
  <footer><div class="wrap"><span>holodeck · powered by <a href="https://kilnstudio.tools/">Kiln</a> · <a href="/about/">About and how to use</a> · <a href="/lab/">Lab</a></span><a href="https://github.com/instruktlabs/holodeck">github.com/instruktlabs/holodeck</a></div></footer>
</body>
</html>
`;
const LAB_LICENSE='The videos, their posters and the cards in the Lab are not part of the CC0 dedication. A playable Lab scene is exported from a bundled example world, whose scene data, manifests and GLBs are CC0; its compiled viewer is code under MIT. See <a href="https://github.com/instruktlabs/holodeck/blob/main/LICENSING.md">LICENSING.md</a>.';
const crumbs=list=>({'@type':'BreadcrumbList',itemListElement:list.map(([name,item],i)=>({'@type':'ListItem',position:i+1,name,item}))});
const engines=entry=>entry.videos.map(video=>escapeHtml(video.engine)).join(entry.videos.length>2?', ':' and ');

function renderLab(entries){
 const labUrl=new URL(LAB.path,SITE_URL).href,files={};
 const cards=entries.map(entry=>`
        <article class="lab-entry" id="lab-${entry.id}">
          <a class="lab-card" href="/${entry.path}"><img src="/${entry.path}card.jpg" width="1200" height="630" alt="${escapeHtml(entry.cardAlt)}" loading="lazy" decoding="async"></a>
          <div class="lab-copy">
            <div><p class="kicker">Experimental</p><h3><a href="/${entry.path}">${escapeHtml(entry.title)}</a></h3><p>${escapeHtml(entry.blurb)}</p><p class="lab-note">${escapeHtml(entry.status)}</p></div>
            <p class="scene-links"><a class="enter" href="/${entry.path}">Compare ${engines(entry)}</a>${entry.scene?`<a class="gallery" href="/${entry.path}play/">Play the in-browser build ↗</a>`:''}</p>
          </div>
        </article>`);
 files['lab/index.html']=labHead({title:'Lab · Holodeck',description:'Experimental, in-progress Holodeck work kept off the scene shelf: unfinished scenes and the same scene in different engines, side by side.',url:labUrl,
  image:new URL('images/card.jpg',SITE_URL).href,imageAlt:'Four Holodeck worlds: Meridian Sanctuary\'s marble terraces above the clouds, Crescent Cove\'s lagoon from the air, a snowbound mountain cabin among pines, and the Quiet Courtyard\'s fountain among cypress and olive trees.',
  data:{'@context':'https://schema.org','@type':'CollectionPage','@id':`${labUrl}#page`,name:'Holodeck Lab',url:labUrl,isPartOf:{'@id':`${SITE_URL}#website`},
   breadcrumb:crumbs([['Holodeck',SITE_URL],['Lab',labUrl]]),hasPart:entries.map(entry=>({'@type':'WebPage',name:entry.title,url:new URL(entry.path,SITE_URL).href}))}})+`
      <div class="hero-copy">
        <div>
          <p class="eyebrow">Lab · experimental</p>
          <h1>Work in progress.<br><em>Off the shelf, on purpose.</em></h1>
        </div>
        <div>
          <p class="lede">Experiments that are not ready for the scene shelf: unfinished worlds, and the same scene built in different engines, side by side. Expect rough edges. Entries change or disappear without notice.</p>
          <p class="ctas"><a class="button glass" href="/#scenes">The finished scenes</a></p>
        </div>
      </div>
    </section>

    <section class="wrap about-section lab-section" id="entries">
      <p class="kicker">In the Lab</p>
      <h2>In progress now.</h2>
      <div class="lab-entries">${cards.join('')||`
        <p class="sub">Nothing is in the Lab right now.</p>`}
      </div>
      <p class="license">${LAB_LICENSE}</p>
    </section>`+LAB_FOOT;
 for(const entry of entries){
  const url=new URL(entry.path,SITE_URL).href,play=entry.scene?`/${entry.path}play/`:null,description=`Experimental: ${entry.blurb} ${entry.status}`;
  const videos=entry.videos.map(video=>`
        <figure class="lab-video">
          <video controls muted playsinline preload="none" poster="/${video.poster}" width="${video.width}" height="${video.height}"><source src="/${video.mp4}" type="video/mp4"><a href="/${video.mp4}">Download the ${escapeHtml(video.engine)} video</a></video>
          <figcaption><strong>${escapeHtml(video.engine)}</strong>${video.caption?` ${escapeHtml(video.caption)}`:''}</figcaption>
        </figure>`);
  files[`${entry.path}index.html`]=labHead({title:`${entry.title} · Lab · Holodeck`,description,url,image:new URL('card.jpg',url).href,imageAlt:entry.cardAlt,
   data:{'@context':'https://schema.org','@type':'WebPage','@id':`${url}#page`,name:entry.title,description,url,isPartOf:{'@id':`${SITE_URL}#website`},
    breadcrumb:crumbs([['Holodeck',SITE_URL],['Lab',labUrl],[entry.title,url]]),
    video:entry.videos.map(video=>({'@type':'VideoObject',name:`${entry.title}: ${video.engine}`,description:video.caption??`${entry.title}, the ${video.engine} build.`,
     contentUrl:new URL(video.mp4,SITE_URL).href,thumbnailUrl:new URL(video.poster,SITE_URL).href,uploadDate:entry.updated,width:video.width,height:video.height}))}})+`
      <div class="hero-copy">
        <div>
          <p class="eyebrow"><a href="/lab/">Lab</a> · experimental</p>
          <h1>${escapeHtml(entry.title)}</h1>
        </div>
        <div>
          <p class="lede">${escapeHtml(entry.blurb)}</p>
          <p class="ctas">${play?`<a class="button primary" href="${play}">Play the in-browser build</a>`:''}<a class="button glass" href="#compare">Watch ${engines(entry)}</a></p>
        </div>
      </div>
    </section>

    <section class="wrap about-section lab-section" id="compare">
      <p class="lab-status" role="note"><strong>Status</strong> ${escapeHtml(entry.status)}</p>
      <p class="kicker">Side by side</p>
      <h2>${engines(entry)}.</h2>
      <div class="lab-videos">${videos.join('')}
      </div>${play?`
      <p class="lab-play"><a class="enter" href="${play}">Play the in-browser build ↗</a><span>It renders with WebGPU where the browser supports it and falls back to WebGL2. See <a href="/about/#walk">how to walk a scene</a>.</span></p>`:''}
      <p class="license">${LAB_LICENSE}</p>
    </section>`+LAB_FOOT;
 }
 return files;
}

// llms.txt (llmstxt.org), in the same shape as kilnstudio.tools/llms.txt: what Holodeck is, each
// scene from the catalog with its Kiln pack, and how to use and build it. Rendered from scenes.json
// with the shelf, so a new scene cannot be missing from it. Links are canonical URLs only.
function llmsText(scenes,lab){
 const line=(name,url,text)=>`- [${name}](${url})${text?`: ${text}`:''}`;
 return [
  '# Holodeck','',
  'Holodeck is an early source prototype: a local workspace where you and your coding agent build 3D worlds from Kiln assets, then explore them on foot in the browser. The scenes on this site are exports of its bundled example worlds. They render with WebGPU where the browser supports it and fall back to WebGL2.','',
  '## Scenes','',
  ...scenes.map(scene=>line(scene.title,new URL(scene.path,SITE_URL).href,scene.summary)),'',
  '## Use and build','',
  line('About and how to use it',new URL('about/',SITE_URL).href,'What Holodeck is, how to walk the scenes with a keyboard, mouse or touchscreen, and how to build your own world with your coding agent.'),
  line('Getting started',`${REPOSITORY}/blob/main/docs/getting-started.md`,'Run Holodeck locally with Git, Node.js and npm, then connect Codex, Cursor or Claude Code and describe what to build.'),
  line('Repository',REPOSITORY,'Source. Code is MIT; the bundled example worlds and the scenes on this site are CC0. Your own worlds are not automatically CC0.'),'',
  '## Assets','',
  line('Kiln','https://kilnstudio.tools/','The tool the models come from.'),
  line('Asset packs on Kiln',KILN_PACKS,'Downloadable packs, including one for each scene.'),
  ...scenes.filter(scene=>scene.gallery).map(scene=>line(`${scene.title} assets`,scene.gallery)),'',
  '## Optional','',
  // The Lab is listed once, marked experimental; its entries stay out of the scene list.
  ...(lab?[line('Lab (experimental)',new URL(LAB.path,SITE_URL).href,'Work in progress kept off the scene shelf: unfinished scenes and the same scene in different engines, side by side. Entries change or disappear without notice.')]:[]),
  line('Sitemap',`${SITE_URL}sitemap.xml`),'',
 ].join('\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const check=process.argv.includes('--check'),site=process.argv.slice(2).find(arg=>!arg.startsWith('--'))??fileURLToPath(new URL('../site/',import.meta.url));
 const files=await renderSite(site),stale=[];
 for(const [name,text] of Object.entries(files)){
  const target=path.join(site,name),current=await readFile(target,'utf8').catch(()=>null);
  if(current===text)continue;if(check)stale.push(name);else{await mkdir(path.dirname(target),{recursive:true});await writeFile(target,text);}
 }
 if(stale.length){console.error(`Site is stale: ${stale.join(', ')}. Run node scripts/render-site.mjs`);process.exit(1);}
 console.log(check?'Site is current.':`Rendered ${Object.keys(files).join(', ')}.`);
}
