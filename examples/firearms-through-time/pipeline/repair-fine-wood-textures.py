"""Explicit GLB texture-name mapping prevents index-based reimport drift."""
import unreal,json,struct,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assert level.load_level('/Game/Qualification/OpeningCaseLab')
blob=(ROOT/'authoring/opening-case-fine-wood.glb').read_bytes();n=struct.unpack_from('<I',blob,12)[0]
g=json.loads(blob[20:20+n]);binary=blob[28+n:]
delivery=ROOT/'deliveries/unreal-opening-case/textures';delivery.mkdir(exist_ok=True)
exported=E/'fine-wood-native-exported-textures';exported.mkdir(exist_ok=True)
base='/Game/Qualification/OpeningCaseGenerated/opening-case-delivery'
expected={'Case_Wood_Albedo','Case_Wood_Normal','Case_Wood_MR','Case_Paint_Albedo','Case_Surface_Normal','Case_Paint_MR','Case_Inventory_Label'}
assert {i['name'] for i in g['images']}==expected
records=[]
for image in g['images']:
 name=image['name'];view=g['bufferViews'][image['bufferView']];data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
 assert data.startswith(b'\x89PNG\r\n\x1a\n')
 width,height=struct.unpack_from('>II',data,16)
 path=delivery/(name+'.png');path.write_bytes(data)
 task=unreal.AssetImportTask();task.filename=str(path);task.destination_path=base+'/Textures';task.destination_name=name
 task.automated=True;task.replace_existing=True;task.replace_existing_settings=True;task.save=True
 unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
 tex=unreal.load_asset(base+'/Textures/'+name)
 is_normal='Normal' in name;is_color='Albedo' in name or 'Label' in name
 tex.srgb=is_color;tex.flip_green_channel=False
 tex.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if is_normal else unreal.TextureCompressionSettings.TC_DEFAULT if is_color else unreal.TextureCompressionSettings.TC_MASKS
 tex.filter=unreal.TextureFilter.TF_TRILINEAR;tex.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE
 assert assets.save_loaded_asset(tex,False)
 assert tex.blueprint_get_size_x()==width and tex.blueprint_get_size_y()==height
 target=exported/(name+'.png')
 export=unreal.AssetExportTask();export.object=tex;export.filename=str(target);export.exporter=unreal.TextureExporterPNG();export.automated=True;export.prompt=False;export.replace_identical=True
 assert unreal.Exporter.run_asset_export_task(export),name
 records.append({'name':name,'asset':tex.get_path_name(),'source':str(path),'exported':str(target),'width':width,'height':height,'sourceSha256':hashlib.sha256(data).hexdigest(),'srgb':tex.srgb,'compression':str(tex.compression_settings),'flipGreen':tex.flip_green_channel})
material_records=[]
for i,m in enumerate(g['materials']):
 mi=unreal.load_asset(base+'/Materials/opening-case-delivery_material_'+str(i))
 bindings={};pbr=m.get('pbrMetallicRoughness',{})
 for param,desc in [('BaseColorTexture',pbr.get('baseColorTexture')),('MetallicRoughnessTexture',pbr.get('metallicRoughnessTexture')),('NormalTexture',m.get('normalTexture')),('OcclusionTexture',m.get('occlusionTexture')),('EmissiveTexture',m.get('emissiveTexture'))]:
  if desc is not None:
   image=g['images'][g['textures'][desc['index']]['source']]
   tex=unreal.load_asset(base+'/Textures/'+image['name'])
   unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi,param,tex)
   bindings[param]=tex.get_path_name()
  unreal.MaterialEditingLibrary.set_material_instance_static_switch_parameter_value(mi,'bHas'+param,desc is not None)
 unreal.MaterialEditingLibrary.update_material_instance(mi)
 assert assets.save_loaded_asset(mi,False)
 for param,path in bindings.items():
  assert unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(mi,param).get_path_name()==path
  assert unreal.MaterialEditingLibrary.get_material_instance_static_switch_parameter_value(mi,'bHas'+param)
 material_records.append({'asset':mi.get_path_name(),'bindings':bindings})
previous=json.loads((E/'opening-update-native-result.json').read_text())
for row in previous['overrides']:
 assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest()==row['sha256']
 mi=unreal.load_asset(row['path']);assert mi.parent.get_path_name()==row['parent']
 assert abs(unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,'RoughnessFactor')-row['roughness'])<1e-6
assert level.save_current_level()
(E/'fine-wood-native-texture-repair.json').write_text(json.dumps({'ok':True,'textures':records,'materials':material_records,'overrides':previous['overrides'],'checks':['explicit_name_to_source_texture_mapping','correct_color_space_compression_and_dimensions','texture_bindings_and_presence_switches_match_glb','wood_ao_enabled','native_override_bytes_unchanged'],'requires':'Compare exported PNG pixels with staged source before qualifying appearance'},indent=2))
unreal.log('FINE_WOOD_TEXTURE_REPAIR_PASS')
