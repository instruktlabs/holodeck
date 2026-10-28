import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {cp,mkdir,mkdtemp,readFile,readdir,rm,stat,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {renderSite,imageSize,videoInfo,readLab,LAB,MAX_LAB_VIDEO_BYTES,PAGES,SITE_URL} from '../scripts/render-site.mjs';
import {buildSite} from '../scripts/build-site.mjs';
import {mp4} from '../test/fixtures/mp4.mjs';

const site=fileURLToPath(new URL('../site/',import.meta.url));
// The deployable site, built once from the bundled examples as CI builds it.
let work,built;
before(async()=>{work=await mkdtemp(path.join(os.tmpdir(),'holodeck-site-test-'));built=path.join(work,'site');await buildSite({out:built,log:()=>{}});});
after(()=>work&&rm(work,{recursive:true,force:true}));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const exists=file=>stat(file).then(info=>info.isFile(),()=>false);
const attr=(tag,name)=>tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const ldBlocks=html=>[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));

test('the committed shelf, sitemap, robots.txt and llms.txt match a fresh render of scenes.json',async()=>{
 for(const [name,text] of Object.entries(await renderSite(site)))assert.equal(await readFile(path.join(site,name),'utf8'),text,`${name} is stale; run node scripts/render-site.mjs`);
});

test('the shelf page is self-contained, with sized lazy images and resolvable local links',async()=>{
 const html=await readFile(path.join(site,'index.html'),'utf8'),images=html.match(/<img\b[^>]*>/g);
 assert.ok(images.length>=9);
 for(const [i,tag] of images.entries()){
  for(const name of ['src','width','height','alt'])assert.ok(attr(tag,name)!==undefined,`${tag} lacks ${name}`);
  const size=imageSize(await readFile(path.join(site,attr(tag,'src'))));assert.deepEqual([size.width,size.height],[Number(attr(tag,'width')),Number(attr(tag,'height'))],`${attr(tag,'src')} size attributes`);
  // Only the four hero tiles load eagerly, the first first.
  if(i<4)assert.equal(attr(tag,'loading'),undefined);else assert.equal(attr(tag,'loading'),'lazy',`${attr(tag,'src')} should load lazily`);
  assert.equal(attr(tag,'fetchpriority'),i===0?'high':undefined);
 }
 for(const [,kind,value] of html.matchAll(/\s(src|href|srcset|imagesrcset)="([^"]+)"/g)){
  for(const ref of kind.endsWith('srcset')?value.split(',').map(part=>part.trim().split(/\s+/)[0]):[value]){
   if(/^https:\/\//.test(ref)||ref.startsWith('#'))continue;
   assert.ok(await exists(path.join(built,ref.endsWith('/')?`${ref}index.html`:ref)),`Missing local target ${ref}`);
  }
 }
 for(const tag of html.match(/<(script|link)\b[^>]*>/g))for(const name of ['src','href'])if(/^https?:/.test(attr(tag,name)||''))assert.ok(/rel="canonical"/.test(tag),`External resource ${tag}`);
 const css=await readFile(path.join(site,'shelf.css'),'utf8');assert.doesNotMatch(css,/https?:|\.ttf/);
 for(const [,font] of css.matchAll(/url\((fonts\/[^)]+)\)/g)){assert.match(font,/\.woff2$/);assert.ok(await exists(path.join(site,font)));}
});

