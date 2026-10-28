import runpy
from pathlib import Path
HERE=Path(__file__).resolve().parent
runpy.run_path(str(HERE/'qualify-case-material.py'),run_name='__main__')
runpy.run_path(str(HERE/'prepare_natural_wood_lab.py'),run_name='__main__')
import unreal,json
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/WoodLightControlLab');rows=[]
for a in actors.get_all_level_actors():
 if isinstance(a,unreal.StaticMeshActor) and a.static_mesh_component.static_mesh:
  mi=a.static_mesh_component.get_material(0);assert mi.get_path_name().startswith('/Game/Qualification/LightingControls/')
  unreal.MaterialEditingLibrary.set_material_instance_static_switch_parameter_value(mi,'bHasNormalTexture',True);unreal.MaterialEditingLibrary.update_material_instance(mi);assert assets.save_loaded_asset(mi,False);rows.append(mi.get_path_name())
assert len(rows)==3;assert level.save_current_level()
(HERE.parent/'evidence/wood-light-control-normals-restored.json').write_text(json.dumps({'ok':True,'materials':rows,'lightSourceAngle':0,'renderPath':'conventional raster','normalMaps':True},indent=2))
