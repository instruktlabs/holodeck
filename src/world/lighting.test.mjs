import test from 'node:test';
import assert from 'node:assert/strict';
import {applySceneExposure,DEFAULT_EXPOSURE,HEMISPHERE_DEFAULTS,resolveLighting,validateLighting} from './lighting.mjs';

test('omitted and partial lighting keep exact defaults without changing the document',()=>{
 const defaults={hemisphere:{skyColor:'#f1eee2',groundColor:'#95806d',intensity:1.8},exposure:1.12};
 assert.deepEqual(resolveLighting({}),defaults);
 const environment=Object.freeze({hemisphere:Object.freeze({skyColor:'#b9d2ff',intensity:0})});
 assert.equal(validateLighting(environment),environment);
 assert.deepEqual(resolveLighting(environment),{hemisphere:{skyColor:'#b9d2ff',groundColor:'#95806d',intensity:0},exposure:1.12});
 assert.equal(Object.hasOwn(environment,'exposure'),false);
 assert.equal(Object.hasOwn(environment.hemisphere,'groundColor'),false);
 assert.deepEqual(resolveLighting({hemisphere:{}}),defaults);
 assert.deepEqual(HEMISPHERE_DEFAULTS,defaults.hemisphere);assert.equal(DEFAULT_EXPOSURE,defaults.exposure);
});

test('lighting rejects invalid records, colors and numbers rather than coercing or clamping them',()=>{
 for(const hemisphere of [null,[],false,'#ffffff',{ambient:1}])assert.throws(()=>validateLighting({hemisphere}),/hemisphere/);
 for(const key of ['skyColor','groundColor'])for(const value of [null,0,['#ffffff'],'blue','#fff','#12345g'])assert.throws(()=>validateLighting({hemisphere:{[key]:value}}),new RegExp(key));
 for(const intensity of [null,false,'1',NaN,Infinity,-Infinity,-.01,8.01])assert.throws(()=>validateLighting({hemisphere:{intensity}}),/intensity/);
 for(const exposure of [null,false,'1',NaN,Infinity,-Infinity,0,.099,4.01])assert.throws(()=>validateLighting({exposure}),/exposure/);
 for(const intensity of [0,8])for(const exposure of [.1,4])assert.doesNotThrow(()=>validateLighting({hemisphere:{skyColor:'#AABBCC',groundColor:'#000000',intensity},exposure}));
});

test('exposure updates, omission and unmount restore the renderer without changing its other settings',()=>{
 const renderer={toneMappingExposure:1.12,toneMapping:'ACES',outputColorSpace:'srgb',backend:{isWebGPUBackend:false}};
 const original=structuredClone(renderer);
 let release=applySceneExposure(renderer,resolveLighting({exposure:.65}).exposure);
 assert.equal(renderer.toneMappingExposure,.65);
 // React cleans up the old layout effect before applying a changed dependency.
 release();release=applySceneExposure(renderer,resolveLighting({exposure:1.4}).exposure);
 assert.equal(renderer.toneMappingExposure,1.4);
 release();release=applySceneExposure(renderer,resolveLighting({}).exposure);
 assert.deepEqual(renderer,original,'a revision omitting exposure restores the default');
 release();assert.deepEqual(renderer,original,'unmount leaves legacy rendering unchanged');
 // Strict-mode setup/cleanup and a renderer with another initial value are safe.
 renderer.toneMappingExposure=.8;
 for(let i=0;i<2;i++){const cleanup=applySceneExposure(renderer,2);assert.equal(renderer.toneMappingExposure,2);cleanup();assert.equal(renderer.toneMappingExposure,.8);}
});
