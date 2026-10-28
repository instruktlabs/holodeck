import React,{useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three/webgpu';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {positionView,uniform,smoothstep,normalize,dot,acos,clamp,mix,float,texture,uv,materialColor} from 'three/tsl';
import {browserProfile,browserProfiles} from './game/weapon-browser-profiles.mjs';
import {createWeapon,command,step,pose,attach,specFor,shoot,ignite} from './game/weapon.mjs';
import {createRecoil,fireRecoil,stepRecoil} from './game/recoil.mjs';
import {pullTrigger,releaseTrigger,cycleFireMode,burstLeft} from './game/trigger.mjs';
import {runFireFrame} from './game/fire-frame.mjs';
import {createMouseButtons,readMouseButtons} from './game/mouse-buttons.mjs';
import {createRange,restoreRange,rangeAction,canRecord,recordShot,stepRange,startOnTrigger} from './game/range-session.mjs';
import {bindRange} from './game/range-three.mjs';
import {rangeUI} from './game/range-ui.mjs';
import {bindRangeConsoles} from './game/range-console.mjs';
import {bindArmIK,applyArmIK} from './game/arm-ik-three-v5.mjs';

function disposeTrees(...trees){const geometries=new Set(),materials=new Set(),skeletons=new Set(),textures=new Set();for(const tree of trees)tree.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material)for(const m of Array.isArray(n.material)?n.material:[n.material])materials.add(m);if(n.skeleton)skeletons.add(n.skeleton);});for(const m of materials)for(const value of Object.values(m))if(value?.isTexture)textures.add(value);for(const s of skeletons)s.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();}

// Analytic ghost ring (docs/sight-research-v1.md 5.3): the rear aperture fades by the angle between each fragment's view ray and
// the aperture centre, approximating an eye focused on the front sight. Targets and the front sight stay sharp.
function ghostRingMaterial(source,ring){
 const aim=uniform(0),axis=uniform(new THREE.Vector3(0,0,-1)),core=uniform(0),outer=uniform(1),theta=acos(clamp(dot(normalize(positionView),axis),-1,1)),fade=smoothstep(core,outer,theta);
 const m=new THREE.MeshStandardNodeMaterial({name:source.name+'_GhostRing',roughness:source.roughness,metalness:source.metalness,roughnessMap:source.roughnessMap,metalnessMap:source.metalnessMap,normalMap:source.normalMap,normalScale:source.normalScale,transparent:true,depthWrite:false});
 const base=source.map?texture(source.map,uv()).mul(materialColor):materialColor;m.color.copy(source.color);m.colorNode=base.mul(mix(float(1),float(1-ring.darken),aim.mul(fade)));m.opacityNode=mix(float(1),fade,aim);
 return {material:m,aim,axis,core,outer};
}

