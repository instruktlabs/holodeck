"""Reconcile generated material parameters with the pinned GLB, never native overlays."""
import unreal,json,struct,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);lib=unreal.MaterialEditingLibrary;out=[]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
pins=json.loads((R/'game/asset-pins.json').read_text())['assets']
for kind in ['hands','pistol']:
 b=(R/'authoring'/('first-'+kind+'.glb')).read_bytes();assert hashlib.sha256(b).hexdigest()==pins[kind]['sha256'];j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
 dest=globals().get('DESTINATIONS',{}).get(kind,'/Game/Qualification/WeaponGenerated/first-'+kind+'/first-'+kind)
 for mat in j['materials']:
  obj=unreal.load_asset(dest+'/Materials/'+mat['name']);assert isinstance(obj,unreal.MaterialInstanceConstant);pbr=mat.get('pbrMetallicRoughness',{})
  color=pbr.get('baseColorFactor',[1,1,1,1]);scalars={'MetallicFactor':pbr.get('metallicFactor',1),'RoughnessFactor':pbr.get('roughnessFactor',1),'NormalScale':mat.get('normalTexture',{}).get('scale',1)}
  scalar_values={str(v.parameter_info.name):v for v in obj.scalar_parameter_values}
  for name,value in scalars.items():scalar_values[name]=unreal.ScalarParameterValue(parameter_info=unreal.MaterialParameterInfo(name=name),parameter_value=float(value))
  obj.set_editor_property('scalar_parameter_values',list(scalar_values.values()))
  vectors={str(v.parameter_info.name):v for v in obj.vector_parameter_values};vectors['BaseColorFactor']=unreal.VectorParameterValue(parameter_info=unreal.MaterialParameterInfo(name='BaseColorFactor'),parameter_value=unreal.LinearColor(*color));obj.set_editor_property('vector_parameter_values',list(vectors.values()))
  expected={};values=[]
  for key,info in [('BaseColorTexture',pbr.get('baseColorTexture')),('MetallicRoughnessTexture',pbr.get('metallicRoughnessTexture')),('NormalTexture',mat.get('normalTexture'))]:
   if info is None:continue
   assert info.get('texCoord',0)==0 and not info.get('extensions'),'Unsupported UV transform requires adapter work'
   name=j['images'][j['textures'][info['index']]['source']]['name'];tex=unreal.load_asset(dest+'/Textures/'+name);assert isinstance(tex,unreal.Texture2D)
   values.append(unreal.TextureParameterValue(parameter_info=unreal.MaterialParameterInfo(name=key),parameter_value=tex));expected[key]=tex.get_path_name()
  obj.set_editor_property('texture_parameter_values',values)
  switches={}
  for key in ['BaseColorTexture','MetallicRoughnessTexture','NormalTexture']:
   name='bHas'+key;value=key in expected
   # UE 5.8's setter changes the instance but always returns false. Verify readback.
   lib.set_material_instance_static_switch_parameter_value(obj,name,value)
   assert lib.get_material_instance_static_switch_parameter_value(obj,name)==value
   switches[name]=value
  lib.update_material_instance(obj);assert assets.save_loaded_asset(obj,False)
  for name,value in scalars.items():assert abs(lib.get_material_instance_scalar_parameter_value(obj,name)-value)<1e-5
  for name,path in expected.items():assert lib.get_material_instance_texture_parameter_value(obj,name).get_path_name()==path
  actual=lib.get_material_instance_vector_parameter_value(obj,'BaseColorFactor');assert max(abs(a-b) for a,b in zip([actual.r,actual.g,actual.b,actual.a],color))<1e-5
  out.append({'path':obj.get_path_name(),'sourceSha256':pins[kind]['sha256'],'textures':expected,'switches':switches,'scalars':scalars,'baseColorFactor':color})
assert sum(len(row['textures']) for row in out)==9
(R/'evidence'/globals().get('EVIDENCE_NAME','weapon-v2-native-material-bindings.json')).write_text(json.dumps({'ok':True,'materials':out},indent=2));unreal.log('WEAPON_V2_MATERIAL_BINDINGS_PASS')
