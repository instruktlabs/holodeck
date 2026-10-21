const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const exact=(value,keys,label)=>assert(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)),`Invalid ${label} fields`);
export function validateGait(gait){
 exact(gait,['stride','channels'],'gait');
 assert(Number.isFinite(gait.stride)&&gait.stride>=.05&&gait.stride<=10,'Gait stride must be .05 to 10 local metres');
 assert(Array.isArray(gait.channels)&&gait.channels.length>=1&&gait.channels.length<=32,'Gait requires 1 to 32 channels');
 const targets=new Set();
 for(const channel of gait.channels){
  exact(channel,['node','axis','amplitude','phase'],'gait channel');
  assert(typeof channel.node==='string'&&/^[-A-Za-z0-9_]{1,64}$/.test(channel.node),'Invalid gait node name');
  assert(['x','y','z'].includes(channel.axis),'Invalid gait axis');
  assert(Number.isFinite(channel.amplitude)&&Math.abs(channel.amplitude)<=1.2,'Gait amplitude must be within +/-1.2 radians');
  assert(Number.isFinite(channel.phase)&&Math.abs(channel.phase)<=Math.PI*2,'Gait phase must be within +/-2PI');
  const key=`${channel.node}:${channel.axis}`;assert(!targets.has(key),'Duplicate gait node/axis channel');targets.add(key);
 }
 return gait;
}
// Phase follows actual travel, including collision-limited motion. Scaling the
// model along its +X forward axis scales the authored stride by the same amount.
export function gaitAngles(gait,distance,scaleX=1,weight=1){
 const phase=(distance/(gait.stride*scaleX)%1)*Math.PI*2;
 return gait.channels.map(c=>c.amplitude*Math.sin(phase+c.phase)*weight);
}
export const createGaitState=()=>({weight:0,distance:0,lastTime:null});
export function stepGaitState(state,motion,time,nominalSpeed,active=true){
 if(state.lastTime===null||time<state.lastTime){state.weight=0;state.distance=motion.distance;state.lastTime=time;return state;}
 const dt=Math.max(0,Math.min(.1,time-state.lastTime));state.lastTime=time;
 if(!active||dt===0)return state;
 const target=Math.max(0,Math.min(1,motion.speed/nominalSpeed));
 state.weight+=(target-state.weight)*(1-Math.exp(-dt*12));
 if(state.weight<1e-6)state.weight=0;
 state.distance=motion.distance;return state;
}
