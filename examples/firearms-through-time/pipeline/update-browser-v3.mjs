import {readFile,writeFile} from 'node:fs/promises';
const p='weapon-extension.jsx';let s=await readFile(p,'utf8');
s=s.replace("import pins from './game/asset-pins.json';","import pins from './game/asset-pins.json';\nimport motion from './game/animation-v3.json';");
s=s.replace('let live=true;const loader','let live=true, mixer;const loader');
s=s.replace("setKit({gun:gun.scene,hands:hands.scene,slide:gun.scene.getObjectByName('Joint_Slide'),mag:gun.scene.getObjectByName('Joint_Magazine'),wrist,wristRest:wrist.position.clone(),finger,grips});",`const actions={};mixer=new THREE.AnimationMixer(hands.scene);
  for(const [name,spec]of Object.entries(motion.clips)){const clip=hands.animations.find(c=>c.name===name);if(!clip||Math.abs(clip.duration-spec.duration)>.025)throw Error('Missing or incompatible clip: '+name);const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;actions[name]=action;}
  setKit({gun:gun.scene,hands:hands.scene,slide:gun.scene.getObjectByName('Joint_Slide'),mag:gun.scene.getObjectByName('Joint_Magazine'),grips,mixer,actions,current:null});`);
s=s.replace('live=false;disposeTrees(root);','live=false;if(mixer){mixer.stopAllAction();mixer.uncacheRoot(mixer.getRoot());}disposeTrees(root);');
s=s.replace('Skin 33 bones','Skin 33 bones · Clip ${p.clip} / ${p.phase}');
s=s.replace('local.set(.10*(1-a)+.025*p.inspect,-.17+.093*a+.07*p.inspect+p.lift,-.42+.035*p.recoil+.05*p.inspect)','local.set(.10*(1-a)+p.side,-.17+.093*a+p.lift,-.42+.035*p.recoil-p.forward)');
s=s.replace('new THREE.Euler(.07*p.recoil,.9*p.inspect+p.yaw,.32*p.inspect+p.roll)','new THREE.Euler(.07*p.recoil+p.pitch,p.yaw,p.roll)');
s=s.replace('kit.slide.position.x=p.slide;kit.mag.position.set(p.magX,p.magY,p.magZ);kit.wrist.position.copy(kit.wristRest).add(new THREE.Vector3(p.handX,p.handY,p.handZ));kit.wrist.rotation.z=p.handRoll;kit.finger.rotation.z=p.finger;',`kit.slide.position.x=p.slide;kit.mag.position.set(p.magX,p.magY,p.magZ);
  if(kit.current!==p.clip){kit.mixer.stopAllAction();kit.actions[p.clip].reset().play();kit.current=p.clip;}
  kit.actions[p.clip].time=p.clipTime;kit.mixer.update(0);`);
await writeFile(p,s);
