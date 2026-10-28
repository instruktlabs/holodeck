"""Fresh-process readback after an Interchange reimport process exits."""
import json,hashlib
from pathlib import Path
import unreal
def verify():
 root=Path(__file__).resolve().parents[1];e=root/'evidence';prior=json.loads((e/'range-console-native-update.json').read_text())
 level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem);assert level.load_level('/Game/Qualification/RangeSliceLab')
 actor=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='RangeSliceActor')
 parts=[{'name':c.get_name(),'mesh':c.static_mesh.get_path_name(),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())],'location':list(c.relative_location.to_tuple()),'parent':c.get_attach_parent().get_path_name(),'min':list(c.static_mesh.get_bounding_box().min.to_tuple()),'max':list(c.static_mesh.get_bounding_box().max.to_tuple())} for c in actor.get_components_by_class(unreal.StaticMeshComponent)]
 assert parts==prior['after']['parts'];assert len(actors.get_all_level_actors())==prior['after']['actorCount']
 overlay=prior['override'];assert hashlib.sha256(Path(overlay['file']).read_bytes()).hexdigest()==overlay['sha256'];mi=unreal.load_asset(overlay['path']);rough=unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value
 assert abs(rough(mi,'RoughnessFactor')-.19)<1e-6;assert abs(rough(mi.parent,'RoughnessFactor')-.5)<1e-6
 paint=next(c for c in actor.get_components_by_class(unreal.StaticMeshComponent) if c.get_name().startswith('console_') and c.static_mesh.get_name()=='Mesh_Body_paint').static_mesh.get_material(0);assert abs(rough(paint,'RoughnessFactor')-.68)<1e-6
 (e/'range-console-native-fresh-readback.json').write_text(json.dumps({'ok':True,'revision':prior['sourceRevision'],'components':len(parts),'overrideSha256':overlay['sha256'],'sourceScreenRoughness':rough(mi.parent,'RoughnessFactor'),'nativeScreenRoughness':rough(mi,'RoughnessFactor'),'sourcePaintRoughness':rough(paint,'RoughnessFactor'),'previousProcess':'Reimport assertions and save completed; Python plugin crashed at shutdown. This separate read-only process revalidates disk state.'},indent=2))
verify()
