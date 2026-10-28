"""Set an explicit runtime camera in the generated qualification map."""
from pathlib import Path
import unreal
root = Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve() == (root / 'native/ToolchainValidation').resolve()
level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
assert level.load_level('/Game/Qualification/ValidationMap')
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
current = actors.get_all_level_actors()
cameras = [a for a in current if a.get_actor_label() == 'QualificationCamera']
assert len(cameras) <= 1
camera = cameras[0] if cameras else actors.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(650,650,450))
camera.set_actor_rotation(unreal.Rotator(pitch=-23,yaw=-135,roll=0), False)
camera.set_actor_label('QualificationCamera')
camera.set_editor_property('auto_activate_for_player', unreal.AutoReceiveInput.PLAYER0)
for actor in current:
    if actor.get_actor_label() == 'QualificationLight':
        actor.set_actor_rotation(unreal.Rotator(pitch=-45,yaw=-135,roll=0), False)
assert level.save_current_level()
unreal.log('WORKSPACE_QUALIFICATION_CAMERA_SAVED')
