import {installStarter} from '../server/starter.mjs';
const base='http://127.0.0.1:4186',r=await fetch(base+'/api/session');const current=await r.json();if(!r.ok)throw new Error(current.error);const cookie=r.headers.get('set-cookie').split(';')[0],context={...current.context};if(!context.worldId||!context.epoch)throw new Error('Host did not provide a world session context');
const headers={cookie,'Content-Type':'application/json','X-Holodeck-World':context.worldId,'X-Holodeck-Epoch':context.epoch};
if(current.world.scene.origin!=='structure'){
const starter=await installStarter(current.workspace),world=current.world;
const change={baseRevision:world.revision,scene:{...world.scene,origin:starter.scene.origin,assets:[...world.scene.assets.filter(a=>!starter.scene.assets.some(s=>s.id===a.id)),...starter.scene.assets],objects:[...world.scene.objects.filter(o=>o.layer!=='origin'),...starter.scene.objects],moodboard:starter.scene.moodboard},references:[...(world.references||[]),...starter.references.filter(r=>!world.references?.some(x=>x.id===r.id))]};
const applied=await fetch(base+'/api/world',{method:'POST',headers,body:JSON.stringify(change)});const result=await applied.json();if(!applied.ok)throw new Error(result.error);console.log(JSON.stringify({revision:result.world.revision,modules:starter.scene.assets.length,objects:result.world.scene.objects.length}));
}else console.log('Modular cove already installed; preserved current arrangement.');
