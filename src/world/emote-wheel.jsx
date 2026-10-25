import React,{useEffect,useRef,useState} from 'react';
import {EMOTES} from './emotes.mjs';
import {subscribeEmotes,pointWheel,sliceCentre,playSlot,closeWheel,openWheel,holdWheel} from './emote-wheel.mjs';
import './emote-wheel.css';

const view=state=>({open:state.open,source:state.source,highlight:state.highlight});
// Slice buttons must not keep focus, or the world would read keys as typing.
const release=e=>e.currentTarget.blur();

// The radial emote wheel at the reticle. Keys and a locked mouse drive it through
// the controller; a visible pointer aims by its offset from the centre and a click
// plays a slice, so it also works while the mouse is not captured and for taps.
export function EmoteWheel({input}){
 const [state,setState]=useState(()=>view(input));
 useEffect(()=>subscribeEmotes(input,next=>setState(view(next))),[input]);
 if(!state.open)return null;
 const point=e=>{if(e.pointerType==='touch'||input.source==='drag')return;const r=e.currentTarget.getBoundingClientRect();pointWheel(input,e.clientX-r.left-r.width/2,e.clientY-r.top-r.height/2);};
 const active=state.highlight!=null?EMOTES[state.highlight]:null;
 return <div className="emote-wheel" role="menu" aria-label="Emotes" onPointerMove={point}>
  {EMOTES.map((emote,i)=>{const [x,y]=sliceCentre(i);return <button key={emote.id} type="button" role="menuitem" className={`emote-slice ${state.highlight===i?'is-active':''}`} style={{transform:`translate(-50%,-50%) translate(${x}px,${y}px)`}} onClick={e=>{release(e);playSlot(input,i);}}><kbd>{i+1}</kbd><span>{emote.label}</span></button>;})}
  <button type="button" className="emote-centre" onClick={e=>{release(e);closeWheel(input,{play:false});}}>{active?active.label:state.source==='keys'?'Release T to cancel':'Cancel'}</button>
 </div>;
}

// Touch: press the Emote button and drag toward a slice, then lift to play it.
// Lifting without dragging leaves the wheel open to tap a slice; pressing again closes it.
export function EmoteButton({input}){
 const start=useRef(null);
 const down=e=>{
  e.preventDefault();
  if(input.open&&input.source==='tap'){closeWheel(input,{play:false});return;}
  try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* The finger already lifted. */}
  start.current=[e.clientX,e.clientY];openWheel(input,'drag');
 };
 const move=e=>{if(start.current)pointWheel(input,(e.clientX-start.current[0])*1.6,(e.clientY-start.current[1])*1.6);};
 const up=()=>{if(!start.current)return;start.current=null;if(input.highlight!=null)closeWheel(input);else holdWheel(input);};
 const cancel=()=>{if(!start.current)return;start.current=null;closeWheel(input,{play:false});};
 return <button type="button" className="touch-button round" aria-label="Emotes" aria-haspopup="menu" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onContextMenu={e=>e.preventDefault()}>Emote</button>;
}
