import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as contract from './contract.mjs';

const requiredExtensions=['KHR_mesh_quantization','KHR_materials_unlit','KHR_materials_emissive_strength','EXT_mesh_gpu_instancing'];
function glb(changes={}){
  const doc={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:'body',children:[1]},{name:'leg-rest',mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,count:3,type:'VEC3',componentType:5126,min:[0,0,0],max:[1,1,0]}],...changes};
  const text=JSON.stringify(doc),json=Buffer.from(text.padEnd(Math.ceil(text.length/4)*4,' ')),bin=Buffer.alloc(36);
  new Float32Array(bin.buffer,bin.byteOffset,9).set([0,0,0,1,0,0,0,1,0]);
  const bytes=Buffer.alloc(28+json.length+bin.length);
  bytes.writeUInt32LE(0x46546c67);bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);
  bytes.writeUInt32LE(json.length,12);bytes.writeUInt32LE(0x4e4f534a,16);json.copy(bytes,20);
  bytes.writeUInt32LE(bin.length,20+json.length);bytes.writeUInt32LE(0x004e4942,24+json.length);bin.copy(bytes,28+json.length);
  return bytes;
}

test('asset delivery profile declares the current immutable static GLB contract',()=>{
  assert.deepEqual(contract.ASSET_DELIVERY_PROFILE,{id:'static-rigid-v1',version:1,container:'GLB',gltfVersion:'2.0',selfContained:true,supportedRequiredExtensions:requiredExtensions,embeddedClips:false,skinning:false,automaticLOD:false,hostGait:{module:'motion.gait@1',binding:'named-rest-joints',schemaVersion:2}});
  assert.ok(Object.isFrozen(contract.ASSET_DELIVERY_PROFILE));
  assert.ok(Object.isFrozen(contract.ASSET_DELIVERY_PROFILE.supportedRequiredExtensions));
  assert.ok(Object.isFrozen(contract.ASSET_DELIVERY_PROFILE.hostGait));
});

test('static named rest joints and empty animation arrays remain admitted',()=>{
  for(const changes of [{},{skins:[],animations:[]},{extensionsRequired:requiredExtensions},{extensionsUsed:['EXT_optional_unknown']}]){
    const bytes=glb(changes);assert.deepEqual(contract.validateGlb(bytes),{nodes:2,triangles:1,bytes:bytes.length});
  }
});

test('skinning rejection names the missing skeletal controller separately from clips',()=>{
  assert.throws(()=>contract.validateGlb(glb({skins:[{joints:[1]}]})),error=>{
    assert.match(error.message,/Skinned GLBs require a registered skeletal controller/);
    assert.match(error.message,/static-rigid-v1/);assert.match(error.message,/named child joints.*motion\.gait@1/);
    assert.doesNotMatch(error.message,/QA clips/);return true;
  });
});

test('embedded clips direct authors to separate QA artifacts and static host gait delivery',()=>{
  assert.throws(()=>contract.validateGlb(glb({animations:[{name:'QA-walk',channels:[],samplers:[]}]})),error=>{
    assert.match(error.message,/Embedded animation clips.*static-rigid-v1/);
    assert.match(error.message,/QA clips in a separate artifact/);assert.match(error.message,/named child joints.*motion\.gait@1/);
    assert.doesNotMatch(error.message,/skeletal controller/);return true;
  });
});

test('unsupported required extensions identify the existing decoder boundary without broadening admission',()=>{
  for(const extension of ['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu']){
    assert.throws(()=>contract.validateGlb(glb({extensionsRequired:['KHR_materials_unlit',extension]})),error=>{
      assert.ok(error.message.includes(extension));assert.match(error.message,/static-rigid-v1/);
      assert.match(error.message,/install\/configure and validate.*loader\/decoder in Holodeck/);
      assert.match(error.message,/installing Kiln alone does not add support/);return true;
    });
  }
});

test('unsupported extension diagnostics are bounded and do not emit control characters',()=>{
  const extensions=Array.from({length:20},(_,i)=>`EXT_${i}_\n\t${'x'.repeat(160)}`);
  assert.throws(()=>contract.validateGlb(glb({extensionsRequired:extensions})),error=>{
    assert.ok(error.message.length<1000);assert.match(error.message,/EXT_0_/);assert.match(error.message,/EXT_5_/);
    assert.doesNotMatch(error.message,/EXT_6_/);assert.match(error.message,/14 more/);
    assert.doesNotMatch(error.message,/[\u0000-\u001f\u007f]/);return true;
  });
});

test('static delivery still rejects external buffers and images',()=>{
  for(const changes of [{buffers:[{byteLength:36,uri:'mesh.bin'}]},{images:[{uri:'texture.png'}]}])assert.throws(()=>contract.validateGlb(glb(changes)),/self-contained/);
});
