import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {renderSite,imageSize,SITE_URL} from '../scripts/render-site.mjs';

const site=fileURLToPath(new URL('../site/',import.meta.url));
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
   assert.ok(await exists(path.join(site,ref.endsWith('/')?`${ref}index.html`:ref)),`Missing local target ${ref}`);
  }
 }
 for(const tag of html.match(/<(script|link)\b[^>]*>/g))for(const name of ['src','href'])if(/^https?:/.test(attr(tag,name)||''))assert.ok(/rel="canonical"/.test(tag),`External resource ${tag}`);
 const css=await readFile(path.join(site,'shelf.css'),'utf8');assert.doesNotMatch(css,/https?:|\.ttf/);
 for(const [,font] of css.matchAll(/url\((fonts\/[^)]+)\)/g)){assert.match(font,/\.woff2$/);assert.ok(await exists(path.join(site,font)));}
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

test('each scene export has its own head tags, card and an intact hash manifest',async()=>{
 const scenes=JSON.parse(await readFile(path.join(site,'scenes.json'),'utf8'));
 assert.deepEqual((await readdir(path.join(site,'worlds'))).sort(),scenes.map(scene=>scene.id).sort());
 for(const scene of scenes){
  const root=path.join(site,scene.path),html=await readFile(path.join(root,'index.html'),'utf8'),url=new URL(scene.path,SITE_URL).href;
  assert.doesNotMatch(html,/<title>Holodeck world<\/title>/);assert.match(html,/<meta name="description" content="[^"]{40,}">/);
  assert.ok(html.includes(`<link rel="canonical" href="${url}">`));assert.ok(html.includes(`<meta property="og:image" content="${url}preview.jpg">`));
  assert.deepEqual(imageSize(await readFile(path.join(root,'preview.jpg'))),{width:1200,height:630});
  const [data]=ldBlocks(html);assert.equal(data['@type'],'CreativeWork');assert.equal(data.url,url);
  const manifest=JSON.parse(await readFile(path.join(root,'manifest.json'),'utf8'));
  for(const entry of manifest.files){const bytes=await readFile(path.join(root,entry.file));assert.equal(digest(bytes),entry.sha256,`${scene.id}/${entry.file}`);}
  const view=JSON.parse(await readFile(path.join(root,'scene.json'),'utf8'));assert.equal(view.world.bible.intent,'');assert.deepEqual(view.world.references,[]);
 }
});
