from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/MaterialLibraryLab')
drivers=[a for a in actors.get_all_level_actors() if a.get_actor_label()=='CalibrationCaptureDriver'];assert len(drivers)==1
drivers[0].set_actor_hidden_in_game(True);assert level.save_current_level()
