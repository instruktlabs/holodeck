import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1];level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/WoodLightControlLab');rows=[]
for a in actors.get_all_level_actors():
 if isinstance(a,unreal.StaticMeshActor) and a.static_mesh_component.static_mesh:
  c=a.static_mesh_component;c.set_editor_property('disallow_nanite',True);rows.append({'actor':a.get_actor_label(),'disallowNanite':c.get_editor_property('disallow_nanite')})
assert len(rows)==3;assert level.save_current_level()
(ROOT/'evidence/wood-control-raster-fix.json').write_text(json.dumps({'ok':True,'components':rows,'reason':'Diagnostic cloned material static permutations lacked Nanite usage. Use conventional raster for this low-poly control fixture without editing shared engine materials.'},indent=2))
