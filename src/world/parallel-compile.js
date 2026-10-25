// three r186 creates each new render pipeline inside the frame that first draws it.
// On WebGL2 it then blocks on LINK_STATUS, so programs compile one after another on
// the main thread. With a cold driver shader cache that freezes the first frame for
// many seconds (measured 8 s of link waits for Tidemark on the hub). On WebGPU,
// createRenderPipeline returns at once but the GPU process compiles each pipeline
// before the work that uses it, one at a time: the marble sanctuary's planting made
// a cold WebGPU load draw about one frame every 6 s for over half a minute (H68).
// Where the backend can compile in the background (WebGPU's
// createRenderPipelineAsync, or WebGL2 with KHR_parallel_shader_compile), use three's
// own compileAsync path for every new pipeline instead. The driver compiles in
// parallel, the page keeps animating, and each object draws once its pipeline is
// ready. renderer.pendingCompiles() reports pipelines still compiling.
export function enableParallelCompile(renderer){
 const backend=renderer.backend;
 if(!backend.isWebGPUBackend&&!backend.parallel)return;
 const create=backend.createRenderPipeline.bind(backend);let pending=0;
 backend.createRenderPipeline=(renderObject,promises)=>{
  if(promises)return create(renderObject,promises);
  const started=[];create(renderObject,started);
  for(const p of started){pending++;p.finally(()=>pending--);}
 };
 renderer.pendingCompiles=()=>pending;
}
// With parallel compilation, objects whose pipeline is still compiling are skipped, so
// a frame can be drawn before the scene is complete. Ready means SETTLE frames in a row
// with nothing compiling; without parallel compilation every drawn frame is ready.
export const SETTLE=3;
export function compileGate(renderer,settled=0){
 if(!renderer.pendingCompiles)return {ready:true,settled,compiling:0};
 const compiling=renderer.pendingCompiles(),next=compiling?0:settled+1;
 return {ready:next>=SETTLE,settled:next,compiling};
}
