import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {WebGPUBackend,WebGPURenderer} from 'three/webgpu';
import {avoidSoftwareWebGPU,reloadAfterLoss,watchRendererLoss} from '../src/viewer/renderer-recovery.mjs';

const viewerSource=()=>readFile(fileURLToPath(new URL('../src/viewer/main.jsx',import.meta.url)),'utf8');
const gpuWith=adapter=>({requestAdapter:async()=>adapter});
const withWebGL={createCanvas:()=>({getContext:type=>type==='webgl2'?{}:null})};

test('a software adapter means WebGL2, and any other answer leaves the choice to Three',async()=>{
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith({info:{isFallbackAdapter:true}}),...withWebGL}),true);
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith({info:{isFallbackAdapter:false}}),...withWebGL}),false);
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith({isFallbackAdapter:true}),...withWebGL}),true,'an older browser reports it on the adapter');
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith({info:{},isFallbackAdapter:false}),...withWebGL}),false);
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith({info:{isFallbackAdapter:false},isFallbackAdapter:true}),...withWebGL}),false,'adapter info comes first');
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith({info:{}}),...withWebGL}),false,'a browser that does not report it');
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith({}),...withWebGL}),false,'a browser with no adapter info');
 assert.equal(await avoidSoftwareWebGPU({gpu:gpuWith(null),...withWebGL}),false,'no adapter: Three makes its own fallback');
 assert.equal(await avoidSoftwareWebGPU({gpu:null,...withWebGL}),false,'no WebGPU');
 assert.equal(await avoidSoftwareWebGPU({gpu:{requestAdapter:async()=>{throw Error('refused');}},...withWebGL}),false);
});

test('a software adapter stays when there is no WebGL2 to go to',async()=>{
 const gpu=gpuWith({info:{isFallbackAdapter:true}});
 assert.equal(await avoidSoftwareWebGPU({gpu,createCanvas:()=>({getContext:()=>null})}),false);
 assert.equal(await avoidSoftwareWebGPU({gpu,createCanvas:()=>{throw Error('no canvas');}}),false);
});

test('the adapter checked is the one pinned Three asks for',async t=>{
 const asked=[];Object.defineProperty(navigator,'gpu',{configurable:true,value:{requestAdapter:async options=>{asked.push(options);return null;}}});t.after(()=>{delete navigator.gpu;});
 // What pinned R3F puts in the props it hands the viewer's renderer factory.
 const powerPreference='high-performance';
 await avoidSoftwareWebGPU({powerPreference});
 await assert.rejects(new WebGPUBackend({powerPreference}).init({xr:{enabled:false}}),/Unable to create WebGPU adapter/);
 assert.equal(asked.length,2);
 const defined=options=>Object.fromEntries(Object.entries(options).filter(([key,value])=>value!==undefined&&value!==false));
 assert.equal(asked[1].powerPreference,powerPreference,'Three sends it');
 assert.deepEqual(defined(asked[0]),defined(asked[1]));
});

test('the viewer settles the backend before making the renderer, with what the renderer gets, and leaves forced WebGL2 and the benchmark alone',async()=>{
 assert.match(await viewerSource(),/new WebGPURenderer\(\{\.\.\.props,forceWebGL:forcedGL\|\|\(!benchmarkEnabled&&await avoidSoftwareWebGPU\(\{powerPreference:props\.powerPreference\}\)\),/);
});

test('a lost renderer still runs pinned Three\'s own handler, which stops drawing, and reports which API went',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'self');
 Object.defineProperty(globalThis,'self',{configurable:true,value:{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'self',previous);else delete globalThis.self;});
 const logged=t.mock.method(console,'error',()=>{}),renderer=new WebGPURenderer({canvas:{width:1,height:1,style:{}}}),reports=[];
 watchRendererLoss(renderer,api=>reports.push(api));
 renderer.onDeviceLost({api:'WebGPU',message:'gone',reason:'unknown'});
 assert.equal(renderer._isDeviceLost,true);assert.equal(logged.mock.callCount(),1);assert.deepEqual(reports,['WebGPU']);
});

test('the way back from a lost device is WebGL2 if the browser has it, and otherwise a plain reload',()=>{
 const page=href=>({href,calls:[],replace(url){this.calls.push(['replace',url]);},reload(){this.calls.push(['reload']);}});
 const gpu=page('https://example.test/worlds/cove/?from=shelf#top');reloadAfterLoss('WebGPU',{page:gpu,...withWebGL});
 assert.deepEqual(gpu.calls,[['replace','https://example.test/worlds/cove/?from=shelf&backend=webgl#top']]);
 const gl=page('https://example.test/worlds/cove/?backend=webgl');reloadAfterLoss('WebGL',{page:gl,...withWebGL});
 assert.deepEqual(gl.calls,[['reload']]);
 const none=page('https://example.test/worlds/cove/');reloadAfterLoss('WebGPU',{page:none,createCanvas:()=>({getContext:()=>null})});
 assert.deepEqual(none.calls,[['reload']],'a WebGL2 page could only show an error');
 const broken=page('https://example.test/worlds/cove/');reloadAfterLoss('WebGPU',{page:broken,createCanvas:()=>{throw Error('no canvas');}});
 assert.deepEqual(broken.calls,[['reload']]);
});

test('a lost renderer takes the canvas, the controls and the way in with it, and a benchmark keeps reporting what it was given',async()=>{
 const viewer=await viewerSource();
 assert.match(viewer,/if\(!benchmarkEnabled\)watchRendererLoss\(renderer,setLost\);/);
 assert.match(viewer,/\{bundle&&!lost&&<Canvas /);
 assert.match(viewer,/\{!lost&&<footer /);
 assert.match(viewer,/disabled=\{[^}]*!!lost\} onClick=\{enterWorld\}/);
 assert.match(viewer,/active=\{[^}]*&&!lost\}/);
 assert.match(viewer,/if\(lost\)\{leaveWorld\(\);setHidden\(false\);setMenu\(false\);reload\.current\?\.focus\(\);\}/,'focus goes to the reload after leaving the world blurs');
 assert.match(viewer,/if\(inhabiting\|\|benchmarkEnabled\|\|lost\)return;\n.*KeyH/,'no photo mode on a dead scene');
 assert.match(viewer,/lost\?<section className="viewer-card viewer-error viewer-lost" role="alert">[^<]*<button ref=\{reload\} [^>]*onClick=\{\(\)=>reloadAfterLoss\(lost\)\}>/);
});
