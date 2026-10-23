import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,readdir,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {renderSite,imageSize,SITE_URL} from '../scripts/render-site.mjs';
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

test('the committed shelf, sitemap and robots.txt match a fresh render of scenes.json',async()=>{
 for(const [name,text] of Object.entries(await renderSite(site)))assert.equal(await readFile(path.join(site,name),'utf8'),text,`${name} is stale; run node scripts/render-site.mjs`);
});

test('the shelf page is self-contained, with sized lazy images and resolvable local links',async()=>{
 const html=await readFile(path.join(site,'index.html'),'utf8'),images=html.match(/<img\b[^>]*>/g);
 assert.ok(images.length>=9);
 for(const [i,tag] of images.entries()){
  for(const name of ['src','width','height','alt'])assert.ok(attr(tag,name)!==undefined,`${tag} lacks ${name}`);
  const size=imageSize(await readFile(path.join(site,attr(tag,'src'))));assert.deepEqual([size.width,size.height],[Number(attr(tag,'width')),Number(attr(tag,'height'))],`${attr(tag,'src')} size attributes`);
  // Only the hero loads eagerly.
  if(i===0)assert.equal(attr(tag,'fetchpriority'),'high');else assert.equal(attr(tag,'loading'),'lazy',`${attr(tag,'src')} should load lazily`);
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
 const cards=[...html.matchAll(/<article class="scene">([\s\S]*?)<\/article>/g)].map(m=>m[1]);
 assert.equal(cards.length,scenes.length);
 for(const [i,scene] of scenes.entries()){
  const images=cards[i].match(/<img\b[^>]*>/g);
  assert.deepEqual(images.map(tag=>attr(tag,'src')),scene.shots.map(shot=>shot.src));
  assert.deepEqual(images.map(tag=>attr(tag,'class')??''),['feature','','','']);
 }
 assert.equal(attr(html.match(/<a [^>]*id="first-world"[^>]*>/)[0],'href'),scenes[0].path,'the hero leads into the first scene');
});

test('long-lived caching covers only content-hashed scene files, and every page gets the security headers',async()=>{
 const rules=(await readFile(path.join(site,'_headers'),'utf8')).split(/\n(?=\S)/).filter(block=>block.startsWith('/')).map(block=>{const [route,...lines]=block.trim().split('\n');return {route,headers:Object.fromEntries(lines.map(line=>line.trim().split(/:\s*/,2)))};});
 assert.deepEqual(rules.map(rule=>rule.route),['/*','/worlds/:world/assets/*']);
 for(const name of ['X-Content-Type-Options','Referrer-Policy','Content-Security-Policy','X-Frame-Options','Permissions-Policy'])assert.ok(rules[0].headers[name],name);
 assert.doesNotMatch(rules[0].headers['Content-Security-Policy'],/script-src|default-src/,'no script policy that could break the viewer');
 assert.match(rules[1].headers['Cache-Control'],/immutable/);
 const cached=(await readdir(path.join(built,'worlds'),{recursive:true})).map(name=>name.replaceAll('\\','/')).filter(name=>/^[^/]+\/assets\/.+\.\w+$/.test(name));
 assert.ok(cached.length>100);
 for(const name of cached)assert.match(name,/\/(?:[0-9a-f]{64}\.(?:glb|png)|index-[\w-]{8}\.(?:js|css))$/,`${name} would be cached forever without a content hash`);
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
