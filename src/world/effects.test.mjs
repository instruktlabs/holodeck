import test from 'node:test';
import assert from 'node:assert/strict';
import {EFFECT_DEFAULTS,resolveEffects,validateEffects} from './effects-contract.mjs';

test('world effects are off by default, validated, and occlusion brings temporal AA (H83)',()=>{
 const bloom=EFFECT_DEFAULTS.bloom;
 assert.deepEqual(resolveEffects(undefined),{occlusion:null,temporalAA:false,sunShafts:null,bloom});
 assert.deepEqual(resolveEffects({temporalAA:true}),{occlusion:null,temporalAA:true,sunShafts:null,bloom});
 const ao=resolveEffects({occlusion:{intensity:.5}});assert.deepEqual(ao.occlusion,{...EFFECT_DEFAULTS.occlusion,intensity:.5});assert.equal(ao.temporalAA,true,'GTAO needs a single-sampled pass');
 assert.deepEqual(resolveEffects({sunShafts:{}}).sunShafts,EFFECT_DEFAULTS.sunShafts);
 assert.deepEqual(validateEffects({occlusion:{intensity:1,radius:6},temporalAA:false,sunShafts:{intensity:2}}),{occlusion:{intensity:1,radius:6},temporalAA:false,sunShafts:{intensity:2}});
 assert.deepEqual(resolveEffects({bloom:{threshold:1}}).bloom,{...bloom,threshold:1},'bloom keeps the defaults it does not set');
 assert.deepEqual(bloom,{strength:.13,radius:.25,threshold:1.8},'the default glow is unchanged');
 for(const effects of [{bloom:true},{bloom:{strength:2}},{bloom:{threshold:-1}},{bloom:{size:1}},{occlusion:{intensity:2}},{occlusion:{radius:20}},{occlusion:{falloff:1}},{temporalAA:'yes'},{sunShafts:{intensity:3}},[],null])assert.throws(()=>validateEffects(effects));
});
