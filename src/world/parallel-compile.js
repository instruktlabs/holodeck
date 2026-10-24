// WebGL2 only. three r186 links each new render program inside the frame that first
// draws it and then blocks on LINK_STATUS, so programs compile one after another on
// the main thread. With a cold driver shader cache that freezes the first frame for
// many seconds (measured 8 s of link waits for Tidemark on the hub). When
// KHR_parallel_shader_compile is available, use three's own compileAsync path for every
// new pipeline instead: start the link and poll COMPLETION_STATUS_KHR once per frame.
// The driver compiles in parallel, the page keeps animating, and each object draws
// once its program is ready. renderer.pendingCompiles() reports programs still linking.
export function enableParallelCompile(renderer){
 const backend=renderer.backend;
 if(backend.isWebGPUBackend||!backend.parallel)return;
 const create=backend.createRenderPipeline.bind(backend);let pending=0;
 backend.createRenderPipeline=(renderObject,promises)=>{
  if(promises)return create(renderObject,promises);
  const started=[];create(renderObject,started);
  for(const p of started){pending++;p.finally(()=>pending--);}
 };
 renderer.pendingCompiles=()=>pending;
}
// With parallel compilation, objects whose program is still linking are skipped, so a
// frame can be drawn before the scene is complete. Ready means SETTLE frames in a row
// with nothing compiling. Other backends use the same completed-frame settling.
export const SETTLE=3;
export function compileGate(renderer,settled=0){
 const compiling=renderer.pendingCompiles?.()??0,next=compiling?0:Math.min(SETTLE,settled+1);
 return {ready:next>=SETTLE,settled:next,compiling};
}
