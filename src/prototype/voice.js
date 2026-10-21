import { useEffect, useRef, useState } from 'react';
export function useVoice(onTranscript) {
  const [status,setStatus]=useState(''),[recording,setRecording]=useState(false),[busy,setBusy]=useState(false);
  const worker=useRef(),recorder=useRef(),stream=useRef(),timer=useRef(),callback=useRef(onTranscript);
  callback.current=onTranscript;
  useEffect(()=>()=>{clearTimeout(timer.current);worker.current?.terminate();stream.current?.getTracks().forEach(t=>t.stop());},[]);
  async function transcribe(blob) {
    setBusy(true);setStatus('Preparing local speech…');
    let context;
    try{
      context=new AudioContext({sampleRate:16000});
      const decoded=await context.decodeAudioData(await blob.arrayBuffer()),audio=decoded.getChannelData(0).slice();
      worker.current??=new Worker(new URL('../speech.worker.js',import.meta.url),{type:'module'});
      worker.current.onmessage=({data})=>{
        if(data.type==='result'){callback.current(data.text.trim());setBusy(false);setStatus('Transcript ready. Edit it, then send.');}
        if(data.type==='error'){setBusy(false);setStatus('Speech unavailable. You can still type.');}
        if(data.type==='progress')setStatus(data.status==='progress'?`Loading speech model · ${Math.round(data.progress||0)}%`:'Loading local speech model…');
      };
      worker.current.onerror=()=>{setBusy(false);setStatus('Speech unavailable. You can still type.');worker.current.terminate();worker.current=null;};
      worker.current.postMessage({audio},[audio.buffer]);
    }catch{setBusy(false);setStatus('Could not transcribe. You can still type.');}
    finally{await context?.close();}
  }
  async function toggle(){
    if(recording){clearTimeout(timer.current);recorder.current.stop();return;}
    if(busy)return;
    try{
      setBusy(true);setStatus('Waiting for microphone…');
      stream.current=await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks=[];recorder.current=new MediaRecorder(stream.current);
      recorder.current.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      recorder.current.onstop=()=>{clearTimeout(timer.current);stream.current.getTracks().forEach(t=>t.stop());setRecording(false);transcribe(new Blob(chunks,{type:recorder.current.mimeType}));};
      recorder.current.start();setRecording(true);setBusy(false);setStatus('Listening · tap again to finish · 20s maximum');
      timer.current=setTimeout(()=>{if(recorder.current?.state==='recording')recorder.current.stop();},20000);
    }catch{stream.current?.getTracks().forEach(t=>t.stop());setBusy(false);setStatus('Microphone unavailable. You can still type.');}
  }
  return {status,recording,busy,toggle};
}