test('each scene card is a Feature + 3 collage of its catalog shots',async()=>{
 const html=await readFile(path.join(site,'index.html'),'utf8'),scenes=JSON.parse(await readFile(path.join(site,'scenes.json'),'utf8'));
 const cards=[...html.matchAll(/<article class="scene" id="scene-[a-z0-9-]+">([\s\S]*?)<\/article>/g)].map(m=>m[1]);
 assert.equal(cards.length,scenes.length);
 for(const [i,scene] of scenes.entries()){
  const images=cards[i].match(/<img\b[^>]*>/g);
  assert.deepEqual(images.map(tag=>attr(tag,'src')),scene.shots.map(shot=>shot.src));
  assert.deepEqual(images.map(tag=>attr(tag,'class')??''),['feature','','','']);
 }
 // The hero's one button leads down to the build section; the slides lead into the worlds.
 assert.equal(attr(html.match(/<a class="button primary[^"]*"[^>]*>/)[0],'href'),'#build');assert.match(html,/<section[^>]*id="build"/);
 // The hero tiles open the worlds of the scenes marked hero, in catalog order, and the Scenes menu every world.
 const tiles=[...html.matchAll(/<a class="hero-tile" href="([^"]+)"><img [^>]*src="([^"]+)"/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(tiles,scenes.filter(scene=>scene.hero).map(scene=>[scene.path,scene.hero.src]));assert.equal(tiles.length,4);
 const menu=html.match(/<details class="scenes-menu">[\s\S]*?<\/details>/)[0];
 assert.deepEqual([...menu.matchAll(/href="(worlds\/[^"]+)"/g)].map(m=>m[1]),scenes.map(scene=>scene.path));
});

test('long-lived caching covers only content-hashed scene files, and every page gets the security headers',async()=>{
 const rules=(await readFile(path.join(site,'_headers'),'utf8')).split(/\n(?=\S)/).filter(block=>block.startsWith('/')).map(block=>{const [route,...lines]=block.trim().split('\n');return {route,headers:Object.fromEntries(lines.map(line=>line.trim().split(/:\s*/,2)))};});
 assert.deepEqual(rules.map(rule=>rule.route),['/*','/worlds/:world/assets/*','/lab/:entry/play/assets/*']);
 for(const name of ['X-Content-Type-Options','Referrer-Policy','Content-Security-Policy','X-Frame-Options','Permissions-Policy'])assert.ok(rules[0].headers[name],name);
 assert.doesNotMatch(rules[0].headers['Content-Security-Policy'],/script-src|default-src/,'no script policy that could break the viewer');
 for(const rule of rules.slice(1))assert.match(rule.headers['Cache-Control'],/immutable/);
 const cached=(await readdir(path.join(built,'worlds'),{recursive:true})).map(name=>name.replaceAll('\\','/')).filter(name=>/^[^/]+\/assets\/.+\.\w+$/.test(name));
 assert.ok(cached.length>100);
 const lab=await readdir(path.join(built,'lab'),{recursive:true}).catch(()=>[]);
 cached.push(...lab.map(name=>name.replaceAll('\\','/')).filter(name=>/^[^/]+\/play\/assets\/.+\.\w+$/.test(name)));
 for(const name of cached)assert.match(name,/\/(?:[0-9a-f]{64}\.(?:glb|png|r32)|[\w.-]+-[\w-]{8}\.(?:js|css|glb))$/,`${name} would be cached forever without a content hash`);
});

test('the shelf head carries a canonical URL, a social card and structured data for each scene',async()=>{
 const html=await readFile(path.join(site,'index.html'),'utf8'),scenes=JSON.parse(await readFile(path.join(site,'scenes.json'),'utf8'));
 assert.match(html,new RegExp(`<link rel="canonical" href="${SITE_URL}">`));
 const card=html.match(/<meta property="og:image" content="([^"]+)">/)[1];assert.ok(card.startsWith(SITE_URL));
 const size=imageSize(await readFile(path.join(site,card.slice(SITE_URL.length))));assert.deepEqual(size,{width:1200,height:630});
 assert.match(html,/<meta name="twitter:card" content="summary_large_image">/);
 for(const icon of ['icon.svg','apple-touch-icon.png','site.webmanifest'])assert.match(html,new RegExp(`href="${icon}"`));
 const [data]=ldBlocks(html),types=data['@graph'].map(node=>node['@type']);
 assert.deepEqual(types,['WebSite','SoftwareSourceCode','ItemList']);
 const list=data['@graph'][2].itemListElement;assert.deepEqual(list.map(entry=>entry.item.url),scenes.map(scene=>new URL(scene.path,SITE_URL).href));
 assert.equal((await readFile(path.join(site,'robots.txt'),'utf8')).includes(`Sitemap: ${SITE_URL}sitemap.xml`),true);
});

test('each scene, exported from its bundled example, has its own head tags, card and an intact hash manifest',async()=>{
 const scenes=JSON.parse(await readFile(path.join(site,'scenes.json'),'utf8'));
 assert.deepEqual((await readdir(path.join(built,'worlds'))).sort(),scenes.map(scene=>scene.id).sort());
 await assert.rejects(readdir(path.join(built,'cards')),{code:'ENOENT'},'the cards are build inputs, not site pages');
 for(const scene of scenes){
  assert.deepEqual(await readFile(path.join(built,scene.path,'preview.jpg')),await readFile(path.join(site,'cards',`${scene.id}.jpg`)));
  const root=path.join(built,scene.path),html=await readFile(path.join(root,'index.html'),'utf8'),url=new URL(scene.path,SITE_URL).href;
  assert.doesNotMatch(html,/<title>Holodeck world<\/title>/);assert.match(html,/<meta name="description" content="[^"]{40,}">/);
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`));assert.ok(html.includes(`<meta property="og:image" content="${url}preview.jpg">`));
  assert.deepEqual(imageSize(await readFile(path.join(root,'preview.jpg'))),{width:1200,height:630});
  const [data]=ldBlocks(html);assert.equal(data['@type'],'CreativeWork');assert.equal(data.url,url);
  const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
  for(const entry of manifest.files){const bytes=await readFile(path.join(root,entry.file));assert.equal(digest(bytes),entry.sha256,`${scene.id}/${entry.file}`);}
  const view=JSON.parse(await readFile(path.join(root,'scene.json'),'utf8'));assert.equal(view.world.bible.intent,'');assert.deepEqual(view.world.references,[]);
 }
});

test('the pages.dev hosts are kept out of search and the production host is not',async()=>{
 const blocks=(await readFile(path.join(site,'_headers'),'utf8')).split(/\n(?=\S)/).map(block=>block.trim().split('\n')).filter(([route])=>!route.startsWith('#'));
 const hosted=blocks.filter(([route])=>route.startsWith('https://'));
 assert.deepEqual(hosted.map(([route])=>route),['https://holodeck-5mm.pages.dev/*','https://:version.holodeck-5mm.pages.dev/*']);
 for(const [,...lines] of hosted)assert.deepEqual(lines.map(line=>line.trim()),['X-Robots-Tag: noindex']);
 // Path rules apply on holodeck.kilnstudio.tools too, so none of them may carry the header.
 for(const [route,...lines] of blocks.filter(([route])=>route.startsWith('/')))assert.ok(!lines.some(line=>/^\s*X-Robots-Tag/i.test(line)),`${route} would noindex the production host`);
});

test('every sitemap URL carries a lastmod, and the about page is listed, self-canonical and linked from the shelf',async()=>{
 const sitemap=await readFile(path.join(site,'sitemap.xml'),'utf8'),entries=[...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)];
 assert.equal(entries.length,(sitemap.match(/<url>/g)??[]).length);
 for(const [,loc,lastmod] of entries){assert.match(lastmod,/^\d{4}-\d{2}-\d{2}$/,loc);assert.ok(!Number.isNaN(Date.parse(lastmod)),loc);}
 const about=`${SITE_URL}about/`;assert.ok(entries.some(([,loc])=>loc===about));
 const html=await readFile(path.join(site,'about/index.html'),'utf8');
 assert.ok(html.includes(`<link rel="canonical" href="${about}">`));assert.ok(html.includes(`<meta property="og:url" content="${about}">`));
 assert.doesNotMatch(html,/name="robots"/);
 const card=html.match(/<meta property="og:image" content="([^"]+)">/)[1];assert.ok(card.startsWith(SITE_URL));
 assert.deepEqual(imageSize(await readFile(path.join(site,card.slice(SITE_URL.length)))),{width:1200,height:630});
 const [data]=ldBlocks(html);assert.equal(data['@type'],'AboutPage');assert.equal(data.url,about);
 for(const [,ref] of html.matchAll(/\s(?:src|href)="(\/[^"#]*)"/g))assert.ok(await exists(path.join(built,ref.endsWith('/')?`${ref}index.html`:ref)),`Missing local target ${ref}`);
 assert.match(await readFile(path.join(site,'index.html'),'utf8'),/<footer>[\s\S]*<a href="about\/">About and how to use<\/a>[\s\S]*<\/footer>/);
});

// lastmod is committed data, so it must not be older than the last commit to what the page is built from.
// A shallow checkout (CI) has no history to compare with, so the check runs where the history is.
test('sitemap dates are not older than the git history of each page',async t=>{
 const git=(...args)=>promisify(execFile)('git',['-C',fileURLToPath(new URL('../',import.meta.url)),...args]).then(result=>result.stdout.trim());
 if(await git('rev-parse','--is-shallow-repository').catch(()=>'true')!=='false')return t.skip('no full git history');
 const newest=async paths=>(await git('log','-1','--format=%cs','--',...paths))||null;
 const scenes=JSON.parse(await readFile(path.join(site,'scenes.json'),'utf8'));
 // A page is built from its HTML and, for the shelf, the catalog and images; a scene from its example
 // (the construct template also scaffolds the cove's assets) and its card.
 const sources={'':['site/index.html','site/scenes.json','site/images'],'about/':['site/about']};
 const pages=[...PAGES.map(page=>({...page,paths:sources[page.path]})),...scenes.map(scene=>({path:scene.path,updated:scene.updated,
  paths:[`examples/${scene.example}`,`examples/${scene.example}.json`,`site/cards/${scene.id}.jpg`,...(scene.example==='construct'?['assets/cove']:[])]}))];
 // The Lab's index is rendered from its catalog; an entry's page from its folder and, when it plays, its example.
 const lab=await readLab(site);
 if(lab)pages.push({...LAB,paths:['site/lab.json','site/lab/index.html']},...lab.map(entry=>({path:entry.path,updated:entry.updated,
  paths:[`site/${entry.path}`,...(entry.scene?[`examples/${entry.scene.example}`,`examples/${entry.scene.example}.json`]:[])]})));
 for(const page of pages){
  assert.ok(page.paths,`/${page.path} has no source paths to check`);
  const changed=await newest(page.paths);if(changed)assert.ok(page.updated>=changed,`/${page.path} lastmod ${page.updated} is older than its last change on ${changed}; update it`);
 }
});

test('llms.txt names every scene at its canonical URL and links only over https',async()=>{
 const text=await readFile(path.join(built,'llms.txt'),'utf8'),scenes=JSON.parse(await readFile(path.join(site,'scenes.json'),'utf8'));
 assert.match(text,/^# Holodeck\n\n/);
 const links=[...text.matchAll(/\]\(([^)]+)\)/g)].map(match=>match[1]);
 for(const scene of scenes){
  const url=new URL(scene.path,SITE_URL).href;assert.ok(links.includes(url),`llms.txt lacks ${url}`);
  assert.ok(await exists(path.join(built,scene.path,'index.html')),`${scene.path} is not in the built site`);
 }
 for(const link of links)assert.match(link,/^https:\/\//,`${link} is not an absolute https URL`);
 assert.ok(links.includes(new URL('about/',SITE_URL).href));
});

// The Lab: experimental entries, off the shelf, each with its engines' videos side by side.
test('the Lab is linked from the footers and kept off the shelf, its hero, its Scenes menu and llms.txt\'s scene list',async()=>{
 const lab=await readLab(site);if(!lab)return;
 const html=await readFile(path.join(site,'index.html'),'utf8'),text=await readFile(path.join(built,'llms.txt'),'utf8');
 assert.match(html,/<footer>[\s\S]*<a href="lab\/">Lab<\/a>[\s\S]*<\/footer>/);
 assert.match(await readFile(path.join(site,'about/index.html'),'utf8'),/<footer>[\s\S]*<a href="\/lab\/">Lab<\/a>[\s\S]*<\/footer>/);
 const shelf=html.replace(/<footer>[\s\S]*<\/footer>/,'');assert.doesNotMatch(shelf,/href="\/?lab\//,'the shelf above the footer links into the Lab');
 const scenes=text.slice(text.indexOf('## Scenes'),text.indexOf('## Use and build'));assert.doesNotMatch(scenes,/\/lab\//);
 assert.ok(text.includes(`- [Lab (experimental)](${new URL(LAB.path,SITE_URL).href}):`));
 for(const entry of lab)assert.ok(!text.includes(new URL(entry.path,SITE_URL).href),`llms.txt lists ${entry.path}`);
 const sitemap=await readFile(path.join(site,'sitemap.xml'),'utf8');
 for(const page of [LAB,...lab])assert.ok(sitemap.includes(`<loc>${new URL(page.path,SITE_URL).href}</loc><lastmod>${page.updated}</lastmod>`),page.path);
});

test('each Lab page is self-canonical, and an entry shows its videos side by side with a status note and, when it plays, its export',async()=>{
 const lab=await readLab(site);if(!lab)return;
 const pages=[[LAB.path,await readFile(path.join(built,'lab/index.html'),'utf8')]];
 for(const entry of lab)pages.push([entry.path,await readFile(path.join(built,entry.path,'index.html'),'utf8')]);
 for(const [page,html] of pages){
  const url=new URL(page,SITE_URL).href;
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`),page);assert.ok(html.includes(`<meta property="og:url" content="${url}">`),page);
  const card=html.match(/<meta property="og:image" content="([^"]+)">/)[1];assert.ok(card.startsWith(SITE_URL),page);
  assert.deepEqual(imageSize(await readFile(path.join(built,card.slice(SITE_URL.length)))),{width:1200,height:630});
  assert.equal(ldBlocks(html)[0].url,url);assert.match(html,/<p class="eyebrow">[^<]*(<a href="\/lab\/">Lab<\/a>|Lab) · experimental<\/p>/);
  for(const [,ref] of html.matchAll(/\s(?:src|href|poster)="(\/[^"#]*)"/g))assert.ok(await exists(path.join(built,ref.endsWith('/')?`${ref}index.html`:ref)),`${page} links a missing ${ref}`);
  for(const tag of html.match(/<(script|link|img|video|source)\b[^>]*>/g))for(const name of ['src','href','poster'])if(/^https?:/.test(attr(tag,name)||''))assert.ok(/rel="canonical"/.test(tag),`External resource ${tag}`);
 }
 const index=pages[0][1];
 assert.deepEqual([...index.matchAll(/<article class="lab-entry" id="lab-([a-z0-9-]+)">/g)].map(m=>m[1]),lab.map(entry=>entry.id));
 for(const [i,entry] of lab.entries()){
  const html=pages[i+1][1],videos=[...html.matchAll(/<figure class="lab-video">\s*(<video\b[^>]*>)<source src="([^"]+)" type="video\/mp4">/g)];
  assert.match(html,new RegExp(`<p class="lab-status" role="note"><strong>Status</strong> ${entry.status.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}</p>`));
  assert.equal(videos.length,entry.videos.length);assert.ok(videos.length>=2);
  for(const [j,[,tag,src]] of videos.entries()){
   const video=entry.videos[j];
   for(const flag of ['controls','muted','playsinline'])assert.match(tag,new RegExp(`\\s${flag}[\\s>]`),`${entry.id} ${video.engine} video lacks ${flag}`);
   assert.equal(src,`/${video.mp4}`);assert.equal(attr(tag,'poster'),`/${video.poster}`);assert.equal(attr(tag,'preload'),'none');
   assert.deepEqual([Number(attr(tag,'width')),Number(attr(tag,'height'))],[video.width,video.height]);
   const bytes=await readFile(path.join(built,video.mp4)),info=videoInfo(bytes);
   assert.ok(bytes.length<=MAX_LAB_VIDEO_BYTES);assert.equal(info.codec,'avc1');assert.ok(info.faststart);
   assert.deepEqual(imageSize(await readFile(path.join(built,video.poster))),{width:video.width,height:video.height});
  }
  const play=path.join(built,entry.path,'play');
  if(!entry.scene){await assert.rejects(stat(play),{code:'ENOENT'});assert.doesNotMatch(html,/\/play\//);continue;}
  const url=new URL(`${entry.path}play/`,SITE_URL).href,exported=await readFile(path.join(play,'index.html'),'utf8');
  assert.ok(exported.includes(`<link rel="canonical" href="${url}">`));assert.match(exported,/<title>[^<]*\(Lab, experimental\)[^<]*<\/title>/);
  assert.deepEqual(await readFile(path.join(play,'preview.jpg')),await readFile(path.join(site,entry.path,'card.jpg')));
  const manifest=JSON.parse(await readFile(path.join(play,'manifest.json'),'utf8'));
  for(const file of manifest.files)assert.equal(digest(await readFile(path.join(play,file.file))),file.sha256,`${entry.path}play/${file.file}`);
 }
});

test('a Lab entry needs H.264 videos of their listed size with matching posters, and nothing unlisted in its folder',async t=>{
 assert.deepEqual(videoInfo(mp4({width:1920,height:1080})),{codec:'avc1',width:1920,height:1080,faststart:true});
 assert.equal(videoInfo(mp4({codec:'hvc1'})).codec,'hvc1');assert.equal(videoInfo(mp4({faststart:false})).faststart,false);
 assert.throws(()=>videoInfo(Buffer.from('not a video at all')),/MP4/);
 const root=await mkdtemp(path.join(os.tmpdir(),'holodeck-lab-test-')),folder=path.join(root,'lab/demo');t.after(()=>rm(root,{recursive:true,force:true}));
 await mkdir(folder,{recursive:true});
 const card=await readFile(path.join(site,'images/card.jpg')),jpeg=Buffer.from(card);
 // A JPEG's size is in its frame header; the poster reuses the card's bytes with that header set to 1280×720.
 const sof=[...jpeg.keys()].find(i=>jpeg[i]===0xff&&jpeg[i+1]>=0xc0&&jpeg[i+1]<=0xc2);jpeg.writeUInt16BE(720,sof+5);jpeg.writeUInt16BE(1280,sof+7);
 await writeFile(path.join(folder,'card.jpg'),card);
 for(const name of ['a','b']){await writeFile(path.join(folder,`${name}.mp4`),mp4());await writeFile(path.join(folder,`${name}.jpg`),jpeg);}
 const video=name=>({engine:name.toUpperCase(),mp4:`lab/demo/${name}.mp4`,poster:`lab/demo/${name}.jpg`,width:1280,height:720});
 const entry={id:'demo',title:'Demo',blurb:'A demo entry.',status:'In progress.',updated:'2026-10-27',cardAlt:'A demo card.',videos:[video('a'),video('b')]};
 const write=value=>writeFile(path.join(root,'lab.json'),JSON.stringify([value]));
 await write(entry);assert.equal((await readLab(root))[0].path,'lab/demo/');
 await write({...entry,videos:[video('a')]});await assert.rejects(readLab(root),/two or more videos/);
 await write({...entry,videos:[video('a'),{...video('b'),width:1920}]});await assert.rejects(readLab(root),/is 1280×720, not the listed 1920×720/);
 await write({...entry,videos:[video('a'),{...video('b'),mp4:'images/b.mp4'}]});await assert.rejects(readLab(root),/mp4 must be a lab\/demo\/<name>\.mp4 file/);
 await write({...entry,scene:{example:'medieval-castle',path:'x'}});await assert.rejects(readLab(root),/scene names only the example/);
 await write(entry);await writeFile(path.join(folder,'b.mp4'),mp4({codec:'hvc1'}));await assert.rejects(readLab(root),/must be H\.264/);
 await writeFile(path.join(folder,'b.mp4'),mp4({faststart:false}));await assert.rejects(readLab(root),/moov box first/);
 await writeFile(path.join(folder,'b.mp4'),Buffer.concat([mp4(),Buffer.alloc(MAX_LAB_VIDEO_BYTES)]));await assert.rejects(readLab(root),/the cap is/);
 await writeFile(path.join(folder,'b.mp4'),mp4());await writeFile(path.join(folder,'placeholder.mp4'),mp4());await assert.rejects(readLab(root),/placeholder\.mp4 is not listed/);
 await rm(path.join(folder,'placeholder.mp4'));await cp(folder,path.join(root,'lab/stray'),{recursive:true});await assert.rejects(readLab(root),/site\/lab\/stray is not a Lab entry/);
});
