import test from 'node:test';
import assert from 'node:assert/strict';
import {SETTLE,compileGate,enableParallelCompile} from './parallel-compile.js';

// A stand-in for three's WebGL backend: createRenderPipeline pushes one link promise per
// new program into the array it is given (three's compileAsync path) or links synchronously.
function fakeRenderer({webgpu=false,parallel=true}={}){
 const links=[],calls=[];
 const backend={isWebGPUBackend:webgpu,parallel:parallel?{}:null,
  createRenderPipeline(renderObject,promises){calls.push({renderObject,promises});if(!promises)return;let done;const p=new Promise(r=>{done=r;});links.push(done);promises.push(p);}};
 return {renderer:{backend},backend,links,calls};
}
const tick=()=>new Promise(r=>setTimeout(r,0));

test('WebGPU and WebGL2 without KHR_parallel_shader_compile keep three\'s own pipeline path',()=>{
 for(const options of [{webgpu:true},{parallel:false}]){
  const {renderer,backend}=fakeRenderer(options),original=backend.createRenderPipeline;
  enableParallelCompile(renderer);
  assert.equal(backend.createRenderPipeline,original);assert.equal(renderer.pendingCompiles,undefined);
  let gate=compileGate(renderer);assert.deepEqual(gate,{ready:false,settled:1,compiling:0});
  for(let i=1;i<SETTLE;i++)gate=compileGate(renderer,gate.settled);
  assert.equal(gate.ready,true);
 }
});

test('new WebGL2 programs link through the async path and are counted until they finish',async()=>{
 const {renderer,backend,links,calls}=fakeRenderer();
 enableParallelCompile(renderer);
 backend.createRenderPipeline({id:'a'});backend.createRenderPipeline({id:'b'});
 assert.ok(calls.every(c=>Array.isArray(c.promises)),'each draw-time pipeline starts an async link');
 assert.equal(renderer.pendingCompiles(),2);
 links[0]();await tick();assert.equal(renderer.pendingCompiles(),1);
 links[1]();await tick();assert.equal(renderer.pendingCompiles(),0);
 // An explicit compileAsync call already passes its own array and is left alone.
 const own=[];backend.createRenderPipeline({id:'c'},own);
 assert.equal(own.length,1);assert.equal(renderer.pendingCompiles(),0);
});

test('ready waits for consecutive frames with nothing compiling and restarts when a link begins',async()=>{
 const {renderer,backend,links}=fakeRenderer();
 enableParallelCompile(renderer);
 backend.createRenderPipeline({id:'a'});
 let gate=compileGate(renderer);
 assert.deepEqual(gate,{ready:false,settled:0,compiling:1});
 links[0]();await tick();
 for(let frame=1;frame<SETTLE;frame++){gate=compileGate(renderer,gate.settled);assert.equal(gate.ready,false);assert.equal(gate.settled,frame);}
 gate=compileGate(renderer,gate.settled);assert.equal(gate.ready,true);
 backend.createRenderPipeline({id:'b'});
 assert.deepEqual(compileGate(renderer,gate.settled),{ready:false,settled:0,compiling:1});
});
