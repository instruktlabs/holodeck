import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/MaterialLibraryLab')
camera=next(a for a in actors.get_all_level_actors() if isinstance(a,unreal.CameraActor));assert abs(camera.get_actor_location().x)<.01
for a in actors.get_all_level_actors():
 if isinstance(a,(unreal.CameraActor,unreal.StaticMeshActor)):
  p=a.get_actor_location();a.set_actor_location(unreal.Vector(p.x+1000,p.y,p.z),False,False)
assert level.save_current_level()
p=ROOT/'evidence/shortlist-native-import.json';r=json.loads(p.read_text());r['camera']=[10,3.4,1.72];r['captureNote']='Panel group and camera translated together away from the default pawn at origin; relative view unchanged.';p.write_text(json.dumps(r,indent=2))