// The full workbench (profile menu, action buttons, rig readouts) is a test surface: ?weaponDebug=1 shows it, play shows a short HUD.
const debugHud=()=>{const q=new URLSearchParams(window.location.search);return q.get('weaponDebug')==='1'||q.get('weaponReview')==='1';};
function WeaponWorkbench({runtime,cameraMode,inhabiting,person,look,weaponId,choose}){
 const profile=useMemo(()=>browserProfile(weaponId),[weaponId]),motion=profile.motion,armRig=profile.rig,weaponSpec=specFor(profile.id);
 const {camera,gl,scene}=useThree(),[kit,setKit]=useState(null),[error,setError]=useState('');
 const rackHover=useRef(null),range=useRef(null),binding=useRef(null),consoles=useRef(null),rangeHud=useRef(null),wasActive=useRef(false),saved=useRef('');
 const storageKey='range-study-v1:fd10d5d1-cb96-42e6-bd1b-36485ffe9019'+(profile.id==='pistol'?'':':'+profile.id);
 if(!range.current){try{const stored=localStorage.getItem(storageKey);range.current=stored?restoreRange(JSON.parse(stored)):createRange(crypto.randomUUID());}catch{range.current=createRange(crypto.randomUUID());}}
 range.current.weaponId=weaponSpec.id;
 const state=useRef(createWeapon(profile.id)),recoil=useRef(createRecoil(profile.id)),review=useRef({clip:'Live',phase:.25,yaw:0}),aimBlend=useRef(0),active=inhabiting&&cameraMode==='walk'&&person==='first',gate=useRef(false),ui=useRef(null);
 gate.current=active&&!runtime.paused;
 // Hold-to-aim on the right mouse button (pointer lock only): true while held, false once released until aim drops, null otherwise.
 const holdAim=useRef(null);
 const root=useMemo(()=>new THREE.Group(),[]),direction=useMemo(()=>new THREE.Vector3(),[]),local=useMemo(()=>new THREE.Vector3(),[]),lens=useRef(null);
 // Held-trigger profiles (round v14): rounds fall at their own times inside a frame (game/fire-frame.mjs). A round leaves along the
 // frame's aim turned by the kick already turned in that frame, the way the host's look turns (yaw, then pitch clamped to -1.5..1.3).
 const fire=weaponSpec.fire,pan=useRef(-1);
 const turned=turn=>{camera.getWorldDirection(direction);const pitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(direction.y,-1,1))+turn[0]*Math.PI/180,-1.5,1.3),yaw=Math.atan2(-direction.x,-direction.z)-turn[1]*Math.PI/180;return direction.set(-Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));};
 // The gun has fired by now, so it kicks even if the range no longer records (a string that ended between lock and ignition).
 const recordRound=(id,turn)=>{const ray={origin:camera.position.toArray(),direction:turned(turn).toArray()},shot=binding.current?recordShot(range.current,id,ray,binding.current.surfaces(),binding.current.boxes()):null;fireRecoil(recoil.current,range.current.id,shot?.id??id);if(shot)binding.current.impact(shot);if(shot?.outcome==='hit')state.current.hits++;state.current.message=shot?.outcome==='hit'?'Target hit':shot?.outcome??'Shot';};
 // 'shot' and 'lock' ask the gun, then the range, like the semi guns; 'ignite' sends the ball the lock committed.
 const roundEvent=(type,turn)=>{const w=state.current,id=range.current.id+':command:'+(range.current.shots.length+1);
  if(type==='ignite'){ignite(w);recordRound(id,turn);return true;}
  if(w.mode!=='idle'||!w.ammo||(weaponSpec.cycleBlocksActions&&w.cooldown>0))return shoot(w);
  if(binding.current)startOnTrigger(range.current);
  if(!binding.current||!canRecord(range.current,id)){w.message=binding.current?range.current.message:'Waiting for target bindings…';return false;}
  if(!shoot(w))return false;if(type==='shot')recordRound(id,turn);else pan.current=w.trigger.time+fire.panFlashSeconds;return true;};
 // The host sets FOV and near once at canvas creation; aim blends them per profile and restores them on leaving first person.
 useEffect(()=>{lens.current={fov:camera.fov,near:camera.near};return()=>{const l=lens.current;if(l&&(camera.fov!==l.fov||camera.near!==l.near)){camera.fov=l.fov;camera.near=l.near;camera.updateProjectionMatrix();}};},[camera]);
 useEffect(()=>{const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(range.current));}catch{range.current.message='Local save unavailable — export this session';}};
  const rangeDo=(action,arg)=>{if(!gate.current||!binding.current||review.current.clip!=='Live')return false;const ok=rangeAction(range.current,action,arg);save();return ok;};
  const exportSession=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(range.current,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='range-session-'+range.current.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  rangeHud.current=rangeUI(rangeDo,exportSession);/* In play the string and target review opens with J; the debug view shows it from the start. */rangeHud.current.shown=debugHud();rangeHud.current.host.style.display=rangeHud.current.shown?'':'none';
  // Range keys work with the mouse locked (owner decision, 27 Oct): Unreal's keys where the host leaves them free, plus L and P because the host keeps 1-3 and T for emotes and Enter for the composer.
  const keys=e=>{if(e.repeat||!gate.current||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;const s=range.current,lanes=['paper','plates','original'];
   if(e.code==='KeyL'){if(!rangeDo('select',lanes[(lanes.indexOf(s.lane)+1)%lanes.length])&&s.phase==='active')s.message='Lane is fixed during a string — Backspace ends it';}
   else if(e.code==='Backspace')rangeDo('end');else if(e.code==='KeyP')rangeDo('return');else if(e.code==='KeyY')rangeDo(s.lane==='plates'?'start':'replace');
   else if(e.code==='PageUp'||e.code==='PageDown')rangeHud.current?.review(e.code==='PageUp'?-1:1);else if(e.code==='F8')exportSession();else return;
   e.preventDefault();};
  const hide=()=>{if(document.hidden){rangeAction(range.current,'leave');save();}};document.addEventListener('visibilitychange',hide);window.addEventListener('keydown',keys);
  return()=>{save();document.removeEventListener('visibilitychange',hide);window.removeEventListener('keydown',keys);binding.current?.dispose();binding.current=null;consoles.current?.dispose();consoles.current=null;rangeHud.current?.dispose();rangeHud.current=null;};
 },[runtime,scene]);
 useEffect(()=>{let live=true, mixer;const loader=new GLTFLoader();const load=async(url,pin)=>{const r=await fetch(url);if(!r.ok)throw Error('Asset fetch failed');const bytes=await r.arrayBuffer(),sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');if(sha!==pin.sha256)throw Error('Pinned asset hash mismatch');return loader.parseAsync(bytes,'');};Promise.all([load(profile.gunUrl,profile.pins.gun),load(profile.handsUrl,profile.pins.hands),profile.tokenUrl?load(profile.tokenUrl,profile.pins.token):Promise.resolve(null)]).then(([gun,hands,token])=>{
  if(!live){disposeTrees(...[gun.scene,hands.scene,token?.scene].filter(Boolean));return;}root.add(gun.scene,hands.scene);
  const grips=[];gun.scene.traverse(n=>{if(n.isMesh){n.castShadow=false;if(n.material.name==='WalnutGrip'&&!grips.includes(n.material))grips.push(n.material);}});
  hands.scene.traverse(n=>{if(n.isMesh){n.castShadow=false;n.frustumCulled=false;}});
  const wrist=hands.scene.getObjectByName('Joint_left_left_wrist'),finger=hands.scene.getObjectByName('Joint_rightFinger0_right_finger0_mid');
  if(!wrist||!finger||!hands.scene.getObjectByName('Mesh_Gloves')?.isSkinnedMesh)throw Error('Skinned hand contract missing');
  const actions={};mixer=new THREE.AnimationMixer(hands.scene);
  if(token){const anchor=hands.scene.getObjectByName('Joint_right_right_wrist');if(!anchor)throw Error('Loading cue wrist missing');anchor.add(token.scene);token.scene.position.fromArray(motion.cartridge.rightWristRelativeCenter);token.scene.rotation.fromArray(motion.cartridge.rightWristRelativeRotation??[0,0,0]);token.scene.visible=false;token.scene.traverse(n=>{if(n.isMesh)n.castShadow=false;});}
  const lever=gun.scene.getObjectByName('Joint_Lever'),hammer=gun.scene.getObjectByName('Joint_Hammer');if(profile.id==='rifle1866'&&(!lever||!hammer))throw Error('Rifle moving-part contract missing');
  const boltSlide=profile.id==='boltNo4'?gun.scene.getObjectByName('Joint_BoltSlide'):null,boltLift=profile.id==='boltNo4'?gun.scene.getObjectByName('Joint_BoltLift'):null;if(profile.id==='boltNo4'&&(!boltSlide||!boltLift||boltLift.parent!==boltSlide))throw Error('Bolt moving-part contract missing');
  // M4 (round v14): the magazine drops along its well axis and hides once clear. A copy rides the left wrist while magCue > 0.5, and
  // the gun's magazine rises with it along the same axis into the well, so only the copy hides at the commit. The handle slides back.
  const magazineBlock=motion.magazine,cueBlock=motion.magazineCue,handleBlock=motion.chargingHandle,magazine=magazineBlock?gun.scene.getObjectByName(magazineBlock.node):null,handle=handleBlock?gun.scene.getObjectByName(handleBlock.node):null;
  if((magazineBlock&&!magazine)||(handleBlock&&!handle)||(magazineBlock?.seatedPosition&&magazine.position.distanceTo(new THREE.Vector3(...magazineBlock.seatedPosition))>1e-5))throw Error('Carbine moving-part contract missing');
  let magazineCue=null;if(cueBlock){const cueWrist=hands.scene.getObjectByName(cueBlock.parent);if(!cueWrist)throw Error('Magazine cue wrist missing');magazineCue=magazine.clone(true);magazineCue.name='Cue_'+magazine.name;cueWrist.add(magazineCue);magazineCue.position.fromArray(cueBlock.leftWristRelativeCenter);magazineCue.rotation.fromArray(cueBlock.leftWristRelativeRotation);magazineCue.scale.set(1,1,1);magazineCue.visible=false;}
  for(const [name,spec]of Object.entries(motion.clips)){const clip=hands.animations.find(c=>c.name===name);if(!clip||Math.abs(clip.duration-spec.duration)>.025)throw Error('Missing or incompatible clip: '+name);const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;actions[name]=action;}
  const view=profile.view,rearAnchor=gun.scene.getObjectByName('anchor_sight_rear'),rings=[];
  if(view.ghostRing){const owner=gun.scene.getObjectByName(view.ghostRing.node);if(!owner||!rearAnchor)throw Error('Ghost-ring sight contract missing');owner.traverse(n=>{if(n.isMesh){const g=ghostRingMaterial(n.material,view.ghostRing);n.material=g.material;rings.push(g);}});}
  const frontOwner=view.frontSight?gun.scene.getObjectByName(view.frontSight.node):null,frontAnchor=view.frontSight?gun.scene.getObjectByName(view.frontSight.anchor):null;let frontWidth=0;if(frontOwner){const box=new THREE.Box3();frontOwner.traverse(n=>{if(n.isMesh){n.geometry.computeBoundingBox();box.union(n.geometry.boundingBox);}});frontWidth=box.max.z-box.min.z;}
  setKit({rearAnchor,rings,frontOwner,frontAnchor,frontWidth,gun:gun.scene,hands:hands.scene,chains:bindArmIK(hands.scene,armRig),slide:profile.id==='pistol'?gun.scene.getObjectByName('Joint_Slide'):null,mag:profile.id==='pistol'?gun.scene.getObjectByName('Joint_Magazine'):null,boltSlide,boltLift,boltSlideRest:boltSlide?.position.clone(),boltLiftRest:boltLift?.quaternion.clone(),grips,mixer,actions,lever,hammer,leverRest:lever?.quaternion.clone(),hammerRest:hammer?.quaternion.clone(),token:token?.scene,magazine,magazineCue,handle,magazineRest:magazine?.position.clone(),handleRest:handle?.position.clone(),magazineAxis:magazineBlock?new THREE.Vector3(...magazineBlock.dropAxis):null,handleAxis:handleBlock?new THREE.Vector3(...handleBlock.axis):null,current:null});
 }).catch(e=>{if(live)setError(e.message);});return()=>{live=false;if(mixer){mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());}disposeTrees(root);root.clear();};},[root,profile]);
 useEffect(()=>{
  const host=document.createElement('section');host.setAttribute('aria-label','Weapon workbench');Object.assign(host.style,{position:'fixed',left:'24px',top:'78px',zIndex:20,background:'#0d161ce8',color:'#e2e9e8',padding:'14px 18px',border:'1px solid #52615d',borderRadius:'10px',font:'13px system-ui',maxWidth:'min(620px, calc(100vw - 418px))'});
  const title=document.createElement('strong');title.textContent=profile.title+' / skinned gloves';host.append(title);
  const equipment=document.createElement('select');equipment.setAttribute('aria-label','Weapon profile');equipment.style.marginLeft='10px';for(const [id,p]of Object.entries(browserProfiles)){const option=document.createElement('option');option.value=id;option.textContent=p.title;equipment.append(option);}equipment.value=profile.id;const trySwitch=id=>{if(id===profile.id)return;if(state.current.mode!=='idle'||state.current.cooldown>0||['active','returning','deploying','blocked'].includes(range.current.phase)){equipment.value=profile.id;return;}rangeAction(range.current,'leave');try{localStorage.setItem(storageKey,JSON.stringify(range.current));}catch{equipment.value=profile.id;state.current.message='Profile unchanged: export the session before retrying; local save unavailable';return;}choose(id);};equipment.onchange=()=>trySwitch(equipment.value);host.append(equipment);
  const status=document.createElement('div');status.setAttribute('role','status');status.style.margin='8px 0';host.append(status);
  const act=(action)=>{if(!gate.current||!kit||review.current.clip!=='Live'||document.hidden)return;
   // A click (workbench button) on a held-trigger gun is a pull and a release; the round falls in the next frame.
   if(action==='fire'&&fire){pullTrigger(state.current.trigger);releaseTrigger(state.current.trigger);return;}
   if(action==='mode'){if(fire&&cycleFireMode(state.current.trigger,fire))state.current.message='Mode: '+state.current.trigger.mode;return;}
   if(action==='fire'){const w=state.current,id=range.current.id+':command:'+(range.current.shots.length+1);if(w.mode!=='idle'||w.cooldown>0||!w.ammo){command(w,'fire');return;}
    if(binding.current)startOnTrigger(range.current);
    if(!binding.current||!canRecord(range.current,id)){w.message=binding.current?range.current.message:'Waiting for target bindings…';return;}camera.getWorldDirection(direction);const ray={origin:camera.position.toArray(),direction:direction.toArray()},surfaces=binding.current.surfaces();if(command(state.current,'fire')){const shot=recordShot(range.current,id,ray,surfaces,binding.current.boxes());/* Recoil v1: the shot used the aim above; its kick turns the look after it. */if(shot)fireRecoil(recoil.current,range.current.id,shot.id);binding.current.impact(shot);if(shot?.outcome==='hit')state.current.hits++;state.current.message=shot?.outcome==='hit'?'Target hit':shot?.outcome??'Shot';}}
   else if(action==='grip')attach(state.current,'grip',state.current.grip==='walnut'?'charcoal':'walnut');else if(action==='reject')attach(state.current,'optic','red-dot');else command(state.current,action);
  };
  const buttons=[];for(const [action,label] of [['inspect','I · Inspect'],['aim','Q · Aim (hold RMB)'],['fire','F / LMB · Fire'],...(fire?.modes.length>1?[['mode','B · Fire mode']]:[]),['reload','R · Reload'],['grip','C · Swap grips'],['reject','Check incompatible optic']]){const b=document.createElement('button');b.dataset.action=action;b.textContent=label;Object.assign(b.style,{background:'#263c40',color:'white',border:'1px solid #668480',borderRadius:'4px',padding:'6px',marginRight:'5px',marginBottom:'5px',cursor:'pointer'});b.onclick=()=>{act(action);b.blur();};buttons.push(b);host.append(b);}
  if(new URLSearchParams(window.location.search).get('weaponReview')==='1'){
   const row=document.createElement('div'),label=document.createElement('label'),select=document.createElement('select'),slider=document.createElement('input');label.textContent='Pose review ';select.setAttribute('aria-label','Pose review clip');for(const name of ['Live',...Object.keys(motion.clips)]){const o=document.createElement('option');o.value=name;o.textContent=name;select.append(o);}select.value=review.current.clip;select.onchange=()=>{review.current.clip=select.value;};slider.type='range';slider.min='0';slider.max='100';slider.step='1';slider.value=String(review.current.phase*100);slider.setAttribute('aria-label','Pose review phase');slider.oninput=()=>{review.current.phase=Number(slider.value)/100;};const view=document.createElement('select');view.setAttribute('aria-label','Pose review view');for(const [name,value]of [['Action view',0],['Left side',.88],['Right side',-.72]]){const o=document.createElement('option');o.textContent=name;o.value=String(value);view.append(o);}view.value=String(review.current.yaw);view.onchange=()=>{review.current.yaw=Number(view.value);};label.append(select);row.append(label,slider,view);host.append(row);
  }
  // Held-trigger guns pull on F down and release on F up; B switches the fire mode.
  const pull=()=>{if(gate.current&&kit&&review.current.clip==='Live'&&!document.hidden)pullTrigger(state.current.trigger);},release=()=>{if(fire)releaseTrigger(state.current.trigger);};
  const key=e=>{if(e.repeat||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(e.target.tagName))return;if(e.code==='KeyJ'&&gate.current&&rangeHud.current){e.preventDefault();const r=rangeHud.current;r.shown=!r.shown;r.host.style.display=r.shown?'':'none';return;}if(e.code==='KeyX'&&gate.current&&rackHover.current){e.preventDefault();trySwitch(rackHover.current);return;}if(fire&&e.code==='KeyF'){if(gate.current){e.preventDefault();pull();}return;}const action={KeyI:'inspect',KeyQ:'aim',KeyF:'fire',KeyR:'reload',KeyC:'grip',KeyB:fire?'mode':null}[e.code];if(action&&gate.current){e.preventDefault();act(action);}};
  const keyUp=e=>{if(fire&&e.code==='KeyF')release();};
  const locked=()=>document.pointerLockElement===gl.domElement;
  // Presses and releases come from the buttons mask: LMB pressed while RMB holds aim arrives as pointermove, not pointerdown.
  const pointer=createMouseButtons(),mouse=e=>{const b=readMouseButtons(pointer,e.buttons);if(b.aimUp&&holdAim.current)holdAim.current=false;if(b.triggerUp)release();if(!locked()||!gate.current)return;if(b.aimDown){e.preventDefault();holdAim.current=true;}if(b.triggerDown){if(fire)pull();else act('fire');}};
  const unlock=()=>{if(locked())return;pointer.buttons=0;release();if(holdAim.current)holdAim.current=false;};
  const menu=e=>{if(locked())e.preventDefault();};
  document.body.append(host);window.addEventListener('keydown',key);window.addEventListener('keyup',keyUp);window.addEventListener('blur',release);for(const t of ['pointerdown','pointermove','pointerup'])gl.domElement.addEventListener(t,mouse);gl.domElement.addEventListener('contextmenu',menu);document.addEventListener('pointerlockchange',unlock);const debug=debugHud();if(!debug){title.style.display=equipment.style.display='none';buttons.forEach(b=>{b.style.display='none';});Object.assign(host.style,{top:'auto',left:'auto',right:'24px',bottom:'92px',padding:'8px 12px',font:'14px system-ui',maxWidth:'420px'});status.style.margin='0';}
  ui.current={host,status,buttons,equipment,trySwitch,debug};return()=>{host.remove();ui.current=null;window.removeEventListener('keydown',key);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',release);release();for(const t of ['pointerdown','pointermove','pointerup'])gl.domElement.removeEventListener(t,mouse);gl.domElement.removeEventListener('contextmenu',menu);document.removeEventListener('pointerlockchange',unlock);};
 },[kit,camera,direction,runtime,gl,profile]);
 useFrame((_,dt)=>{
  if(!binding.current)binding.current=bindRange(scene,runtime,range.current);
  if(!consoles.current)consoles.current=bindRangeConsoles(scene,undefined,runtime.scene.objects);
  const live=gate.current&&!document.hidden&&review.current.clip==='Live';if(wasActive.current&&!live)rangeAction(range.current,'leave');wasActive.current=live;
  stepRange(range.current,dt,{paused:!live,blocked:next=>binding.current?.blocked(next)??true});binding.current?.apply();binding.current?.tickEffects(dt,!live);const rangeView=rangeHud.current?.update(range.current,active,!!binding.current&&live);if(rangeView)consoles.current?.update(rangeView);
  const saveStamp=[range.current.events.length,Math.floor(range.current.tick/60),range.current.phase].join(':');if(saveStamp!==saved.current){try{localStorage.setItem(storageKey,JSON.stringify(range.current));saved.current=saveStamp;}catch{}}
  const inspecting=review.current.clip!=='Live';root.visible=active&&!!kit;if(gate.current&&!document.hidden&&kit&&!inspecting){const turn=fire?runFireFrame(state.current,fire,recoil.current,dt,roundEvent):(step(state.current,dt),stepRecoil(recoil.current,Math.min(dt,.1)));look?.current?.turn(-turn[1]*Math.PI/180,turn[0]*Math.PI/180);const h=holdAim.current;if(h===true&&!state.current.aim)command(state.current,'aim');else if(h===false){if(state.current.aim)command(state.current,'aim');if(!state.current.aim)holdAim.current=null;}}const s=state.current;
  const frozen={...s,mode:'idle',timer:0,cooldown:0,flash:0,aim:false};if(inspecting){const {clip,phase}=review.current,duration=motion.clips[clip].duration;if(clip==='Reload'||clip==='ReloadEmpty'||clip==='Inspect'){frozen.mode=clip==='Inspect'?'inspect':'reload';frozen.reloadKind=clip==='ReloadEmpty'?'empty':'standard';frozen.timer=duration*(1-phase);}if(clip==='Fire'){frozen.cooldown=Math.max(1e-9,duration*(1-phase));frozen.flash=Math.max(0,.09-duration*phase);}if(motion.clips.Fired)frozen.ammo=clip==='Fired'?0:Math.max(1,s.ammo);}
  const p=pose(inspecting?frozen:s,motion);
  if(ui.current&&!ui.current.debug){const rack=rackHover.current;ui.current.status.textContent=error||(!kit?'Loading '+profile.title+'…':!active?'Enter world, then V for first person.':rack?(rack===profile.id?browserProfiles[rack].title+' (in hand)':'X · Take '+browserProfiles[rack].title):`${profile.title} · ${s.aim?'AIM':'HIP'}${fire?.modes.length>1?' · '+s.trigger.mode.toUpperCase()+(s.trigger.mode==='burst'?' '+burstLeft(s.trigger,fire)+'/'+fire.burst.rounds:''):''} · ${s.ammo}/${weaponSpec.capacity} · Reserve ${s.reserve}${s.message?' · '+s.message:''}`);ui.current.host.style.borderColor=s.flash>0?(s.message==='Target hit'?'#a7f7ce':'#ffc171'):'#52615d';}
  else if(ui.current){ui.current.status.textContent=error||(!kit?'Loading pinned rig…':!active?'Enter world, then V for first person.':`${inspecting?"POSE REVIEW "+Math.round(review.current.phase*100)+"%":s.message} · ${s.mode} · ${s.aim?'AIM':'HIP'}${fire?.modes.length>1?' · '+s.trigger.mode.toUpperCase()+(s.trigger.mode==='burst'?' '+burstLeft(s.trigger,fire)+'/'+fire.burst.rounds:''):''} · Recoil ${look?.current?'row '+(recoil.current.index+1):'needs host look'} · Ammo ${s.ammo}/${weaponSpec.capacity} · Reserve ${s.reserve} · Shots ${s.shots} · Hits ${s.hits} · ${profile.id==='pistol'?'Grip '+s.grip+' · ':s.finish?'Finish '+s.finish+' · ':''}Skin 41 bones · Arm IK + twist · Clip ${p.clip} / ${p.phase}`);ui.current.buttons.forEach(b=>b.disabled=!gate.current||!kit||inspecting||(b.dataset.action==='grip'&&!weaponSpec.grips.length));ui.current.equipment.disabled=inspecting||s.mode!=='idle'||s.cooldown>0||['active','returning','deploying','blocked'].includes(range.current.phase);ui.current.host.style.borderColor=s.flash>0?(s.message==='Target hit'?'#a7f7ce':'#ffc171'):'#52615d';}
  if(ui.current)ui.current.host.hidden=!active;
  if(lens.current&&profile.view.aimFovDeg&&(!active||!kit)&&(camera.fov!==lens.current.fov||camera.near!==lens.current.near)){camera.fov=lens.current.fov;camera.near=lens.current.near;camera.updateProjectionMatrix();}
  if(!kit)return;
  aimBlend.current+=(p.aim-aimBlend.current)*(1-Math.exp(-18*Math.min(dt,.1)));const a=aimBlend.current;
  if(profile.view.aimFovDeg&&lens.current){const fov=lens.current.fov+(profile.view.aimFovDeg-lens.current.fov)*a,near=lens.current.near+((profile.view.aimNear??lens.current.near)-lens.current.near)*a;if(Math.abs(camera.fov-fov)>1e-4||Math.abs(camera.near-near)>1e-6){camera.fov=fov;camera.near=near;camera.updateProjectionMatrix();}}
  // A sloped sight line (open notch at the shoulder top) is levelled by turning the whole gun about the eye, the camera origin, while aiming.
  const level=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),(profile.view.aimPitch??0)*a);
  local.fromArray(profile.view.hipPosition).lerp(new THREE.Vector3(...profile.view.aimPosition),a).add(new THREE.Vector3(p.side,p.lift,profile.view.recoilBack*p.recoil-p.forward)).applyQuaternion(level).applyQuaternion(camera.quaternion);root.position.copy(camera.position).add(local);root.quaternion.copy(camera.quaternion).multiply(level).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(profile.view.recoilPitch*p.recoil+p.pitch,p.yaw+(inspecting?review.current.yaw:0),p.roll))).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),profile.view.assetForwardRotationY));
  if(kit.slide)kit.slide.position.x=p.slide;if(kit.mag)kit.mag.position.set(p.magX,p.magY,p.magZ);
  const zAxis=new THREE.Vector3(0,0,1);if(kit.lever)kit.lever.quaternion.copy(kit.leverRest).multiply(new THREE.Quaternion().setFromAxisAngle(zAxis,p.lever??0));if(kit.hammer)kit.hammer.quaternion.copy(kit.hammerRest).multiply(new THREE.Quaternion().setFromAxisAngle(zAxis,p.hammer??0));if(kit.boltSlide){kit.boltSlide.position.copy(kit.boltSlideRest).x+=p.boltSlide??0;kit.boltLift.quaternion.copy(kit.boltLiftRest).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),p.boltLift??0));}if(kit.token)kit.token.visible=(p.cartridge??0)>.5;
  if(kit.magazine){const out=p.magOut??0;kit.magazine.position.copy(kit.magazineRest).addScaledVector(kit.magazineAxis,out*motion.magazine.dropMetres);kit.magazine.visible=out<.999;}if(kit.magazineCue)kit.magazineCue.visible=(p.magCue??0)>.5;if(kit.handle)kit.handle.position.copy(kit.handleRest).addScaledVector(kit.handleAxis,(p.chargingHandle??0)*motion.chargingHandle.travelMetres);
  if(kit.rings.length||kit.frontOwner){root.updateMatrixWorld(true);camera.updateMatrixWorld();const w=a<.5?0:THREE.MathUtils.smoothstep(a,.5,1);
   if(kit.rings.length){const c=kit.rearAnchor.getWorldPosition(new THREE.Vector3()).applyMatrix4(camera.matrixWorldInverse),d=Math.max(c.length(),1e-4),g=profile.view.ghostRing;c.normalize();for(const r of kit.rings){r.aim.value=w;r.axis.value.copy(c);r.core.value=Math.max(0,(g.apertureDiameter-g.pupil)/(2*d));r.outer.value=(g.apertureDiameter+g.pupil)/(2*d);}}
   // Readability floor (owner decision 4): widen only the front blade, only when its apparent width falls below the floor.
   if(kit.frontOwner&&kit.frontWidth>0){const d=kit.frontAnchor.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position),px=kit.frontWidth/d/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2))*profile.view.frontSight.referenceHeightPx,scale=px<profile.view.frontSight.minPixels?profile.view.frontSight.minPixels/px:1;kit.frontOwner.scale.z=1+(scale-1)*w;}}
  if(kit.current!==p.clip){kit.mixer.stopAllAction();kit.actions[p.clip].reset().play();kit.current=p.clip;}
  kit.actions[p.clip].time=p.clipTime;kit.mixer.update(0);applyArmIK(kit.hands,kit.chains,p);
  for(const m of kit.grips)m.color.set(s.grip==='walnut'?0xffffff:0x667986);
 });
 return <><primitive object={root}/><WeaponRack active={active} hover={rackHover}/></>;
}

