import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,PlaneGeometry,BufferGeometry,BufferAttribute,MeshStandardMaterial,MeshBasicMaterial,Texture} from 'three/webgpu';
import {flowOffset,validateFlow,validateFlowBinding} from './flow-contract.mjs';
import {bindAssetFlow} from './asset-flow.mjs';
import {isReactive,reactiveNode,translucentNode} from './reactive.mjs';
import {validateWorld} from './contract.mjs';

const config=()=>({nodes:['falls_sheet'],speed:[0,1.2]});
const document=()=>({nodes:[{name:'falls_sheet',mesh:0},{name:'lip',mesh:1}],meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:1},material:0}]},{primitives:[{attributes:{POSITION:0},material:0}]}],accessors:[{count:4,type:'VEC3',componentType:5126},{count:4,type:'VEC2',componentType:5126}],materials:[{}]});

test('flow fields are explicit and bounded, and a still flow is refused',()=>{
 assert.equal(validateFlow(config()).speed[1],1.2);validateFlow({nodes:['a','b'],speed:[-.3,0]});
 for(const change of [{nodes:[]},{nodes:['a','a']},{nodes:['a b']},{speed:[0,0]},{speed:[0,5]},{speed:[1]},{speed:[0,'1']},{wind:true}])assert.throws(()=>validateFlow({...config(),...change}),/flow/i,JSON.stringify(change));
});

test('GLB flow binding needs one mesh node with UVs, and never a foliage node',()=>{
 validateFlowBinding(document(),config());
 const missing=document();missing.nodes[0].name='falls';assert.throws(()=>validateFlowBinding(missing,config()),/falls_sheet.*exactly one mesh/);
 const ambiguous=document();ambiguous.nodes.push({name:'falls_sheet',mesh:0});assert.throws(()=>validateFlowBinding(ambiguous,config()),/exactly one/);
 assert.throws(()=>validateFlowBinding(document(),{nodes:['lip'],speed:[0,1]}),/lip needs TEXCOORD_0/);
 assert.throws(()=>validateFlowBinding(document(),config(),{nodes:['falls_sheet']}),/also a foliage node/);
});

test('the texture moves the authored way and the offset stays in [0,1)',()=>{
 // Speed +1 V per second moves the image toward +V, so it is sampled from behind.
 assert.deepEqual(flowOffset([0,1],.25),[0,.75]);assert.deepEqual(flowOffset([0,-1],.25),[0,.25]);
 for(const time of [0,1e-3,7.5,86400*3+.123]){const [u,v]=flowOffset([.37,-2.9],time);assert.ok(u>=0&&u<1&&v>=0&&v<1,`${time}`);}
 assert.deepEqual(flowOffset([0,1.2],0),[0,0]);
});

test('only named meshes scroll, placements share one scrolling copy, and cleanup restores the source',()=>{
 const material=new MeshStandardMaterial({color:'#9fd9df',map:new Texture(),transparent:true,opacity:.8}),lip=new MeshBasicMaterial({color:'#ffffff'}),source=new Group();
 const sheet=new Mesh(new PlaneGeometry(1,4),material);sheet.name='falls_sheet';source.add(sheet);
 const stone=new Mesh(new PlaneGeometry(),lip);stone.name='lip';source.add(stone);sheet.castShadow=stone.castShadow=true;
 const a=source.clone(true),b=source.clone(true),first=bindAssetFlow(a,config()),second=bindAssetFlow(b,config());
 const flowing=a.getObjectByName('falls_sheet').material;
 assert.notEqual(flowing,material);assert.equal(b.getObjectByName('falls_sheet').material,flowing,'one copy per source material and speed');
 assert.ok(flowing.isNodeMaterial&&flowing.contextNode?.isContextNode,'a material-wide UV context');
 assert.equal(flowing.map,material.map);assert.equal(flowing.color.getHexString(),'9fd9df');assert.equal(flowing.transparent,true);assert.equal(flowing.opacity,.8);
 assert.equal(flowing.forceSinglePass,true,'a double-sided sheet draws in one pass (H72)');assert.equal(material.forceSinglePass,false);
 assert.equal(typeof flowing.receivedShadowNode,'function','flowing water takes the sun shadow softened (H89)');assert.ok(!material.receivedShadowNode,'the source keeps full shadows');
 assert.ok(isReactive(flowing),'flowing water marks itself reactive for world effects (H90)');assert.ok(!isReactive(material)&&!flowing.mrtNode,'unmarked materials read 0, and no per-material MRT');
 assert.equal(reactiveNode().getValueFromReference(flowing),1);assert.equal(reactiveNode().getValueFromReference(material),0);assert.equal(translucentNode().getValueFromReference(flowing),1,'the transparent sheet is translucent');assert.equal(translucentNode().getValueFromReference({transparent:false}),0);
 assert.equal(a.getObjectByName('falls_sheet').castShadow,false,'water casts no sun shadow (H97)');assert.equal(a.getObjectByName('lip').castShadow,true,'unlisted meshes still cast');assert.equal(source.getObjectByName('falls_sheet').castShadow,true);
 assert.equal(a.getObjectByName('lip').material,lip,'unlisted meshes keep their material');assert.equal(source.getObjectByName('falls_sheet').material,material,'the loader-owned source is untouched');
 first.update(.25);const offset=[...flowing.contextNode.getFlowContextData().getUV({getDefaultUV:()=>({add:node=>node})}).value];assert.deepEqual(offset.map(v=>+v.toFixed(6)),[0,.7]);
 first.dispose();assert.equal(a.getObjectByName('falls_sheet').material,material);assert.equal(a.getObjectByName('falls_sheet').castShadow,true,'cleanup restores casting');assert.equal(b.getObjectByName('falls_sheet').material,flowing,'the copy lives while another placement holds it');
 second.dispose();assert.equal(b.getObjectByName('falls_sheet').material,material);
 const bare=new Group(),noUv=new Mesh(new BufferGeometry().setAttribute('position',new BufferAttribute(new Float32Array(9),3)),material);noUv.name='falls_sheet';bare.add(noUv);
 assert.throws(()=>bindAssetFlow(bare,config()),/missing the UVs/);
});

test('worlds carry asset.flow on schema 2 ordinary assets only',()=>{
 const world=()=>({schemaVersion:2,revision:1,bible:{title:'T',intent:'I',rules:'R'},references:[],scene:{environment:{type:'construct',clearPath:true,groundColor:'#c9b994',fogColor:'#d6e5ec',sunColor:'#fff0d6',sunIntensity:3.3},bridge:null,origin:'cove',assets:[{id:'cove',file:'assets/imports/cove.glb'},{id:'falls',file:'assets/imports/falls.glb',flow:config()}],objects:[{id:'falls-1',asset:'falls',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],collider:null}],moodboard:null,runtime:{version:1,modules:['collision.boxes@1','camera.walk-orbit@1'],spawn:[0,1.72,4],look:[0,0],overview:[0,10,10],target:[0,0,0],bounds:[-20,20,-20,20],blockers:[]}}});
 validateWorld(world());
 const bad=world();bad.scene.assets[1].flow={nodes:['falls_sheet'],speed:[0,0]};assert.throws(()=>validateWorld(bad),/Flow speed/);
 const both=world();both.scene.assets[1].foliage={nodes:['falls_sheet']};assert.throws(()=>validateWorld(both),/both foliage and flow/);
 const origin=world();origin.scene.assets[0].flow=config();assert.throws(()=>validateWorld(origin),/ordinary imported placements/);
 const cove=world();cove.scene.objects[0].materialStyle='cove';assert.throws(()=>validateWorld(cove),/cove material derivation/);
});
