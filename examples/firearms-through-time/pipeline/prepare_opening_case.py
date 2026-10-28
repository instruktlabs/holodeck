import json,hashlib
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
target='/Game/Qualification/OpeningCaseLab'
if assets.does_asset_exist(target):
 assert level.load_level(target)
 assert not any(a.get_class().get_name()=='OpeningCaseActor' for a in actors.get_all_level_actors()),'Preserve completed fixture'
else:assert level.new_level_from_template(target,'/Game/Qualification/MaterialDiagnostics')
source=ROOT/'authoring/opening-case-delivery.glb'
saved=json.loads((ROOT/'evidence/opening-case-delivery-saved.json').read_text(encoding='utf-8-sig'))['asset']
sha=hashlib.sha256(source.read_bytes()).hexdigest();assert 'sha256:'+sha==saved['files']['asset.glb']['sha256']
task=unreal.AssetImportTask();task.filename=str(source);task.destination_path='/Game/Qualification/OpeningCaseGenerated';task.automated=True;task.replace_existing=True;task.save=True;task.async_=False
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
meshes=sorted([a for p in task.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)],key=lambda m:m.get_name())
body=[m for m in meshes if m.get_name().startswith('Mesh_Body_')];lid=[m for m in meshes if m.get_name().startswith('Mesh_Lid_')]
assert len(body)==6 and len(lid)==3, [m.get_name() for m in meshes]
rows=[]
for m in meshes:
 b=m.get_bounding_box();rows.append({'name':m.get_name(),'min':[b.min.x,b.min.y,b.min.z],'max':[b.max.x,b.max.y,b.max.z]})
receipt={'assetId':saved['assetId'],'revisionId':saved['revisionId'],'sha256':sha,'map':target,'meshes':rows}
(ROOT/'evidence/opening-case-native-import.json').write_text(json.dumps(receipt,indent=2))
# Observed Interchange behavior: it bakes the parent pivot into static mesh vertices.
assert all(60<m.get_bounding_box().max.z<71 for m in lid),'Unexpected lid frame; refuse guessed compensation'
for a in actors.get_all_level_actors():
 if a.get_class().get_name()=='ExhibitActor':actors.destroy_actor(a)
case=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.OpeningCaseActor'),unreal.Vector())
case.set_parts(body,lid);case.set_actor_label('OpeningTransportCase')
for component in case.get_components_by_class(unreal.StaticMeshComponent):
 if component.static_mesh.get_name().startswith('Mesh_Lid_'):component.set_relative_location(unreal.Vector(0,34.6,-62.5),False,False)
receipt['lidCompensationCentimetres']=[0,34.6,-62.5]
for p in assets.list_assets('/Game/Qualification/OpeningCaseGenerated',recursive=True,include_folder=False):
 a=unreal.load_asset(p)
 if isinstance(a,unreal.Texture2D):a.filter=unreal.TextureFilter.TF_TRILINEAR;a.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert assets.save_loaded_asset(a,False)
assert level.save_current_level();receipt['ok']=True
(ROOT/'evidence/opening-case-native-import.json').write_text(json.dumps(receipt,indent=2))
