import test from 'node:test';
import assert from 'node:assert/strict';
import {completeRenderFrame,readRenderReadiness,resetRenderReadiness} from './render-readiness.mjs';
import {enableParallelCompile,SETTLE} from './parallel-compile.js';
import {completeWorldFrame,resetWorldProbe} from './world-probe.mjs';
import {assertRenderReady} from '../viewer/benchmark-protocol.mjs';

test('a newly visible program makes a previously settled renderer unready after that render',async()=>{
 let finish;
 const renderer={backend:{parallel:{},createRenderPipeline(object,promises){promises.push(new Promise(resolve=>{finish=resolve;}));}}};
 enableParallelCompile(renderer);
 for(let i=0;i<SETTLE;i++)completeRenderFrame(renderer);
 assert.equal(readRenderReadiness(renderer).renderReady,true);
 // The render starts a new pipeline. The gate runs afterward, not before it.
 renderer.backend.createRenderPipeline({id:'newly-visible'});
 const pending=completeRenderFrame(renderer);
 assert.deepEqual(pending,{renderReady:false,pendingCompiles:1,settledFrames:0});
 assert.throws(()=>assertRenderReady(pending),/not settled/);
 finish();await Promise.resolve();
 for(let i=1;i<SETTLE;i++)assert.equal(completeRenderFrame(renderer).renderReady,false);
 assertRenderReady(completeRenderFrame(renderer));
});

test('resetting for a newly applied scenario requires three new completed frames, even without new shaders',()=>{
 const renderer={};for(let i=0;i<SETTLE;i++)completeRenderFrame(renderer);
 const old=readRenderReadiness(renderer);assert.equal(old.renderReady,true);
 resetRenderReadiness(renderer);
 for(let i=0;i<20;i++)assert.equal(readRenderReadiness(renderer).settledFrames,0,'status polling cannot settle a view');
 assert.throws(()=>assertRenderReady(readRenderReadiness(renderer)),/not settled/);
 for(let i=1;i<SETTLE;i++)assert.equal(completeRenderFrame(renderer).renderReady,false);
 assert.equal(completeRenderFrame(renderer).renderReady,true);
 assert.equal(old.renderReady,true,'previous evidence remains a snapshot');
});

test('legacy mesh and loaded-frame readiness cannot override render readiness or another renderer',()=>{
 const renderer={pendingCompiles:()=>1},other={},probe={};
 resetWorldProbe(probe,'world:1');completeRenderFrame(renderer,probe);
 probe.ready=true; // The legacy Cove mount marker.
 probe.position=[1,2,3];probe.frames=[16];
 assert.equal(completeWorldFrame(probe,'world:1',3),true);
 assert.equal(probe.ready,true);assert.equal(probe.renderReady,false);
 assert.equal(probe.pendingCompiles,1);assert.equal(readRenderReadiness(renderer).renderReady,false);
 for(let i=0;i<SETTLE;i++)completeRenderFrame(other);
 assert.equal(readRenderReadiness(other).renderReady,true);
 assert.equal(readRenderReadiness(renderer).renderReady,false);
 resetWorldProbe(probe,'world:2');assert.equal(probe.renderReady,false);assert.equal(probe.pendingCompiles,0);
});

test('a pending program cannot qualify even if a stale readiness flag was true',()=>{
 assert.throws(()=>assertRenderReady({renderReady:true,pendingCompiles:1}),/not settled/);
 assert.throws(()=>assertRenderReady({ready:true}),/not settled/);
});
