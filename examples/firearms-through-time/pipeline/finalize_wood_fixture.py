"""Read back the flat-normal control and use conventional rendering for one tiny board."""
import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assert level.load_level('/Game/Qualification/WoodLightControlLab');checks=[]
for a in actors.get_all_level_actors():
 if isinstance(a,unreal.StaticMeshActor) and a.static_mesh_component.static_mesh:
  mi=a.static_mesh_component.get_material(0)
  assert unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,'NormalScale')==0
  checks.append({'material':mi.get_path_name(),'normalScale':0})
assert len(checks)==3
assert level.load_level('/Game/Qualification/NaturalWoodLab');boards=[]
for a in actors.get_all_level_actors():
 if isinstance(a,unreal.StaticMeshActor) and a.static_mesh_component.static_mesh:
  c=a.static_mesh_component;c.set_editor_property('disallow_nanite',True)
  assert c.get_editor_property('disallow_nanite')
  boards.append({'mesh':c.static_mesh.get_path_name(),'material':c.get_material(0).get_path_name(),'disallowNanite':True})
assert len(boards)==1;assert level.save_current_level()
(ROOT/'evidence/natural-wood-fixture-reopen.json').write_text(json.dumps({'ok':True,'persistedFlatNormalControls':checks,'board':boards},indent=2))
