import rules from './range-rules-v1.json' with {type:'json'};
export {rules};
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]);
const copy=v=>structuredClone(v),finite=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function intersectSurface(ray,f){
 if(!finite(ray.origin)||!finite(ray.direction)||!finite(f.origin))return null;
 const den=dot(ray.direction,f.normal);if(den>=-1e-7)return null;
 const distance=dot(sub(f.origin,ray.origin),f.normal)/den;if(distance<=.005||distance>rules.maxDistance)return null;
 const world=add(ray.origin,ray.direction.map(v=>v*distance)),d=sub(world,f.origin),local=[dot(d,f.right),dot(d,f.up)];
 if(f.lane==='plates'?Math.hypot(...local)>f.width/2+rules.surfaceTolerance:Math.abs(local[0])>f.width/2+rules.surfaceTolerance||Math.abs(local[1])>f.height/2+rules.surfaceTolerance)return null;
 return {surfaceId:f.id,lane:f.lane,plate:f.plate??null,distance,world,local,uv:[local[0]/f.width+.5,local[1]/f.height+.5],frame:copy(f)};
}
// Oriented box proxies are explicit game collision, independent of visual batching.
export function intersectBox(ray,b){
 const delta=sub(ray.origin,b.center);let lo=0,hi=rules.maxDistance;
 for(let i=0;i<3;i++){const o=dot(delta,b.axes[i]),d=dot(ray.direction,b.axes[i]),h=b.half[i];if(Math.abs(d)<1e-9){if(Math.abs(o)>h)return null;continue;}let a=(-h-o)/d,z=(h-o)/d;if(a>z)[a,z]=[z,a];lo=Math.max(lo,a);hi=Math.min(hi,z);if(lo>hi)return null;}
 return hi>.005?{id:b.id,distance:Math.max(.005,lo)}:null;
}
export function resolveRay(ray,surfaces,boxes=[]){
 const hits=surfaces.map(f=>intersectSurface(ray,f)).filter(Boolean).sort((a,b)=>a.distance-b.distance||a.surfaceId.localeCompare(b.surfaceId));
 const blocks=boxes.map(b=>intersectBox(ray,b)).filter(Boolean).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id));
 const hit=hits[0],block=blocks[0];
 if(block&&(!hit||block.distance<hit.distance-rules.occlusionTolerance))return {outcome:'blocked',blockerId:block.id,distance:block.distance,impact:null};
 return hit?{outcome:'surface',blockerId:null,impact:hit}:{outcome:'miss',blockerId:null,impact:null};
}
export function zoneScore(lane,local){if(lane==='plates')return {zone:'plate',points:rules.plates.points};const p=rules[lane],r=Math.hypot(local[0]-p.center[0],local[1]-p.center[1]);const i=p.radii.findIndex(v=>r<=v+rules.surfaceTolerance);return {zone:i<0?'outside-rings':'ring-'+(i+1),points:i<0?0:p.points[i]};}
export function createRange(id='local-session'){return {schemaVersion:1,rulesId:rules.id,id,lane:'paper',phase:'ready',stringId:0,sheetId:1,activation:1,tick:0,accumulator:0,travel:0,moveTo:0,plates:[false,false,false,false,false],angles:[0,0,0,0,0],shots:[],events:[],archives:[],seen:{},message:'Fire to start a string · L changes lane',pendingStart:false};}
function event(s,type,data={}){s.events.push({id:s.id+':event:'+s.events.length,type,tick:s.tick,stringId:s.stringId,lane:s.lane,...copy(data)});}
export function currentShots(s){return s.shots.filter(x=>x.stringId===s.stringId);}
export function stats(shots){const hits=shots.filter(x=>x.outcome==='hit'),points=hits.reduce((n,x)=>n+x.points,0),groupHits=hits.filter(x=>x.impact?.lane!=='plates'),count=groupHits.length;let centroid=null,spread=null,rms=null;
 if(count){centroid=[0,1].map(i=>groupHits.reduce((n,x)=>n+x.impact.local[i],0)/count);if(count>=2){spread=0;let sum=0;for(let i=0;i<count;i++){const a=groupHits[i].impact.local;sum+=(a[0]-centroid[0])**2+(a[1]-centroid[1])**2;for(let j=0;j<i;j++)spread=Math.max(spread,Math.hypot(...sub(a,groupHits[j].impact.local)));}rms=Math.sqrt(sum/count);}}
 return {shots:shots.length,hits:hits.length,scoringHits:hits.filter(x=>x.points>0).length,misses:shots.filter(x=>x.outcome==='miss').length,blocked:shots.filter(x=>x.outcome==='blocked').length,nonScoring:shots.filter(x=>['wrong-lane','inactive-plate'].includes(x.outcome)).length,points,group:{count,centroid,spread,rms}};
}
function finish(s,reason){if(s.phase!=='active')return;const shots=copy(currentShots(s));s.archives.push({stringId:s.stringId,lane:s.lane,sheetId:s.sheetId,activation:s.activation,reason,shots,stats:stats(shots)});event(s,'StringEnded',{reason});s.phase='review';s.message='String complete — review the numbered impacts';}
function begin(s){s.stringId++;s.phase='active';s.pendingStart=false;event(s,'StringStarted',{sheetId:s.sheetId,activation:s.activation});s.message='String active — 7 accepted shots maximum';}
export function rangeAction(s,action,arg){
 if(action==='select'){if(!['paper','plates','original'].includes(arg)||['active','returning','deploying','blocked'].includes(s.phase))return false;s.lane=arg;s.phase='ready';s.message='Lane: '+arg;return true;}
 if(action==='start'){if(!['ready','review'].includes(s.phase)||s.shots.length>=rules.maxShots)return false;if(s.lane==='plates'){s.activation++;s.plates.fill(false);s.angles.fill(0);}if(s.lane==='paper'&&s.travel>0){s.moveTo=0;s.phase='deploying';s.pendingStart=true;s.message='Deploying — firing unavailable';event(s,'TargetDeployRequested');}else begin(s);return true;}
 if(action==='end'){if(s.phase!=='active')return false;finish(s,arg??'manual');return true;}
 if(action==='return'){if(s.lane!=='paper')return false;if(s.phase==='blocked'){s.phase=s.moveTo?'returning':'deploying';s.message='Retrying target travel';return true;}if(s.phase==='returning')return true;if(s.phase==='deploying')return false;finish(s,'return');s.pendingStart=false;s.moveTo=1;s.phase=s.travel>=1?'review':'returning';s.message=s.travel>=1?'Paper docked — review or replace':'Returning — firing unavailable';event(s,'TargetReturnRequested');return true;}
 if(action==='replace'){if(s.lane!=='paper'||s.phase!=='review'||s.travel<1)return false;s.sheetId++;event(s,'TargetReplaced',{sheetId:s.sheetId});s.message='New sheet — archived strings retained';return true;}
 if(action==='leave'){finish(s,'left-booth');s.message='Inactive — fire to start a new string';return true;}
 return false;
}
// Owner decision (27 Oct): with no string running, the trigger starts one in the current lane. A docked paper deploys first and the string begins on arrival.
export function startOnTrigger(s){return ['ready','review'].includes(s.phase)&&rangeAction(s,'start');}
export function canRecord(s,commandId){return s.phase==='active'&&!Object.hasOwn(s.seen,commandId)&&s.shots.length<rules.maxShots;}
export function recordShot(s,commandId,ray,surfaces,boxes=[]){
 if(!canRecord(s,commandId))return null;
 const resolved=resolveRay(ray,surfaces,boxes),hit=resolved.impact;let outcome=resolved.outcome,zone=null,points=0;
 if(hit){if(hit.lane!==s.lane)outcome='wrong-lane';else if(hit.lane==='plates'&&s.plates[hit.plate])outcome='inactive-plate';else{outcome='hit';({zone,points}=zoneScore(hit.lane,hit.local));if(hit.lane==='plates')s.plates[hit.plate]=true;}}
 const shot={id:s.id+':shot:'+(s.shots.length+1),commandId,sequence:s.shots.length+1,stringId:s.stringId,sheetId:s.sheetId,activation:s.activation,tick:s.tick,rulesId:rules.id,ray:copy(ray),outcome,zone,points,blockerId:resolved.blockerId,impact:hit?copy(hit):null};
 s.seen[commandId]=true;s.shots.push(shot);event(s,'ShotAccepted',{shotId:shot.id});event(s,'ShotResolved',{shotId:shot.id,outcome,points});s.message=outcome==='hit'?`${points} points · ${zone}`:outcome.replaceAll('-',' ');
 if(currentShots(s).length>=rules.shotBudget||(s.lane==='plates'&&s.plates.every(Boolean)))finish(s,s.lane==='plates'&&s.plates.every(Boolean)?'rack-cleared':'shot-budget');return shot;
}
export function stepRange(s,dt,{paused=false,blocked=()=>false}={}){
 if(paused||!Number.isFinite(dt)||dt<=0)return;s.accumulator+=Math.min(dt,.1);
 while(s.accumulator+1e-12>=1/60){s.accumulator-=1/60;s.tick++;for(let i=0;i<5;i++)s.angles[i]=Math.min(s.plates[i]?rules.plateAngle:0,s.angles[i]+rules.plateSpeed/60);
  if(!['returning','deploying'].includes(s.phase))continue;
  const delta=rules.travelSpeed/rules.travelDistance/60,next=s.moveTo?Math.min(1,s.travel+delta):Math.max(0,s.travel-delta);
  if(blocked(next)){s.phase='blocked';s.message='Travel blocked — clear the path, then Resume';event(s,'TargetTravelBlocked');continue;}
  s.travel=next;if(Math.abs(s.travel-s.moveTo)<1e-8){s.travel=s.moveTo;event(s,s.moveTo?'TargetDocked':'TargetDeployed');if(!s.moveTo&&s.pendingStart)begin(s);else{s.phase='review';s.message='Paper docked — marks and history retained';}}
 }
}
export function restoreRange(value){const s=copy(value);if(s?.schemaVersion!==1||s.rulesId!==rules.id||!Array.isArray(s.shots)||s.shots.length>rules.maxShots||!Array.isArray(s.events)||!Array.isArray(s.archives)||!Array.isArray(s.angles)||s.angles.length!==5||!Number.isFinite(s.travel)||s.travel<0||s.travel>1)throw Error('Unsupported saved range session');s.accumulator=0;if(s.phase==='active')finish(s,'restored-session');if(['returning','deploying'].includes(s.phase)){s.phase='blocked';s.message='Restored during travel — Resume when clear';}return s;}
