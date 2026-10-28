"""Reimport v3 hands and bind native animation assets in the scratch WeaponLab."""
import unreal,json,hashlib,shutil,runpy
from pathlib import Path
R=Path(__file__).resolve().parents[1];E=R/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/WeaponLab')
weapon=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='WeaponLoop')
def snapshot():
 return {'actor':weapon.get_path_name(),'actors':len(actors.get_all_level_actors()),'parts':[{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'parent':c.get_attach_parent().get_path_name(),'location':list(c.relative_location.to_tuple())} for c in weapon.get_components_by_class(unreal.StaticMeshComponent)]}
before=snapshot();backup=E/'weapon-v3-native-before'
if not backup.exists():
 shutil.copytree(R/'native/ToolchainValidation/Content/Qualification/WeaponGenerated/first-hands',backup/'first-hands')
 shutil.copy2(R/'native/ToolchainValidation/Content/Qualification/WeaponLab.umap',backup/'WeaponLab.umap')
pin=json.loads((R/'game/asset-pins.json').read_text())['assets']['hands'];source=R/'authoring/first-hands.glb';assert hashlib.sha256(source.read_bytes()).hexdigest()==pin['sha256']
dest='/Game/Qualification/WeaponGenerated/first-hands';old=sorted(assets.list_assets(dest,recursive=True,include_folder=False))
pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES;pipeline.material_pipeline.reuse_existing_materials=False
stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
task=unreal.AssetImportTask();task.filename=str(source);task.destination_path=dest;task.options=stack;task.automated=True;task.replace_existing=True;task.replace_existing_settings=True;task.save=True;task.async_=False;unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
paths=sorted(assets.list_assets(dest,recursive=True,include_folder=False));assert set(old).issubset(paths)
clips={};textures=[]
for path in paths:
 obj=unreal.load_asset(path)
 if isinstance(obj,unreal.AnimSequence):
  clips[obj.get_name()]=obj
 if isinstance(obj,unreal.Texture2D):
  n=obj.get_name();normal='Normal' in n;data='ORM' in n
  obj.set_editor_property('srgb',not(normal or data));obj.set_editor_property('flip_green_channel',False);obj.set_editor_property('compression_settings',unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_MASKS if data else unreal.TextureCompressionSettings.TC_DEFAULT);obj.set_editor_property('filter',unreal.TextureFilter.TF_TRILINEAR);assets.save_loaded_asset(obj,False);textures.append(path)
# Write actual importer names before asserting/binding; never infer paths.
(E/'weapon-v3-native-import-checkpoint.json').write_text(json.dumps({'paths':paths,'clips':{k:v.get_path_name() for k,v in clips.items()}},indent=2))
resolved={}
for name in ['Ready','Reload','Inspect','Fire']:
 matches=[v for k,v in clips.items() if k=='first-hands'+name]
 assert len(matches)==1,(name,list(clips))
 resolved[name]=matches[0]
hand=unreal.load_asset(dest+'/first-hands/SkeletalMeshes/first-hands');bones=[str(n) for n in hand.skeleton.get_reference_pose().get_bone_names()];assert len(bones)==33
components=weapon.get_components_by_class(unreal.SkeletalMeshComponent);assert len(components)==1
weapon.set_hands(hand);weapon.set_clips(resolved['Ready'],resolved['Reload'],resolved['Inspect'],resolved['Fire'])
# Remove only obsolete generated poseable component if serialization retained it.
for c in weapon.get_components_by_class(unreal.PoseableMeshComponent):
 assert c.get_name()=='SkinnedGloves';c.destroy_component(weapon)
assert len(weapon.get_components_by_class(unreal.SkeletalMeshComponent))==1
assert snapshot()==before,'Weapon part bindings changed'
assert level.save_current_level()
runpy.run_path(str(R/'pipeline/bind_weapon_materials.py'),init_globals={'EVIDENCE_NAME':'weapon-v3-native-material-bindings.json'})
records={k:{'path':v.get_path_name(),'duration':v.get_play_length(),'skeleton':v.get_editor_property('skeleton').get_path_name()} for k,v in resolved.items()}
assert abs(records['Reload']['duration']-3.2)<.025 and abs(records['Inspect']['duration']-3.6)<.025
(E/'weapon-v3-native-import.json').write_text(json.dumps({'ok':True,'pin':pin,'before':before,'after':snapshot(),'clips':records,'bones':bones,'textures':textures},indent=2));unreal.log('WEAPON_V3_IMPORT_PASS')
