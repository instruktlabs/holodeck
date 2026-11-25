import test from 'node:test';
import assert from 'node:assert/strict';
import {
 QUALITY_TIERS,
 detectDeviceTier,
 applyQualityToEffects,
 applyQualityToWater,
 applyQualityToShadow,
 applyQualityToEnvironment,
} from './device-tier.mjs';
import {SUN_SHADOW} from './sun-shadow.mjs';

test('device tiering selects high, medium, and low tiers from GPU and viewport signals',()=>{
 // High-tier desktop GPU
 assert.equal(detectDeviceTier({renderer:'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11)'}).id,'high');
 assert.equal(detectDeviceTier({adapter:{vendor:'nvidia',description:'NVIDIA GeForce RTX 4080',isFallbackAdapter:false}}).id,'high');
 // Mid/low-tier laptop GPU (such as the hub GTX 1660 Ti Max-Q) -> medium
 assert.equal(detectDeviceTier({adapter:{vendor:'nvidia',description:'NVIDIA GeForce GTX 1660 Ti with Max-Q Design',isFallbackAdapter:false}}).id,'medium');
 assert.equal(detectDeviceTier({renderer:'Intel(R) Iris(R) Xe Graphics'}).id,'medium');
 // Mobile phone / software fallback -> low
 assert.equal(detectDeviceTier({adapter:{isFallbackAdapter:true}}).id,'low');
 assert.equal(detectDeviceTier({renderer:'Google SwiftShader'}).id,'low');
 assert.equal(detectDeviceTier({coarsePointer:true,screenWidth:390,screenHeight:844}).id,'low');
 // Tablet coarse pointer -> medium
 assert.equal(detectDeviceTier({coarsePointer:true,screenWidth:1024,screenHeight:768}).id,'medium');
});

test('URL override selects an explicit tier, while benchmark mode stays locked to high',()=>{
 assert.equal(detectDeviceTier({search:'?quality=low',renderer:'NVIDIA GeForce RTX 4090'}).id,'low');
 assert.equal(detectDeviceTier({search:'?quality=medium',renderer:'NVIDIA GeForce RTX 4090'}).id,'medium');
 assert.equal(detectDeviceTier({search:'?quality=high',renderer:'Google SwiftShader'}).id,'high');
 // Benchmark mode must never alter quality regardless of hardware or URL override
 assert.equal(detectDeviceTier({benchmark:true,search:'?quality=low',renderer:'NVIDIA GeForce GTX 1660 Ti with Max-Q Design'}).id,'high');
});

test('quality transforms scale effects, planar water mirror, and shadow map size cleanly',()=>{
 const fx={occlusion:{intensity:.6,radius:2.4},sunShafts:{intensity:.3},bloom:{strength:.14,radius:.3,threshold:1.2}};
 assert.deepEqual(applyQualityToEffects(fx,QUALITY_TIERS.high),fx);
 assert.deepEqual(applyQualityToEffects(fx,QUALITY_TIERS.medium),{bloom:fx.bloom});
 assert.deepEqual(applyQualityToEffects(fx,QUALITY_TIERS.low),{bloom:fx.bloom});

 const water={type:'ocean',bounds:[-20,20,-20,20],level:0,reflection:'planar',waves:[]};
 assert.equal(applyQualityToWater(water,QUALITY_TIERS.high).mirrorResolutionScale,0.5);
 assert.equal(applyQualityToWater(water,QUALITY_TIERS.medium).mirrorResolutionScale,0.35);
 assert.equal(applyQualityToWater(water,QUALITY_TIERS.medium).reflection,'planar');
 assert.equal(applyQualityToWater(water,QUALITY_TIERS.low).reflection,undefined);

 assert.equal(applyQualityToShadow(SUN_SHADOW,QUALITY_TIERS.high).mapSize,2048);
 assert.equal(applyQualityToShadow(SUN_SHADOW,QUALITY_TIERS.medium).mapSize,1024);
 assert.equal(applyQualityToShadow(SUN_SHADOW,QUALITY_TIERS.low).mapSize,1024);

 const env={sky:{light:{intensity:.42,probe:[0,2,0],grid:{min:[-10,0,-10],max:[10,10,10],spacing:10,bounces:1}}}};
 assert.equal(applyQualityToEnvironment(env,QUALITY_TIERS.high),env);
 assert.ok(applyQualityToEnvironment(env,QUALITY_TIERS.medium).sky.light.grid);
 assert.equal(applyQualityToEnvironment(env,QUALITY_TIERS.low).sky.light.grid,undefined);
 assert.deepEqual(applyQualityToEnvironment(env,QUALITY_TIERS.low).sky.light.probe,[0,2,0]);
});
