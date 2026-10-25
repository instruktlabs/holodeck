import {Matrix4,Plane,Vector2,Vector3,Vector4,WebGPUCoordinateSystem} from 'three/webgpu';
import {reflector} from 'three/tsl';

// A planar water mirror that renders only the part of its view the water covers (H98).
// three's reflector renders the whole mirrored view every frame: at the arrival that
// was 82 objects, nearly as many as the view itself, for a pool in the lower third of
// the screen. The update below is three's (r186 ReflectorNode, MIT) with one change:
// the mirrored projection is narrowed to the water's screen rectangle and the render
// target's viewport to the same pixels. Every pixel the water samples is drawn exactly
// as before; objects whose reflections fall outside the water are culled, and the rest
// of the target is not shaded.

// The water's rectangle on screen, in the camera's normalized device coordinates
// [x0, x1, y0, y1] (y up), clipped to the near plane and grown by margin; null when
// the water is wholly behind the camera.
export function waterWindow(camera,[xmin,xmax,zmin,zmax],level,margin=.04){
 const corners=[[xmin,zmin],[xmax,zmin],[xmax,zmax],[xmin,zmax]].map(([x,z])=>new Vector3(x,level,z).applyMatrix4(camera.matrixWorldInverse));
 const near=-camera.near,kept=[];
 for(let i=0;i<4;i++){
  const a=corners[i],b=corners[(i+1)%4],inA=a.z<=near,inB=b.z<=near;
  if(inA)kept.push(a);
  if(inA!==inB)kept.push(a.clone().lerp(b,(near-a.z)/(b.z-a.z)));
 }
 if(!kept.length)return null;
 let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
 for(const v of kept){v.applyMatrix4(camera.projectionMatrix);x0=Math.min(x0,v.x);x1=Math.max(x1,v.x);y0=Math.min(y0,v.y);y1=Math.max(y1,v.y);}
 const clamp=v=>Math.min(1,Math.max(-1,v));
 return [clamp(x0-margin),clamp(x1+margin),clamp(y0-margin),clamp(y1+margin)];
}

// The mirror camera's image is flipped in x (the water samples it at 1 - u), so the
// window maps to [-x1, -x0]. Snapped outward to whole pixels of a width x height
// target, it gives the viewport (x and y from the top-left, as three takes them) and
// the clip-space matrix that maps the window to the full device range.
export function mirrorWindow([x0,x1,y0,y1],width,height,matrix=new Matrix4()){
 const left=Math.max(0,Math.floor((1-x1)/2*width)),right=Math.min(width,Math.ceil((1-x0)/2*width));
 const top=Math.max(0,Math.floor((1-y1)/2*height)),bottom=Math.min(height,Math.ceil((1-y0)/2*height));
 const w=Math.max(1,right-left),h=Math.max(1,bottom-top);
 const nx0=2*left/width-1,nx1=2*(left+w)/width-1,ny1=1-2*top/height,ny0=1-2*(top+h)/height;
 const sx=2/(nx1-nx0),sy=2/(ny1-ny0);
 matrix.set(sx,0,0,-(nx0+nx1)/2*sx, 0,sy,0,-(ny0+ny1)/2*sy, 0,0,1,0, 0,0,0,1);
 return {viewport:[left,top,w,h],matrix,full:left===0&&top===0&&w===width&&h===height};
}

const plane=new Plane(),normal=new Vector3(),mirrorPosition=new Vector3(),cameraPosition=new Vector3(),rotation=new Matrix4();
const look=new Vector3(),clip=new Vector4(),view=new Vector3(),target=new Vector3(),q=new Vector4(),narrow=new Matrix4();
let rendering=false;

function update(frame,bounds,level,margin){
 if(this.bounces===false&&rendering)return false;
 rendering=true;
 const {scene,camera,renderer,material}=frame,virtualCamera=this.getVirtualCamera(camera),renderTarget=this.getRenderTarget(virtualCamera);
 this._updateResolution(renderTarget,renderer);
 mirrorPosition.setFromMatrixPosition(this.target.matrixWorld);cameraPosition.setFromMatrixPosition(camera.matrixWorld);
 rotation.extractRotation(this.target.matrixWorld);normal.set(0,0,1).applyMatrix4(rotation);
 view.subVectors(mirrorPosition,cameraPosition);
 let needsClear=false;
 if(view.dot(normal)>0&&this.forceUpdate===false){
  if(this.hasOutput===false){rendering=false;return;}
  needsClear=true;
 }
 view.reflect(normal).negate().add(mirrorPosition);
 rotation.extractRotation(camera.matrixWorld);
 look.set(0,0,-1).applyMatrix4(rotation).add(cameraPosition);
 target.subVectors(mirrorPosition,look).reflect(normal).negate().add(mirrorPosition);
 virtualCamera.coordinateSystem=camera.coordinateSystem;virtualCamera.position.copy(view);
 virtualCamera.up.set(0,1,0).applyMatrix4(rotation).reflect(normal);virtualCamera.lookAt(target);
 virtualCamera.near=camera.near;virtualCamera.far=camera.far;virtualCamera.updateMatrixWorld();
 virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
 // Oblique near plane on the water (Lengyel), as in three.
 plane.setFromNormalAndCoplanarPoint(normal,mirrorPosition).applyMatrix4(virtualCamera.matrixWorldInverse);
 clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
 const p=virtualCamera.projectionMatrix.elements;
 q.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);
 clip.multiplyScalar(1/clip.dot(q));
 p[2]=clip.x;p[6]=clip.y;p[10]=renderer.coordinateSystem===WebGPUCoordinateSystem?clip.z:clip.z+1;p[14]=clip.w;
 // H98: only the water's rectangle. The window matrix rescales x and y alone, so the
 // oblique near plane in the third row is kept.
 const window=waterWindow(camera,bounds,level,margin);
 const span=window?mirrorWindow(window,renderTarget.width,renderTarget.height,narrow):null;
 if(span&&!span.full){virtualCamera.projectionMatrix.premultiply(span.matrix);renderTarget.viewport.set(...span.viewport);}
 else renderTarget.viewport.set(0,0,renderTarget.width,renderTarget.height);
 this.textureNode.value=renderTarget.texture;
 if(this.depth===true)this.textureNode.getDepthNode().value=renderTarget.depthTexture;
 material.visible=false;
 const currentRenderTarget=renderer.getRenderTarget(),currentMRT=renderer.getMRT(),currentAutoClear=renderer.autoClear;
 renderer.setMRT(null);renderer.setRenderTarget(renderTarget);renderer.autoClear=true;
 const previousName=scene.name;scene.name=(scene.name||'Scene')+' [ Reflector ]';
 if(needsClear){renderer.clear();this.hasOutput=false;}
 else{renderer.render(scene,virtualCamera);this.hasOutput=true;}
 scene.name=previousName;
 renderer.setMRT(currentMRT);renderer.setRenderTarget(currentRenderTarget);renderer.autoClear=currentAutoClear;
 material.visible=true;rendering=false;this.forceUpdate=false;
}

// water.bounds [xmin, xmax, zmin, zmax] at water.level, as the ocean geometry spans them.
export function windowedMirror({bounds,level,resolutionScale=.5,margin=.04}){
 const node=reflector({resolutionScale,bounces:false}),base=node.reflector;
 base.target.rotation.x=-Math.PI/2;base.target.position.y=level;base.target.updateMatrixWorld(true);
 base.updateBefore=function(frame){return update.call(this,frame,bounds,level,margin);};
 return node;
}
