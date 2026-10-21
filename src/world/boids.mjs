const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
export function validateFlock(b){
 assert(Number.isInteger(b.count)&&b.count>=1&&b.count<=48,'Flock count must be 1 to 48');
 assert(Array.isArray(b.bounds)&&b.bounds.length===6&&b.bounds.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000)&&[0,2,4].every(i=>b.bounds[i+1]-b.bounds[i]>=.5),'Flock bounds require three world-space ranges at least .5 metres wide');
 for(const [key,min,max] of [['speed',.1,12],['neighborRadius',.1,30],['separationRadius',.05,10],['terrainClearance',.1,30]])assert(Number.isFinite(b[key])&&b[key]>=min&&b[key]<=max,`Invalid flock ${key}`);
 assert(b.separationRadius<=b.neighborRadius,'Flock separation must not exceed neighbor radius');
 assert(Number.isInteger(b.seed)&&b.seed>=0&&b.seed<=0xffffffff,'Flock seed must be uint32');
}
function randomSource(seed){let value=seed||0x9e3779b9;return()=>{value^=value<<13;value^=value>>>17;value^=value<<5;return (value>>>0)/4294967296;};}
const floorAt=(b,terrain,x,z)=>Math.max(b.bounds[2],(terrain?.sample(x,z).height??-1000)+b.terrainClearance);
function speedVector(v,speed){const length=Math.hypot(...v);return length>1e-9?v.map(n=>n/length*speed):[speed,0,0];}
export function createFlock(o,terrain){
 const b=o.behavior;validateFlock(b);const random=randomSource(b.seed),agents=[];
 for(let i=0;i<b.count;i++){
  let position;
  for(let attempt=0;attempt<32;attempt++){
   const x=b.bounds[0]+random()*(b.bounds[1]-b.bounds[0]),z=b.bounds[4]+random()*(b.bounds[5]-b.bounds[4]),floor=floorAt(b,terrain,x,z);
   if(floor>b.bounds[3]-.05)continue;
   position=[x,floor+random()*(b.bounds[3]-floor),z];break;
  }
  if(!position)return {running:true,mode:'disabled',agents:[],diagnostics:['The authored flight volume cannot fit the flock above terrain clearance.']};
  const angle=random()*Math.PI*2,velocity=speedVector([Math.cos(angle),(random()-.5)*.35,Math.sin(angle)],b.speed);
  agents.push({position,previousPosition:[...position],velocity,previousVelocity:[...velocity],distance:0,previousDistance:0,phaseOffset:random(),bank:0,previousBank:0});
 }
 return {running:true,mode:'flying',agents,diagnostics:[]};
}
export function stepFlock(state,b,dt,{terrain}){
 if(!state.running||!state.agents.length){if(state.agents.length)state.mode='paused';return;}
 state.mode='flying';const agents=state.agents,next=[],radius2=b.neighborRadius**2;
 for(let i=0;i<agents.length;i++){
  const a=agents[i],p=a.position,v=a.velocity,alignment=[0,0,0],cohesion=[0,0,0],separation=[0,0,0];let neighbors=0;
  for(let j=0;j<agents.length;j++)if(j!==i){
   const other=agents[j],delta=p.map((n,k)=>n-other.position[k]),distance2=delta.reduce((s,n)=>s+n*n,0);
   if(distance2>radius2)continue;neighbors++;
   for(let k=0;k<3;k++){alignment[k]+=other.velocity[k];cohesion[k]+=other.position[k];}
   const distance=Math.sqrt(distance2);
   if(distance<b.separationRadius){const strength=(1-distance/b.separationRadius)*b.speed*4;for(let k=0;k<3;k++)separation[k]+=(distance>1e-6?delta[k]/distance:k===0?(i<j?-1:1):0)*strength;}
  }
  const acceleration=separation.map((n,k)=>n+(neighbors?(alignment[k]/neighbors-v[k])*.7+(cohesion[k]/neighbors-p[k])*.25:0));
  for(let k=0;k<3;k++){
   const lo=b.bounds[k*2],hi=b.bounds[k*2+1],margin=Math.min((hi-lo)*.4,Math.max(.5,b.speed));
   if(p[k]<lo+margin)acceleration[k]+=(lo+margin-p[k])/margin*b.speed*3;
   if(p[k]>hi-margin)acceleration[k]-=(p[k]-hi+margin)/margin*b.speed*3;
  }
  const floor=floorAt(b,terrain,p[0]+v[0]*.4,p[2]+v[2]*.4);
  if(p[1]<floor+.6)acceleration[1]+=(floor+.6-p[1])*b.speed*4;
  const length=Math.hypot(...acceleration),factor=length>b.speed*3?b.speed*3/length:1;
  let velocity=speedVector(v.map((n,k)=>n+acceleration[k]*factor*dt),b.speed),position=p.map((n,k)=>n+velocity[k]*dt);
  for(let k=0;k<3;k++){const lo=b.bounds[k*2],hi=b.bounds[k*2+1];if(position[k]<lo){position[k]=lo;velocity[k]=Math.abs(velocity[k]);}if(position[k]>hi){position[k]=hi;velocity[k]=-Math.abs(velocity[k]);}}
  const ground=floorAt(b,terrain,position[0],position[2]);
  if(ground>b.bounds[3]){position=[...p];velocity=[-velocity[0],Math.max(0,velocity[1]),-velocity[2]];}
  else if(position[1]<ground){position[1]=ground;velocity[1]=Math.abs(velocity[1]);}
  const travel=Math.hypot(...position.map((n,k)=>n-p[k])),turn=Math.atan2(v[0]*velocity[2]-v[2]*velocity[0],v[0]*velocity[0]+v[2]*velocity[2]);
  next.push({position,velocity,distance:a.distance+travel,bank:a.bank+(clamp(-turn/Math.max(dt,1e-6)*.15,-.45,.45)-a.bank)*(1-Math.exp(-dt*6))});
 }
 for(let i=0;i<agents.length;i++){const a=agents[i];a.previousPosition=a.position;a.previousVelocity=a.velocity;a.previousDistance=a.distance;a.previousBank=a.bank;Object.assign(a,next[i]);}
}
export function renderFlockAgent(agent,alpha){
 const t=clamp(alpha,0,1);
 return {position:agent.position.map((n,i)=>agent.previousPosition[i]+(n-agent.previousPosition[i])*t),velocity:agent.velocity.map((n,i)=>agent.previousVelocity[i]+(n-agent.previousVelocity[i])*t),distance:agent.previousDistance+(agent.distance-agent.previousDistance)*t,phaseOffset:agent.phaseOffset,bank:agent.previousBank+(agent.bank-agent.previousBank)*t};
}
