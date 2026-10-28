"""Apply the two pinned appearance/rig revisions in the existing WeaponLab."""
import unreal,json,hashlib,shutil,runpy
from pathlib import Path
R=Path(__file__).resolve().parents[1];E=R/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/WeaponLab')
weapon=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='WeaponLoop')
def snapshot():
 return {'actor':weapon.get_path_name(),'actors':len(actors.get_all_level_actors()),'parts':[{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'parent':c.get_attach_parent().get_path_name(),'location':list(c.relative_location.to_tuple())} for c in weapon.get_components_by_class(unreal.StaticMeshComponent)]}
before=snapshot();backup=E/'weapon-v2-native-before'
if not backup.exists():
 shutil.copytree(R/'native/ToolchainValidation/Content/Qualification/WeaponGenerated',backup/'WeaponGenerated')
 shutil.copy2(R/'native/ToolchainValidation/Content/Qualification/WeaponLab.umap',backup/'WeaponLab.umap')
 (E/'weapon-v2-native-before.json').write_text(json.dumps(before,indent=2))
pins=json.loads((R/'game/asset-pins.json').read_text())['assets'];records=[]
pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES;pipeline.material_pipeline.reuse_existing_materials=False
stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
manager=unreal.InterchangeManager.get_interchange_manager_scripted()
for name in ['hands','pistol']:
 source=R/'authoring'/('first-'+name+'.glb');sha=hashlib.sha256(source.read_bytes()).hexdigest();assert sha==pins[name]['sha256']
 dest='/Game/Qualification/WeaponGenerated/first-'+name;old=sorted(assets.list_assets(dest,recursive=True,include_folder=False))
 task=unreal.AssetImportTask();task.filename=str(source);task.destination_path=dest;task.options=stack;task.automated=True;task.replace_existing=True;task.replace_existing_settings=True;task.save=True;task.async_=False;unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
 for path in old:
  obj=unreal.load_asset(path)
  if isinstance(obj,(unreal.MaterialInstanceConstant,unreal.Texture2D)):
   params=unreal.ImportAssetParameters(reimport_asset=obj,is_automated=True,replace_existing=True,override_pipelines=stack.override_pipelines)
   assert manager.import_asset(dest,manager.create_source_data(str(source)),params) is not None
   assert assets.save_loaded_asset(obj,False)
 paths=sorted(assets.list_assets(dest,recursive=True,include_folder=False));assert set(old).issubset(paths),'Existing asset paths lost'
 textures=[];materials=[]
 for path in paths:
  obj=unreal.load_asset(path)
  if isinstance(obj,unreal.Texture2D):
   n=obj.get_name();normal='Normal' in n;data='ORM' in n
   assert normal or data or 'Albedo' in n,'Unexpected texture '+n
   obj.set_editor_property('srgb',not(normal or data));obj.set_editor_property('flip_green_channel',False)
   obj.set_editor_property('compression_settings',unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_MASKS if data else unreal.TextureCompressionSettings.TC_DEFAULT)
   obj.set_editor_property('filter',unreal.TextureFilter.TF_TRILINEAR);assert assets.save_loaded_asset(obj,False)
   textures.append({'path':path,'srgb':obj.srgb,'flipGreen':obj.flip_green_channel,'compression':str(obj.compression_settings),'filter':str(obj.filter)})
  if isinstance(obj,unreal.MaterialInstanceConstant):materials.append({'path':path,'textures':[{'parameter':str(p.parameter_info.name),'texture':p.parameter_value.get_path_name() if p.parameter_value else None} for p in obj.texture_parameter_values]})
 records.append({'name':name,'pin':pins[name],'paths':paths,'textures':textures,'materials':materials})
 (E/'weapon-v2-native-import-checkpoint.json').write_text(json.dumps(records,indent=2))
assert snapshot()==before,'Actor, part or parent binding changed'
hand=unreal.load_asset('/Game/Qualification/WeaponGenerated/first-hands/first-hands/SkeletalMeshes/first-hands')
bones=[str(n) for n in hand.skeleton.get_reference_pose().get_bone_names()];assert len(bones)==33
weapon.set_hands(hand)
grip=unreal.load_asset('/Game/Qualification/WeaponGenerated/first-pistol/first-pistol/Materials/WalnutGrip')
assert any(str(p.parameter_info.name)=='BaseColorFactor' for p in grip.vector_parameter_values)
grips=[c for c in weapon.get_components_by_class(unreal.StaticMeshComponent) if c.static_mesh.get_material(0)==grip];assert len(grips)==32,len(grips)
assert len(records[0]['textures'])==3 and len(records[1]['textures'])==6
assert level.save_current_level()
runpy.run_path(str(R/'pipeline/bind_weapon_materials.py'))
bindings=json.loads((E/'weapon-v2-native-material-bindings.json').read_text());assert bindings['ok']
(E/'weapon-v2-native-import.json').write_text(json.dumps({'ok':True,'before':before,'after':snapshot(),'bones':bones,'gripBindings':len(grips),'imports':records,'verifiedMaterialBindings':bindings},indent=2))
unreal.log('WEAPON_V2_IMPORT_PASS')
