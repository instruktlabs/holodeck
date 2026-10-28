"""Local prototype of a semantic material-update adapter. Candidate path is explicit."""
import json,hashlib,struct,re,shutil
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
cfg=json.loads((E/'case-material-candidate.json').read_text(encoding='utf-8-sig'));label=cfg['label'];assert re.fullmatch('[a-z0-9-]+',label)
def local(p):
 path=(ROOT/p).resolve();assert path.is_relative_to(ROOT);return path
source=local(cfg['glb']);saved=json.loads(local(cfg['saved']).read_text(encoding='utf-8-sig'));blob=source.read_bytes();assert 'sha256:'+hashlib.sha256(blob).hexdigest()==saved['asset']['files']['asset.glb']['sha256']
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/OpeningCaseLab')
def snapshot():
 case=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='OpeningCaseActor')
 return {'actor':case.get_path_name(),'components':[{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())],'location':list(c.relative_location.to_tuple()),'rotation':[c.relative_rotation.pitch,c.relative_rotation.yaw,c.relative_rotation.roll],'parent':c.get_attach_parent().get_path_name(),'parentLocation':list(c.get_attach_parent().relative_location.to_tuple()),'boundsMin':list(c.static_mesh.get_bounding_box().min.to_tuple()),'boundsMax':list(c.static_mesh.get_bounding_box().max.to_tuple())} for c in case.get_components_by_class(unreal.StaticMeshComponent)]}
before=snapshot();overrides=json.loads((E/'opening-update-native-result.json').read_text())['overrides']
for r in overrides:assert hashlib.sha256(Path(r['file']).read_bytes()).hexdigest()==r['sha256']
backup=E/(label+'-native-backup');assert not backup.exists(),'Candidate already attempted; retain prior receipts and use a new label'
backup.mkdir()
for rel in ['OpeningCaseLab.umap','OpeningCaseGenerated','NativeOverrides']:
 p=ROOT/'native/ToolchainValidation/Content/Qualification'/rel
 if p.is_dir():shutil.copytree(p,backup/rel)
 else:shutil.copy2(p,backup/rel)
(E/(label+'-native-before.json')).write_text(json.dumps(before,indent=2))
staged=ROOT/'deliveries/unreal-opening-case/opening-case-delivery.glb';shutil.copy2(source,staged)
pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES;pipeline.material_pipeline.reuse_existing_materials=False
stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
task=unreal.AssetImportTask();task.filename=str(staged);task.destination_path='/Game/Qualification/OpeningCaseGenerated';task.options=stack;task.automated=True;task.replace_existing=True;task.replace_existing_settings=True;task.save=True;task.async_=False
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
n=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+n]);binary=blob[28+n:];base='/Game/Qualification/OpeningCaseGenerated/opening-case-delivery'
expected={'Case_Wood_Albedo','Case_Wood_Normal','Case_Wood_MR','Case_Paint_Albedo','Case_Surface_Normal','Case_Paint_MR','Case_Inventory_Label'};assert {i['name'] for i in g['images']}==expected
exported=E/(label+'-native-textures');exported.mkdir();textures=[]
for image in g['images']:
 name=image['name'];view=g['bufferViews'][image['bufferView']];data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']];path=exported/(name+'-source.png');path.write_bytes(data)
 t=unreal.AssetImportTask();t.filename=str(path);t.destination_path=base+'/Textures';t.destination_name=name;t.automated=True;t.replace_existing=True;t.replace_existing_settings=True;t.save=True
 unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t]);tex=unreal.load_asset(base+'/Textures/'+name);color='Albedo' in name or 'Label' in name;normal='Normal' in name
 tex.srgb=color;tex.flip_green_channel=False;tex.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_DEFAULT if color else unreal.TextureCompressionSettings.TC_MASKS
 tex.filter=unreal.TextureFilter.TF_TRILINEAR;tex.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert assets.save_loaded_asset(tex,False)
 out=exported/(name+'-exported.png');ex=unreal.AssetExportTask();ex.object=tex;ex.filename=str(out);ex.exporter=unreal.TextureExporterPNG();ex.automated=True;ex.prompt=False;ex.replace_identical=True;assert unreal.Exporter.run_asset_export_task(ex)
 textures.append({'name':name,'source':str(path),'exported':str(out),'srgb':tex.srgb,'flipGreen':tex.flip_green_channel,'compression':str(tex.compression_settings)})
bindings=[]
for i,m in enumerate(g['materials']):
 mi=unreal.load_asset(base+'/Materials/opening-case-delivery_material_'+str(i));pbr=m.get('pbrMetallicRoughness',{});row={}
 for param,desc in [('BaseColorTexture',pbr.get('baseColorTexture')),('MetallicRoughnessTexture',pbr.get('metallicRoughnessTexture')),('NormalTexture',m.get('normalTexture')),('OcclusionTexture',m.get('occlusionTexture')),('EmissiveTexture',m.get('emissiveTexture'))]:
  if desc is not None:
   tex=unreal.load_asset(base+'/Textures/'+g['images'][g['textures'][desc['index']]['source']]['name']);unreal.MaterialEditingLibrary.set_material_instance_texture_parameter_value(mi,param,tex);row[param]=tex.get_path_name()
  # Imported parent contracts differ. Missing switch names must not masquerade as a successful edit.
  switch='bHas'+param
  if switch in [str(n) for n in unreal.MaterialEditingLibrary.get_static_switch_parameter_names(mi)]:
   unreal.MaterialEditingLibrary.set_material_instance_static_switch_parameter_value(mi,switch,desc is not None)
   assert unreal.MaterialEditingLibrary.get_material_instance_static_switch_parameter_value(mi,switch)==(desc is not None)
 unreal.MaterialEditingLibrary.update_material_instance(mi);assert assets.save_loaded_asset(mi,False)
 for param,path in row.items():assert unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(mi,param).get_path_name()==path
 bindings.append(row)
assert snapshot()==before
for r in overrides:
 assert hashlib.sha256(Path(r['file']).read_bytes()).hexdigest()==r['sha256'];mi=unreal.load_asset(r['path']);assert abs(unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,'RoughnessFactor')-r['roughness'])<1e-6
assert level.save_current_level()
(E/(label+'-native-result.json')).write_text(json.dumps({'ok':True,'revision':saved['asset']['revisionId'],'before':before,'after':snapshot(),'textures':textures,'bindings':bindings,'overrides':overrides,'checks':['same_actor_components_meshes_bounds_hinge','semantic_image_sources_and_material_bindings','native_override_bytes_and_values_preserved'],'limits':['GPU compression and rendered appearance require separate tests','No live PIE-state preservation claim']},indent=2));unreal.log('CASE_MATERIAL_UPDATE_PASS')
