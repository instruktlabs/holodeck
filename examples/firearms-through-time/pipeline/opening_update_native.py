"""Case reimport qualification: generated assets and artist-owned overrides."""
import json, hashlib, shutil, sys, re
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
E=ROOT/'evidence'
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assert level.load_level('/Game/Qualification/OpeningCaseLab')
case=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='OpeningCaseActor')
components=case.get_components_by_class(unreal.StaticMeshComponent)
generated='/Game/Qualification/OpeningCaseGenerated'
def scalar(o):
 return unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(o,'RoughnessFactor')
def snapshot():
 return normalized({'actor':case.get_path_name(),'actorCount':len(actors.get_all_level_actors()),'components':[{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())],'location':str(c.relative_location),'rotation':str(c.relative_rotation),'parent':c.get_attach_parent().get_path_name()} for c in components]})
def normalized(data):
 return json.loads(re.sub(r' \(0x[0-9A-Fa-f]+\)','',json.dumps(data)))
def bounds():
 return {c.static_mesh.get_name():{'min':list(c.static_mesh.get_bounding_box().min.to_tuple()),'max':list(c.static_mesh.get_bounding_box().max.to_tuple())} for c in components}
before_file=E/'opening-update-native-before.json'
if not before_file.exists():
 backup=E/'opening-update-native-backup'
 if not backup.exists():
  backup.mkdir()
  for rel in ['OpeningCaseLab.umap','OpeningCaseGenerated','NativeOverrides']:
   source=ROOT/'native/ToolchainValidation/Content/Qualification'/rel
   if source.is_dir():shutil.copytree(source,backup/rel)
   elif source.is_file():shutil.copy2(source,backup/rel)
 overrides=[]
 for suffix,value in [('PaintedFrame',.18),('SteelHardware',.72)]:
  targets=[c for c in components if c.static_mesh.get_name().endswith('_'+suffix)]
  assert len(targets)==2
  parent=targets[0].static_mesh.get_material(0)
  assert all(c.static_mesh.get_material(0)==parent for c in targets)
  name='MI_Case_'+suffix
  path='/Game/Qualification/NativeOverrides/'+name
  assert not assets.does_asset_exist(path),'Do not overwrite existing authored material'
  mi=unreal.AssetToolsHelpers.get_asset_tools().create_asset(name,'/Game/Qualification/NativeOverrides',unreal.MaterialInstanceConstant,unreal.MaterialInstanceConstantFactoryNew())
  unreal.MaterialEditingLibrary.set_material_instance_parent(mi,parent)
  info=next((v.parameter_info for v in parent.scalar_parameter_values if str(v.parameter_info.name)=='RoughnessFactor'),unreal.MaterialParameterInfo(name='RoughnessFactor',association=unreal.MaterialParameterAssociation.GLOBAL_PARAMETER,index=-1))
  mi.set_editor_property('scalar_parameter_values',[unreal.ScalarParameterValue(parameter_info=info,parameter_value=value)])
  unreal.MaterialEditingLibrary.update_material_instance(mi)
  for c in targets:c.set_material(0,mi)
  assert assets.save_loaded_asset(mi,False)
  f=ROOT/'native/ToolchainValidation/Content/Qualification/NativeOverrides'/(name+'.uasset')
  overrides.append({'path':mi.get_path_name(),'parent':parent.get_path_name(),'file':str(f),'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'roughness':scalar(mi),'sourceRoughness':scalar(parent),'parameterInfo':str(info)})
 assert level.save_current_level()
 receipt={**snapshot(),'bounds':bounds(),'overrides':overrides,'assets':sorted(assets.list_assets(generated,recursive=True,include_folder=False))}
 before_file.write_text(json.dumps(receipt,indent=2))
 unreal.log('OPENING_UPDATE_BASELINE_SAVED')
else:
 before=normalized(json.loads(before_file.read_text()))
 assert snapshot()=={k:before[k] for k in ['actor','actorCount','components']}
 source=ROOT/'authoring/opening-case-update.glb'
 saved=json.loads((E/'opening-update-saved.json').read_text(encoding='utf-8-sig'))
 digest=hashlib.sha256(source.read_bytes()).hexdigest()
 assert 'sha256:'+digest==saved['asset']['files']['asset.glb']['sha256']
 staged=ROOT/'deliveries/unreal-opening-case/opening-case-delivery.glb'
 staged.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,staged)
 pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline')
 pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES
 pipeline.material_pipeline.reuse_existing_materials=False
 stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
 task=unreal.AssetImportTask();task.filename=str(staged);task.destination_path=generated;task.options=stack
 task.automated=True;task.replace_existing=True;task.replace_existing_settings=True;task.save=True;task.async_=False
 unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
 manager=unreal.InterchangeManager.get_interchange_manager_scripted()
 explicit=[]
 for p in before['assets']:
  obj=unreal.load_asset(p)
  if isinstance(obj,(unreal.MaterialInstanceConstant,unreal.Texture2D)):
   params=unreal.ImportAssetParameters(reimport_asset=obj,is_automated=True,replace_existing=True,override_pipelines=stack.override_pipelines)
   assert manager.import_asset(generated,manager.create_source_data(str(staged)),params) is not None
   if isinstance(obj,unreal.Texture2D):
    obj.filter=unreal.TextureFilter.TF_TRILINEAR;obj.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE
    if 'Normal' in obj.get_name():obj.flip_green_channel=False
   assert assets.save_loaded_asset(obj,False)
   explicit.append(p)
 assert sorted(assets.list_assets(generated,recursive=True,include_folder=False))==before['assets']
 assert snapshot()=={k:before[k] for k in ['actor','actorCount','components']},'Actor or material bindings changed'
 after_overrides=[]
 for row in before['overrides']:
  mi=unreal.load_asset(row['path'])
  assert mi.parent.get_path_name()==row['parent']
  assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest()==row['sha256']
  assert abs(scalar(mi)-row['roughness'])<1e-6
  expected=.60 if 'PaintedFrame' in row['path'] else .23
  assert abs(scalar(mi.parent)-expected)<1e-6
  after_overrides.append({**row,'sourceRoughness':scalar(mi.parent)})
 after_bounds=bounds()
 lid='Mesh_Lid_TimberPanels'
 assert abs(after_bounds[lid]['max'][2]-before['bounds'][lid]['max'][2]-2)<.02
 assert all(after_bounds[n]==b for n,b in before['bounds'].items() if n!=lid)
 assert level.save_current_level()
 result={'ok':True,'asset':saved['asset']['assetId'],'revision':saved['asset']['revisionId'],'sha256':digest,'before':before,'after':snapshot(),'bounds':after_bounds,'overrides':after_overrides,'explicitReimports':explicit,'checks':['same_actor_and_nine_components','same_mesh_and_material_bindings','same_hinge_and_component_transforms','lid_top_increased_2cm','other_mesh_bounds_unchanged','source_materials_updated','native_override_parameters_and_bytes_preserved']}
 (E/'opening-update-native-result.json').write_text(json.dumps(result,indent=2))
 unreal.log('OPENING_UPDATE_NATIVE_PASS')
