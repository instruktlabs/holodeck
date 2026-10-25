import React,{useEffect,useState} from 'react';
import {subscribeTouch,stickKnob} from './touch-input.mjs';
import {EmoteButton} from './emote-wheel.jsx';
import './touch.css';

// Touch mode follows the last pointer used, so a laptop with a touchscreen
// switches back to the keyboard and mouse hints when the mouse moves.
export function useTouchMode(){
 const [touch,setTouch]=useState(()=>typeof matchMedia==='function'&&matchMedia('(hover:none) and (pointer:coarse)').matches);
 useEffect(()=>{
  const seen=e=>{if(e.pointerType==='touch')setTouch(true);else if(e.pointerType==='mouse')setTouch(false);};
  window.addEventListener('pointerdown',seen,true);return()=>window.removeEventListener('pointerdown',seen,true);
 },[]);
 return touch;
}

// The stick redraws itself from the shared touch state without re-rendering the host.
function Stick({touch,hint}){
 const [knob,setKnob]=useState(()=>stickKnob(touch));
 useEffect(()=>subscribeTouch(touch,state=>setKnob(stickKnob(state))),[touch]);
 if(!knob)return hint?<div className="touch-stick is-hint" aria-hidden="true"><span/></div>:null;
 return <div className="touch-stick" aria-hidden="true" style={{left:knob.origin[0],top:knob.origin[1]}}><span style={{transform:`translate(${knob.offset[0]}px,${knob.offset[1]}px)`}}/></div>;
}

// Held while the finger stays on it, like a key.
function Hold({label,set,children}){
 const [held,setHeld]=useState(false),press=value=>e=>{e.preventDefault();if(value)try{e.currentTarget.setPointerCapture(e.pointerId);}catch{/* The finger already lifted. */}setHeld(value);set(value);};
 return <button type="button" className={`touch-button round ${held?'is-held':''}`} aria-label={label} onPointerDown={press(true)} onPointerUp={press(false)} onPointerCancel={press(false)} onLostPointerCapture={()=>{setHeld(false);set(false);}} onContextMenu={e=>e.preventDefault()}>{children}</button>;
}

// Buttons appear only when their action applies: Interact when the reticle finds
// something, Jump and Emote while walking as the inhabitant, Up and Down in the free camera.
export function TouchControls({touch,active,mode,possessed,interaction,onInteract,emotes=null,bottom=150,children}){
 if(!active)return null;
 const moving=mode==='walk'||mode==='free';
 return <div className="touch-layer" style={{'--touch-bottom':`${bottom}px`}}>
  <Stick touch={touch} hint={moving}/>
  <div className="touch-actions">
   {children}
   {mode==='walk'&&interaction?.action&&<button type="button" className="touch-button" onClick={onInteract}>{interaction.available?interaction.label:'Move closer'}</button>}
   {mode==='free'&&<div className="touch-pair"><Hold label="Down" set={v=>{touch.pad.up=v?-1:0;}}>Down</Hold><Hold label="Up" set={v=>{touch.pad.up=v?1:0;}}>Up</Hold></div>}
   {mode==='walk'&&possessed&&<div className="touch-pair">{emotes&&<EmoteButton input={emotes}/>}<Hold label="Jump" set={v=>{touch.pad.jump=v;}}>Jump</Hold></div>}
  </div>
 </div>;
}
