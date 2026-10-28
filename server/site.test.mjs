import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {renderSite,imageSize,PAGES,SITE_URL} from '../scripts/render-site.mjs';
import {buildSite} from '../scripts/build-site.mjs';

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
 assert.deepEqual(rules.map(rule=>rule.route),['/*','/worlds/:world/assets/*']);
 for(const name of ['X-Content-Type-Options','Referrer-Policy','Content-Security-Policy','X-Frame-Options','Permissions-Policy'])assert.ok(rules[0].headers[name],name);
 assert.doesNotMatch(rules[0].headers['Content-Security-Policy'],/script-src|default-src/,'no script policy that could break the viewer');
 assert.match(rules[1].headers['Cache-Control'],/immutable/);
 const cached=(await readdir(path.join(built,'worlds'),{recursive:true})).map(name=>name.replaceAll('\\','/')).filter(name=>/^[^/]+\/assets\/.+\.\w+$/.test(name));
 assert.ok(cached.length>100);
 for(const name of cached)assert.match(name,/\/(?:[0-9a-f]{64}\.(?:glb|png|r32)|index-[\w-]{8}\.(?:js|css))$/,`${name} would be cached forever without a content hash`);
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
