import {EnvironmentNode,MeshStandardNodeMaterial} from 'three/webgpu';
import {vec3} from 'three/tsl';

// An environment that lights by reflection alone. three's environment light adds both a
// reflected and a diffuse term; this one sends its diffuse write to a throwaway variable.
// It serves the sky light's capture once a probe grid fills shade (H127), which would
// otherwise be lit twice, and a planar mirror on still water (H129), which reflects the
// world but lights nothing.
export class ReflectionEnvironmentNode extends EnvironmentNode{
  static get type(){return 'ReflectionEnvironmentNode';}
  setup(builder){
    const irradiance=builder.context.iblIrradiance;builder.context.iblIrradiance=vec3(0).toVar();
    try{super.setup(builder);}finally{builder.context.iblIrradiance=irradiance;}
  }
}
// The environment stays an ordinary node where three expects one: the scene's
// environmentNode or a material's envNode, which materials sample as a colour. A lighting
// node in the scene's place reached every standard material wrapped in another
// EnvironmentNode and built as a colour (474 "Invalid generated code, expected a vec3" at
// load, the stone left without its environment, measured). three r186 has no option to leave
// an environment's diffuse term out (three.js #34741, open), so standard and physical
// materials whose environment, their own or else the scene's, is marked here take
// ReflectionEnvironmentNode in place of the EnvironmentNode they would build.
const marked=new WeakSet();let installed=false;
export function reflectionsOnlyEnvironment(node){
  if(!installed){
    installed=true;const setupEnvironment=MeshStandardNodeMaterial.prototype.setupEnvironment;
    MeshStandardNodeMaterial.prototype.setupEnvironment=function(builder){
      const environment=setupEnvironment.call(this,builder),source=this.envNode??(this.envMap?null:builder.environmentNode);
      return environment?.constructor===EnvironmentNode&&marked.has(source)?new ReflectionEnvironmentNode(environment.envNode):environment;
    };
  }
  marked.add(node);return node;
}
export const isReflectionsOnly=node=>!!node&&marked.has(node);
