import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert not assets.does_asset_exist('/Game/Qualification/MaterialProbeLab')
assert level.new_level_from_template('/Game/Qualification/MaterialProbeLab','/Game/Qualification/MaterialDiagnostics')
for a in actors.get_all_level_actors():
 if a.get_class().get_name()=='ExhibitActor':a.set_actor_hidden_in_game(True)
 if isinstance(a,unreal.CameraActor):a.set_actor_location_and_rotation(unreal.Vector(0,250,172),unreal.Rotator(pitch=0,yaw=-90,roll=0),False,False)
task=unreal.AssetImportTask();task.filename=str(ROOT/'authoring/material-probe-final.glb');task.destination_path='/Game/Qualification/MaterialProbeGenerated';task.automated=True;task.save=True
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
meshes=[a for p in task.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)]
assert len(meshes)==4
for mesh in meshes:
 a=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector());a.static_mesh_component.set_static_mesh(mesh);a.static_mesh_component.set_cast_shadow(False);a.set_actor_label(mesh.get_name())
textures=[]
for p in assets.list_assets('/Game/Qualification/MaterialProbeGenerated',recursive=True,include_folder=False):
 a=unreal.load_asset(p)
 if isinstance(a,unreal.Texture2D):
  a.filter=unreal.TextureFilter.TF_TRILINEAR;a.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert assets.save_loaded_asset(a,False)
  textures.append({'path':p,'srgb':a.srgb,'normalCompression':str(a.compression_settings),'flipGreen':a.flip_green_channel})
assert level.save_current_level()
(ROOT/'evidence/material-probe-native-import.json').write_text(json.dumps({'ok':True,'textures':textures},indent=2))
