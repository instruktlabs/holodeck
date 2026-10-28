"""Qualify a wood-only delivery update without touching authored overrides."""
import json, hashlib, shutil
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]; E=ROOT/'evidence'
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assert level.load_level('/Game/Qualification/OpeningCaseLab')
case=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='OpeningCaseActor')
components=case.get_components_by_class(unreal.StaticMeshComponent)
generated='/Game/Qualification/OpeningCaseGenerated'
def scalar(o):return unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(o,'RoughnessFactor')
def snapshot():
 return {'actor':case.get_path_name(),'actorCount':len(actors.get_all_level_actors()),'components':[{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())],'location':list(c.relative_location.to_tuple()),'rotation':[c.relative_rotation.pitch,c.relative_rotation.yaw,c.relative_rotation.roll],'parent':c.get_attach_parent().get_path_name(),'parentLocation':list(c.get_attach_parent().relative_location.to_tuple()),'boundsMin':list(c.static_mesh.get_bounding_box().min.to_tuple()),'boundsMax':list(c.static_mesh.get_bounding_box().max.to_tuple())} for c in components]}
before=snapshot()
previous=json.loads((E/'opening-update-native-result.json').read_text())
for row in previous['overrides']:
 assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest()==row['sha256'],'Authored override changed since baseline'
backup=E/'megascans-native-backup'
if not backup.exists():
 backup.mkdir()
 for rel in ['OpeningCaseLab.umap','OpeningCaseGenerated','NativeOverrides']:
  source=ROOT/'native/ToolchainValidation/Content/Qualification'/rel
  if source.is_dir():shutil.copytree(source,backup/rel)
  else:shutil.copy2(source,backup/rel)
 (E/'megascans-native-before.json').write_text(json.dumps(before,indent=2))
saved=json.loads((E/'megascans-case-saved.json').read_text(encoding='utf-8-sig'))
source=ROOT/'authoring/opening-case-megascans.glb'
digest=hashlib.sha256(source.read_bytes()).hexdigest()
assert 'sha256:'+digest==saved['asset']['files']['asset.glb']['sha256']
staged=ROOT/'deliveries/unreal-opening-case/opening-case-delivery.glb'
shutil.copy2(source,staged)
pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline')
pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES
pipeline.material_pipeline.reuse_existing_materials=False
stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
task=unreal.AssetImportTask();task.filename=str(staged);task.destination_path=generated;task.options=stack
task.automated=True;task.replace_existing=True;task.replace_existing_settings=True;task.save=True;task.async_=False
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
manager=unreal.InterchangeManager.get_interchange_manager_scripted();explicit=[];textures=[];materials=[]
for path in sorted(assets.list_assets(generated,recursive=True,include_folder=False)):
 obj=unreal.load_asset(path)
 if isinstance(obj,(unreal.MaterialInstanceConstant,unreal.Texture2D)):
  params=unreal.ImportAssetParameters(reimport_asset=obj,is_automated=True,replace_existing=True,override_pipelines=stack.override_pipelines)
  assert manager.import_asset(generated,manager.create_source_data(str(staged)),params) is not None
  if isinstance(obj,unreal.Texture2D):
   obj.filter=unreal.TextureFilter.TF_TRILINEAR;obj.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE
   if 'Normal' in obj.get_name():obj.flip_green_channel=False
   textures.append({'path':path,'srgb':obj.srgb,'compression':str(obj.compression_settings),'flipGreen':obj.flip_green_channel,'filter':str(obj.filter),'mips':str(obj.mip_gen_settings),'width':obj.blueprint_get_size_x(),'height':obj.blueprint_get_size_y()})
  else:
   materials.append({'path':path,'parent':obj.parent.get_path_name(),'textures':[{'parameter':str(v.parameter_info.name),'texture':v.parameter_value.get_path_name() if v.parameter_value else None} for v in obj.texture_parameter_values],'roughness':scalar(obj)})
  assert assets.save_loaded_asset(obj,False);explicit.append(path)
assert snapshot()==before,'Actor, mesh binding, bounds, hinge or override slots changed'
overrides=[]
for row in previous['overrides']:
 mi=unreal.load_asset(row['path'])
 assert mi.parent.get_path_name()==row['parent']
 assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest()==row['sha256']
 assert abs(scalar(mi)-row['roughness'])<1e-6
 assert abs(scalar(mi.parent)-row['sourceRoughness'])<1e-6
 overrides.append(row)
wood=[t for t in textures if 'Case_Wood_' in t['path']]
assert len(wood)==3
assert all(t['width']==1024 and t['height']==2048 for t in wood)
assert all(t['srgb']==('Albedo' in t['path']) for t in wood)
assert level.save_current_level()
result={'ok':True,'revision':saved['asset']['revisionId'],'sha256':digest,'before':before,'after':snapshot(),'overrides':overrides,'textures':textures,'materials':materials,'explicitReimports':explicit,'checks':['same_actor_and_nine_components','same_mesh_paths_bounds_and_material_slots','same_hinge_and_transforms','native_override_bytes_and_effective_values_unchanged','wood_textures_1024x2048','wood_albedo_srgb_and_normal_orm_linear'],'limits':['Fresh runtime interaction and appearance must be qualified separately.','This does not prove transient Unreal PIE state survives a live reimport.']}
(E/'megascans-native-result.json').write_text(json.dumps(result,indent=2));unreal.log('MEGASCANS_NATIVE_PASS')
