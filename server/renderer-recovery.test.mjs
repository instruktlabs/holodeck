import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {WebGPUBackend} from 'three/webgpu';
import {avoidSoftwareWebGPU} from '../src/viewer/renderer-recovery.mjs';

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
