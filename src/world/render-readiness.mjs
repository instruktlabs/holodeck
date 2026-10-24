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
 return publish(renderer,{renderReady:gate.ready,pendingCompiles:gate.compiling,settledFrames:gate.settled},probe);
}
