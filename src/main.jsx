import React, { Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { WebGPURenderer, TextureLoader, SRGBColorSpace } from 'three/webgpu';
import { GlyphProvider, Text, useMsdf } from '@pmndrs/glyph/react';
import { Container } from '@react-three/uikit';
import './style.css';

const query = new URLSearchParams(location.search);
const forcedGL = query.get('backend') === 'webgl';
const testUikit = query.has('uikit');
const evidence = window.holodeckLab = { errors: [], frames: [], font: {}, selected: false, speech: {}, mounted: true };
window.addEventListener('error', e => evidence.errors.push(String(e.message)));
window.addEventListener('unhandledrejection', e => evidence.errors.push(String(e.reason)));

function Probe() {
  const { gl, camera } = useThree();
  useEffect(() => { camera.lookAt(0, 0.8, 0); }, [camera]);
  useFrame((_, delta) => {
    evidence.frames.push(delta * 1000);
    if (evidence.frames.length > 12000) evidence.frames.shift();
    evidence.backend = gl.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    evidence.memory = { ...gl.info.memory };
    evidence.render = { totalRenderCalls: gl.info.render.calls, drawCalls: gl.info.render.drawCalls, triangles: gl.info.render.triangles };
    gl.info.reset();
    evidence.userAgent = navigator.userAgent;
  });
  return null;
}

function Labels({ caption, fail }) {
  const font = useMsdf(fail ? '/fonts/missing.font.glb' : '/fonts/inter.font.glb');
  const label = useRef();
  useEffect(() => { evidence.fontMounts = (evidence.fontMounts || 0) + 1; return () => { evidence.font.loaded = false; }; }, []);
  useFrame(() => {
    if (label.current) evidence.font = { loaded: true, caption, bounds: label.current.measure() };
  });
  return <group position={[-1.25, 1.9, 0]}>
    <Text font={font} style={{ fontSize: 0.16, color: '#34392f' }}>A place to begin</Text>
    <Text ref={label} font={font} position={[0, -0.3, 0]} style={{ fontSize: 0.10, color: '#686c5e' }}
      constraints={{ width: { mode: 'exact', size: 1.7 }, height: { mode: 'exact', size: 0.26 } }}
      layout={{ wrap: 'word', maxLines: 2, overflow: 'clip' }}>{caption}</Text>
  </group>;
}

function FontFailure({ error }) {
  useEffect(() => { evidence.fontFailure = String(error); }, [error]);
  return <mesh position={[0, 1.6, 0]}><boxGeometry args={[0.2, 0.2, 0.2]}/><meshBasicMaterial color="#b57936"/></mesh>;
}

function Picture() {
  const texture = useLoader(TextureLoader, '/fixtures/reference.svg');
  texture.colorSpace = SRGBColorSpace;
  return <mesh position={[-2.6, 1.4, 0]} rotation={[0, 0.25, 0]}>
    <planeGeometry args={[1.35, 0.85]}/><meshBasicMaterial map={texture}/>
  </mesh>;
}

function Study({ caption, selected, setSelected, fail, mounted }) {
  return <>
    <color attach="background" args={['#e8e5d8']}/>
    <fog attach="fog" args={['#e8e5d8', 14, 35]}/>
    <ambientLight intensity={1.8}/><directionalLight position={[4, 8, 2]} intensity={3}/>
    <Probe/>
    <mesh rotation={[-Math.PI/2, 0, 0]} position={[0,-0.08,0]}><circleGeometry args={[6,64]}/><meshStandardMaterial color="#d8cfb9" roughness={1}/></mesh>
    <mesh position={[-2.4, 0.7, -1.6]} rotation={[0,0.2,0]}><boxGeometry args={[4,1.5,0.35]}/><meshStandardMaterial color="#c3b398" roughness={1}/></mesh>
    <mesh position={[-3.6,2,-0.1]}><cylinderGeometry args={[0.13,0.17,4,8]}/><meshStandardMaterial color="#78674f"/></mesh>
    <mesh position={[-1.7,3.8,-0.8]} rotation={[0,0.2,0]}><boxGeometry args={[5,0.18,3.4]}/><meshStandardMaterial color="#8c7b5f"/></mesh>
    <mesh position={[0,0.12,0]} onClick={e => {e.stopPropagation(); setSelected(!selected);}}>
      <cylinderGeometry args={[0.7,0.78,0.25,12]}/><meshStandardMaterial color={selected ? '#b28a51' : '#9e9a85'} roughness={0.9}/>
    </mesh>
    <mesh position={[0,0.253,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[0.24,0.255,64]}/><meshBasicMaterial color="#d0a65e"/></mesh>
    {Array.from({length:12},(_,i) => <group key={i} position={[Math.sin(i*2.4)*8,0,-6-Math.abs(Math.cos(i))*6]}>
      <mesh position={[0,1.6,0]}><cylinderGeometry args={[0.1,0.16,3.2,7]}/><meshStandardMaterial color="#756b53"/></mesh>
      <mesh position={[0,3,0]}><coneGeometry args={[0.9,3.6,7]}/><meshStandardMaterial color={i%2?'#7b896d':'#95a082'}/></mesh>
    </group>)}
    {mounted && <Suspense fallback={null}>
      <GlyphProvider key={String(fail)} errorFallback={error => <FontFailure error={error}/>}>
        <Labels caption={caption} fail={fail}/>
      </GlyphProvider>
      <Picture/>
      {testUikit && <group position={[2.1,1.2,0]}>
        <Container width={130} height={70} pixelSize={0.01} backgroundColor="#eee8dc" borderRadius={8} padding={10} overflow="hidden">
          <Container width={180} height={28} backgroundColor="#b4bda4"/>
        </Container>
      </group>}
    </Suspense>}
  </>;
}

function App() {
  const [mode, setMode] = useState('arrive');
  const [selected, setSelected] = useState(false);
  const [caption, setCaption] = useState('Warm light. Room to think.');
  const [fail, setFail] = useState(false);
  const [mounted, setMounted] = useState(true);
  const [transcript, setTranscript] = useState('');
  const [status, setStatus] = useState('Local speech is idle');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const worker = useRef(); const recorder = useRef(); const stream = useRef();
  useEffect(() => {
    evidence.selected = selected; evidence.mounted = mounted;
  }, [selected, mounted]);
  useEffect(() => () => { worker.current?.terminate(); stream.current?.getTracks().forEach(t=>t.stop()); }, []);
  async function transcribe(blob) {
    setBusy(true);
    try {
      const context = new AudioContext({sampleRate:16000});
      const decoded = await context.decodeAudioData(await blob.arrayBuffer());
      const audio = decoded.getChannelData(0).slice();
      await context.close();
      worker.current ??= new Worker(new URL('./speech.worker.js', import.meta.url), {type:'module'});
      worker.current.onmessage = ({data}) => {
        if(data.type==='result') {setTranscript(data.text.trim()); setStatus('Transcript ready · edit below'); setBusy(false); evidence.speech=data;}
        if(data.type==='error') {setStatus(data.message); setBusy(false); evidence.speech=data;}
        if(data.type==='progress') setStatus(data.status==='progress' ? `Loading local model · ${Math.round(data.progress||0)}%` : `Local model · ${data.status}`);
      };
      worker.current.onerror = error => {setStatus(error.message); setBusy(false);};
      setStatus('Loading model for local CPU inference…');
      worker.current.postMessage({audio}, [audio.buffer]);
    } catch(error) {setStatus(String(error)); setBusy(false);}
  }
  async function toggleMic() {
    if(recording) {recorder.current.stop(); return;}
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks=[]; recorder.current = new MediaRecorder(stream.current);
      recorder.current.ondataavailable=e=>chunks.push(e.data);
      recorder.current.onstop=()=>{stream.current.getTracks().forEach(t=>t.stop()); setRecording(false); transcribe(new Blob(chunks,{type:recorder.current.mimeType}));};
      recorder.current.start(); setRecording(true); setStatus('Listening · press Stop when finished');
    } catch(error) {setStatus('Microphone unavailable. You can still type.'); evidence.micError=error.name;}
  }
  return <main>
    <header><a className="brand" href="/">◯ <span>holodeck</span></a><span className="eyebrow">A PLACE TO BEGIN</span><a href="/design.html">Visual study ↗</a></header>
    <section className="viewport" aria-label="3D compatibility study">
      <Canvas camera={{position:[5.6,4.1,7.2],fov:43}} dpr={1} gl={async props=>{
        const renderer=new WebGPURenderer({...props,forceWebGL:forcedGL,antialias:true});
        renderer.info.autoReset=false;
        await renderer.init(); return renderer;
      }}><Study {...{caption,selected,setSelected,fail,mounted}}/></Canvas>
      <div className="intro"><span className="eyebrow">TECHNICAL FIXTURE / NOT THE COVE DESIGN</span><h1>Rendering<br/>compatibility.</h1><p>Glyph, image loading, selection, and local speech.</p></div>
      <div className="badge">{forcedGL?'WebGL2':'WebGPU preferred'} · compatibility lab</div>
      {mode==='references' && <aside><span className="eyebrow">DIRECTION</span><h2>What belongs here?</h2><img src="/fixtures/reference.svg" alt="Simplified cedar clearing reference fixture"/><p>Warm light. An open path. Quiet edges.</p><button onClick={()=>setCaption('Pinned direction: keep the path open.')}>Pin direction · local demo</button></aside>}
      {(selected||mode==='shape') && <aside><span className="eyebrow">SELECTED</span><h2>Origin stone</h2><p>Grounded, worn, always within reach.</p><label>World caption<input aria-label="World caption" value={caption} onChange={e=>setCaption(e.target.value)}/></label><button onClick={()=>{setSelected(false);setMode('arrive');}}>Done</button></aside>}
      {mode==='listen' && <aside><span className="eyebrow">VOICE STUDY</span><h2>{recording?'Listening…':'Speak, then shape.'}</h2><p role="status">{status}</p><button disabled={busy} onClick={toggleMic}>{recording?'Stop recording':'Start recording'}</button><button disabled={busy||recording} onClick={async()=>transcribe(await (await fetch('/fixtures/voice.wav')).blob())}>Transcribe test phrase</button><label>Editable transcript<textarea aria-label="Editable transcript" value={transcript} onChange={e=>setTranscript(e.target.value)}/></label><small>Runs locally in a worker. First use downloads Whisper tiny.en. No agent connected.</small></aside>}
      <nav aria-label="Study states">{['arrive','references','shape','listen'].map((s,i)=><button key={s} aria-pressed={mode===s} onClick={()=>{setSelected(false);setMode(s);}}>0{i+1} <span>{s}</span></button>)}</nav>
    </section>
    <footer><p>Primitive materials. Precise tools. Space to think.</p><details open={query.has('test')}><summary>Compatibility controls</summary><div className="controls"><a href="/?backend=webgpu&test">WebGPU</a><a href="/?backend=webgl&test">Force WebGL2</a><button onClick={()=>setFail(!fail)}>{fail?'Restore font':'Fail font'}</button><button onClick={()=>setMounted(!mounted)}>{mounted?'Unmount resources':'Mount resources'}</button><button onClick={()=>setCaption('A changed caption with enough words to exercise wrapping and clipping in the bounded text panel.')}>Replace text</button></div><p className="small">The scene is a rendering fixture. Conversation and world authoring are not implemented.</p></details></footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App/>);
