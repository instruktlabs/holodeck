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
backup=E/'fine-wood-native-backup'
if not backup.exists():
 backup.mkdir()
 for rel in ['OpeningCaseLab.umap','OpeningCaseGenerated','NativeOverrides']:
  source=ROOT/'native/ToolchainValidation/Content/Qualification'/rel
  if source.is_dir():shutil.copytree(source,backup/rel)
  else:shutil.copy2(source,backup/rel)
 (E/'fine-wood-native-before.json').write_text(json.dumps(before,indent=2))
saved=json.loads((E/'fine-wood-case-saved.json').read_text(encoding='utf-8-sig'))
source=ROOT/'authoring/opening-case-fine-wood.glb'
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

assert snapshot()==before,'Actor bindings, bounds, hinge or override slots changed'
exec(compile((ROOT/'pipeline/repair-fine-wood-textures.py').read_text(),str(ROOT/'pipeline/repair-fine-wood-textures.py'),'exec'))
case=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='OpeningCaseActor')
components=case.get_components_by_class(unreal.StaticMeshComponent)
assert snapshot()==before
(E/'fine-wood-native-result.json').write_text(json.dumps({'ok':True,'revision':saved['asset']['revisionId'],'before':before,'after':snapshot(),'checks':['actor_and_components_unchanged','hinge_and_bindings_unchanged','semantic_texture_repair_applied']},indent=2))
