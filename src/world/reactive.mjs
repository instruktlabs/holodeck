import {MaterialReferenceNode} from 'three/webgpu';
import {nodeObject} from 'three/tsl';

// Per-material marks the world effects read from the scene pass (H90), for the
// material being drawn. reactive: the look moves while the geometry stays put, as
// with scrolling water, so there are no motion vectors and temporal AA takes the
// current frame rather than history. translucent: any transparent material, whose
// pixels occlusion leaves alone, since occlusion is computed from what lies behind.
// A per-material MRT output would not do: three draws such a material with that
// output alone wherever no pass MRT is set, as in sky light captures and the
// water's mirror view.
const KEY='holodeckReactive';
export const markReactive=material=>{material[KEY]=1;};
export const isReactive=material=>material[KEY]===1;
class MarkNode extends MaterialReferenceNode{
 constructor(property,test){super(property,'float');this.test=test;}
 getValueFromReference(object=this.reference){return object&&this.test(object)?1:0;}
}
export const reactiveNode=()=>nodeObject(new MarkNode(KEY,isReactive));
export const translucentNode=()=>nodeObject(new MarkNode('transparent',material=>material.transparent===true));
