import {compileGate} from './parallel-compile.js';

// Renderer-owned evidence, separate from the legacy loaded-world/frame marker.
// Only a completed render advances settling; reading status never advances it.
const states=new WeakMap();
const initial=()=>({renderReady:false,pendingCompiles:0,settledFrames:0});
function publish(renderer,state,probe){states.set(renderer,state);if(probe)Object.assign(probe,state);return {...state};}
export function readRenderReadiness(renderer){return {...(states.get(renderer)??initial())};}
export function resetRenderReadiness(renderer,probe){return publish(renderer,initial(),probe);}
export function completeRenderFrame(renderer,probe){
 const previous=readRenderReadiness(renderer),gate=compileGate(renderer,previous.settledFrames);
 // A world's sky light captures its dome over the first frames (landscape.jsx); the
 // view has not settled until the last capture lands.
 const sky=probe?.skyLight?.pending===true;
 return publish(renderer,{renderReady:gate.ready&&!sky,pendingCompiles:gate.compiling,settledFrames:sky?0:gate.settled},probe);
}
