import test from 'node:test';
import assert from 'node:assert/strict';
import {Renderer,WebGPURenderer,WebGPUBackend,WebGLBackend,REVISION} from 'three/webgpu';
import {createInitializationEvidence} from '../src/viewer/renderer-diagnostics.mjs';

function fixture(t,{primaryError=null,fallbackError=null}={}){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'self');
 Object.defineProperty(globalThis,'self',{configurable:true,value:{requestAnimationFrame:()=>1,cancelAnimationFrame(){}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'self',previous);else delete globalThis.self;});
 const f={gpu:0,gl:0,requests:0,warnings:[],canvas:{width:1,height:1,style:{}}};
 f.environment={isSecureContext:true,navigator:{gpu:{requestAdapter(){f.requests++;throw Error('No additional GPU requests are allowed');}}}};
 t.mock.method(console,'warn',(...args)=>f.warnings.push(args));
 t.mock.method(WebGPUBackend.prototype,'init',async function(renderer){f.gpu++;this.renderer=renderer;if(primaryError)throw primaryError;});
 t.mock.method(WebGLBackend.prototype,'init',async function(renderer){f.gl++;this.renderer=renderer;if(fallbackError)throw fallbackError;});
 // No graphics context is allocated by the init stubs; keep real Renderer cleanup without disposing absent GPU resources.
 t.mock.method(WebGPUBackend.prototype,'dispose',async()=>{});
 t.mock.method(WebGLBackend.prototype,'dispose',async()=>{});
 f.observe=options=>createInitializationEvidence({environment:f.environment,...options});
 f.renderer=options=>new WebGPURenderer({canvas:f.canvas,...options});
 return f;
}

test('pinned Three retains its ordinary WebGPU-to-WebGL fallback with initialization evidence',async t=>{
 assert.equal(REVISION,'186');
 const error=Object.assign(new Error('Adapter request rejected'),{name:'OperationError'}),f=fixture(t,{primaryError:error});
 const renderer=f.renderer(),primary=renderer.backend,originalInit=primary.init,observer=f.observe();
 assert.equal(await observer.initialize(renderer),renderer);
 t.after(()=>renderer.dispose());
 const evidence=observer.read();
 assert.equal(renderer.backend.isWebGLBackend,true);assert.equal(primary.init,originalInit);assert.equal(Object.hasOwn(primary,'init'),false);
 assert.deepEqual(evidence.primaryError,{name:'OperationError',message:'Adapter request rejected'});
 assert.equal(evidence.status,'ready');assert.equal(evidence.requestedBackend,'webgpu');assert.equal(evidence.actualBackend,'webgl');assert.equal(evidence.webgpuAttempt,'failed');
 assert.equal(evidence.initializationError,null);assert.equal(evidence.secureContext,true);assert.equal(evidence.webgpuApiPresent,true);
 assert.equal(f.gpu,1);assert.equal(f.gl,1);assert.equal(f.requests,0);assert.equal(f.warnings.length,1);
});

test('Three public fallback receives the identical exception, published while fallback is still pending',async t=>{
 const error=new Error('Primary failed'),f=fixture(t,{primaryError:error});
 let release,started;const pending=new Promise(resolve=>{release=resolve;}),fallbackStarted=new Promise(resolve=>{started=resolve;});
 const fallback=new WebGLBackend({canvas:f.canvas});
 fallback.init=async function(renderer){this.renderer=renderer;started();await pending;};
 const renderer=new Renderer(new WebGPUBackend({canvas:f.canvas}),{getFallback:received=>{assert.equal(received,error);return fallback;}});
 const observer=f.observe(),initializing=observer.initialize(renderer);
 await fallbackStarted;
 const during=observer.read();
 try{assert.equal(during.status,'initializing');assert.equal(during.webgpuAttempt,'failed');assert.equal(during.primaryError.message,'Primary failed');assert.equal(during.actualBackend,null);}
 finally{release();}
 await initializing;
 t.after(()=>renderer.dispose());
 assert.equal(observer.read().status,'ready');assert.equal(during.status,'initializing','published snapshots do not change after capture');
});

test('total initialization failure retains both errors and rethrows the identical fallback exception',async t=>{
 const primary=new Error('Adapter unavailable'),fallback=Object.assign(new Error('GL context unavailable'),{name:'NotSupportedError'}),f=fixture(t,{primaryError:primary,fallbackError:fallback});
 const renderer=f.renderer(),observer=f.observe();
 await assert.rejects(observer.initialize(renderer),error=>error===fallback);
 const evidence=observer.read();
 assert.equal(evidence.status,'failed');assert.equal(evidence.actualBackend,null);
 assert.equal(evidence.primaryError.message,'Adapter unavailable');assert.deepEqual(evidence.initializationError,{name:'NotSupportedError',message:'GL context unavailable'});
 assert.ok(evidence.finishedAt);assert.equal(f.gpu,1);assert.equal(f.gl,1);assert.equal(f.requests,0);
});

test('WebGPU success and forced WebGL keep their original initialization paths without extra requests',async t=>{
 const f=fixture(t),gpu=f.renderer(),observer=f.observe();
 await observer.initialize(gpu);
 t.after(()=>gpu.dispose());
 assert.equal(observer.read().actualBackend,'webgpu');assert.equal(observer.read().webgpuAttempt,'succeeded');assert.equal(observer.read().primaryError,null);
 const gl=f.renderer({forceWebGL:true}),originalInit=gl.backend.init,forced=f.observe({forceWebGL:true,environment:{isSecureContext:false,navigator:{}}});
 await forced.initialize(gl);
 t.after(()=>gl.dispose());
 assert.equal(gl.backend.init,originalInit);assert.equal(Object.hasOwn(gl.backend,'init'),false);
 assert.equal(forced.read().requestedBackend,'webgl');assert.equal(forced.read().actualBackend,'webgl');assert.equal(forced.read().webgpuAttempt,'not-attempted');
 assert.equal(forced.read().secureContext,false);assert.equal(forced.read().webgpuApiPresent,false);
 assert.equal(f.gpu,1);assert.equal(f.gl,1);assert.equal(f.requests,0);
});

test('error evidence is bounded and excludes stacks without replacing unusual thrown values',async t=>{
 const error={name:'N'.repeat(200),message:'M'.repeat(3000),stack:'EXCLUDED_STACK'},f=fixture(t,{primaryError:error}),observer=f.observe({environment:{}});
 const ready=f.renderer();await observer.initialize(ready);t.after(()=>ready.dispose());
 assert.equal(observer.read().primaryError.name.length,128);assert.equal(observer.read().primaryError.message.length,2048);
 assert.equal(observer.read().secureContext,null);assert.equal(JSON.stringify(observer.read()).includes('EXCLUDED_STACK'),false);
 const unusual={get name(){throw Error('getter');},get message(){throw Error('getter');}};
 const renderer=new Renderer(new WebGPUBackend({canvas:f.canvas}));
 renderer.backend.init=async()=>{throw unusual;};const original=renderer.backend.init,next=f.observe();
 await assert.rejects(next.initialize(renderer),value=>value===unusual);
 assert.equal(renderer.backend.init,original);assert.deepEqual(next.read().primaryError,{name:'Error',message:'Initialization failed'});
});
