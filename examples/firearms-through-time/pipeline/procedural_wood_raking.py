import math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);assert level.load_level('/Game/Qualification/ProceduralWoodLab')
light=next(a for a in actors.get_all_level_actors() if a.get_actor_label()=='WoodQualificationSun');light.set_actor_rotation(unreal.Rotator(pitch=0,yaw=math.degrees(math.atan2(-1,-5)),roll=0),False);light.light_component.set_intensity(3);assert level.save_current_level()