// The extension draws first-person hands, so the host hides the maker's body in first person.
export const firstPersonBody='hidden';
// A wall rack behind the booths holds every playable gun; looking at one and pressing X takes it.
const RACK={position:[15.6,0,-4.05],yaw:0,width:2.2,rows:[1.72,1.42,1.12,.82],reach:3};
function WeaponRack({active,hover}){
 const {camera,scene}=useThree(),group=useMemo(()=>new THREE.Group(),[]),guns=useRef([]),ray=useMemo(()=>new THREE.Raycaster(),[]),center=useMemo(()=>new THREE.Vector2(0,0),[]);
 useEffect(()=>{
  let live=true;group.name='WeaponRack';group.position.fromArray(RACK.position);group.rotation.y=RACK.yaw;scene.add(group);
  const wood=new THREE.MeshStandardMaterial({color:'#5b4632',roughness:.8}),steel=new THREE.MeshStandardMaterial({color:'#2d3134',roughness:.5,metalness:.6});
  const board=new THREE.Mesh(new THREE.BoxGeometry(RACK.width,1.35,.04),wood);board.position.set(0,1.27,-.03);group.add(board);
  for(const x of [-RACK.width/2+.05,RACK.width/2-.05]){const post=new THREE.Mesh(new THREE.BoxGeometry(.06,1.95,.06),steel);post.position.set(x,.975,-.03);group.add(post);}
  const loader=new GLTFLoader();
  Object.values(browserProfiles).forEach((p,i)=>loader.load(p.gunUrl,g=>{if(!live)return;const gun=g.scene,box=new THREE.Box3().setFromObject(gun),size=box.getSize(new THREE.Vector3());
   // Lay the gun's longest axis along the rack and sit it just in front of the board.
   if(size.z>size.x)gun.rotation.y=Math.PI/2;box.setFromObject(gun);const mid=box.getCenter(new THREE.Vector3());
   const holder=new THREE.Group();holder.add(gun);gun.position.sub(mid);holder.position.set(0,RACK.rows[i%RACK.rows.length],.06);holder.userData.weapon=p.id;group.add(holder);
   const peg=new THREE.Mesh(new THREE.BoxGeometry(.03,.03,.1),steel);peg.position.set(0,RACK.rows[i%RACK.rows.length]-.05,.03);group.add(peg);guns.current.push(holder);}));
  return()=>{live=false;scene.remove(group);group.traverse(n=>{if(n.isMesh){n.geometry.dispose();}});wood.dispose();steel.dispose();guns.current=[];};
 },[group,scene]);
 useFrame(()=>{hover.current=null;if(!active||!guns.current.length)return;ray.setFromCamera(center,camera);ray.far=RACK.reach;const hit=ray.intersectObjects(guns.current,true)[0];if(!hit)return;let n=hit.object;while(n&&!n.userData.weapon)n=n.parent;hover.current=n?.userData.weapon??null;});
 return null;
}
export default function WeaponExtension(props){
 const [weapon,setWeapon]=useState(()=>new URLSearchParams(window.location.search).get('weapon')??'pistol');
 if(!['range-target','booth-console','collection-bay'].every(id=>props.runtime.scene.objects.some(o=>o.id===id)))return null;
 // Switching keeps the session: the URL records the gun, and the workbench remounts with the new profile.
 const choose=id=>{const url=new URL(window.location.href);url.searchParams.set('weapon',id);window.history.replaceState(null,'',url.href);setWeapon(id);};
 return <WeaponWorkbench key={weapon} weaponId={weapon} choose={choose} {...props}/>;
}




