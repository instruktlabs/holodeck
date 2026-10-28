"""Apply the exact child delivery, asserting native overlay and actor preservation."""
import json,hashlib,shutil,math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
before=json.loads((ROOT/'evidence/native-override-before-update.json').read_text())
saved=json.loads((ROOT/'evidence/exhibit-v2-saved.json').read_text(encoding='utf-8-sig'))
source=ROOT/'authoring/interaction-exhibit-v2.glb'
digest=hashlib.sha256(source.read_bytes()).hexdigest()
assert 'sha256:'+digest==saved['asset']['files']['asset.glb']['sha256']
staged=ROOT/'deliveries/unreal-exhibit/interaction-exhibit.glb'
staged.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,staged)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);assert level.load_level('/Game/Qualification/ExhibitLab')
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
allactors=actors.get_all_level_actors();actor=next(a for a in allactors if a.get_actor_label()=='KilnInteractionExhibit')
def snapshot():
    return [{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())]} for c in actor.get_components_by_class(unreal.StaticMeshComponent)]
assert actor.get_path_name()==before['actor'] and snapshot()==before['components']
oldpaths=sorted(assets.list_assets('/Game/Qualification/ExhibitGenerated',recursive=True,include_folder=False))
task=unreal.AssetImportTask();task.filename=str(staged);task.destination_path='/Game/Qualification/ExhibitGenerated'
# Use the engine's GLTF stack, changing only this process's in-memory options.
# Never save these engine assets. Generated materials follow source; native child
# instances live outside this destination and must remain byte-for-byte intact.
pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline')
pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES
pipeline.material_pipeline.reuse_existing_materials=False
stack=unreal.InterchangePipelineStackOverride()
stack.add_pipeline(pipeline)
stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
task.options=stack
task.automated=True;task.replace_existing=True;task.replace_existing_settings=True;task.save=True;task.async_=False
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
# A mesh/scene GLTF import intentionally skips existing material assets in
# InterchangeMaterialFactory. Request each generated material/texture explicitly.
manager=unreal.InterchangeManager.get_interchange_manager_scripted()
explicit=[]
for asset_path in oldpaths:
    obj=unreal.load_asset(asset_path)
    if isinstance(obj,(unreal.MaterialInstanceConstant,unreal.Texture2D)):
        params=unreal.ImportAssetParameters(reimport_asset=obj,is_automated=True,replace_existing=True,override_pipelines=stack.override_pipelines)
        result=manager.import_asset('/Game/Qualification/ExhibitGenerated',manager.create_source_data(str(staged)),params)
        assert result is not None, 'Explicit reimport failed: '+asset_path
        assert assets.save_loaded_asset(obj,False)
        explicit.append({'path':asset_path,'imported':[a.get_path_name() for a in result]})
assert sorted(assets.list_assets('/Game/Qualification/ExhibitGenerated',recursive=True,include_folder=False))==oldpaths,'Import created or removed asset paths'
assert snapshot()==before['components'],'Actor/component/material binding changed'
assert len(actors.get_all_level_actors())==before['actorCount'],'Actor count changed'
override=unreal.load_asset(before['override']);parent=override.parent
def scalar(obj,name):return next(s.parameter_value for s in obj.scalar_parameter_values if str(s.parameter_info.name)==name)
assert abs(scalar(override,'RoughnessFactor')-.12)<1e-6
assert abs(scalar(parent,'RoughnessFactor')-.55)<1e-6
assert parent.get_path_name()==before['parent']
file=ROOT/'native/ToolchainValidation/Content/Qualification/NativeOverrides/MI_ExhibitCopper.uasset'
assert hashlib.sha256(file.read_bytes()).hexdigest()==before['overrideFileSha256'],'Native override file was changed by import'
panel=next(c.static_mesh for c in actor.get_components_by_class(unreal.StaticMeshComponent) if c.static_mesh.get_name()=='Mesh_CheckerPanel')
box=panel.get_bounding_box();width=box.max.x-box.min.x
assert abs(width-150)<.02,'New panel geometry was not adopted'
receipt={'ok':True,'sourceSha256':digest,'sourceRevision':saved['asset']['revisionId'],'actor':actor.get_path_name(),'components':snapshot(),'sourcePanelWidthCm':width,'override':override.get_path_name(),'overrideSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'overrideRoughness':scalar(override,'RoughnessFactor'),'importedParentRoughness':scalar(parent,'RoughnessFactor'),'importedParentColor':[[v.parameter_value.r,v.parameter_value.g,v.parameter_value.b,v.parameter_value.a] for v in parent.vector_parameter_values if str(v.parameter_info.name)=='BaseColorFactor'],'assetPaths':oldpaths,'checks':['new_geometry_adopted','generated_paths_stable','actor_and_components_preserved','material_bindings_preserved','native_override_bytes_unchanged','source_parent_updated','native_roughness_override_preserved']}
for a in allactors:
    if isinstance(a,unreal.DirectionalLight):
        a.set_actor_rotation(unreal.Rotator(pitch=math.degrees(math.atan2(-5,math.hypot(3,5))),yaw=math.degrees(math.atan2(-5,3)),roll=0),False)
        a.light_component.set_intensity(3)
receipt['lighting']={'sourceDirectionGltf':[-3,5,5],'whiteDirectionalIntensity':3,'fill':0,'nativeExposureBias':.09}
receipt['pipeline']={'stack':['DefaultGLTFAssetsPipeline','DefaultGLTFPipeline'],'reimportStrategy':'APPLY_PIPELINE_PROPERTIES','reuseExistingMaterials':False,'replaceExistingSettings':True}
receipt['explicitReimports']=explicit
assert level.save_current_level()
(ROOT/'evidence/native-update-result.json').write_text(json.dumps(receipt,indent=2))
unreal.log('EXHIBIT_UPDATED_WITH_NATIVE_OVERRIDE_PRESERVED')
