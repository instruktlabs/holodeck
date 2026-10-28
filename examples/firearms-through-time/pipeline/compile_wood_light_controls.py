import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/WoodLightControlLab');rows=[]
for actor in actors.get_all_level_actors():
 if not isinstance(actor,unreal.StaticMeshActor) or not actor.static_mesh_component.static_mesh:continue
 mi=actor.static_mesh_component.get_material(0);assert mi.get_path_name().startswith('/Game/Qualification/LightingControls/')
 unreal.MaterialEditingLibrary.set_material_usage_override(mi,unreal.MaterialUsage.MATUSAGE_NANITE,True,True)
 scalar_names=[str(n) for n in unreal.MaterialEditingLibrary.get_scalar_parameter_names(mi)]
 assert 'NormalScale' in scalar_names,scalar_names
 before=unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,'NormalScale')
 setter_result=unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(mi,'NormalScale',0.0)
 after=unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,'NormalScale')
 (ROOT/'evidence/wood-control-scalar-readback.json').write_text(json.dumps({'material':mi.get_path_name(),'before':before,'setterResult':setter_result,'after':after},indent=2))
 assert after==0.0,(before,setter_result,after)
 unreal.MaterialEditingLibrary.update_material_instance(mi);assert assets.save_loaded_asset(mi,False)
 rows.append({'material':mi.get_path_name(),'parent':mi.parent.get_path_name(),'baseColor':unreal.MaterialEditingLibrary.get_material_instance_texture_parameter_value(mi,'BaseColorTexture').get_path_name(),'normalScale':unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,'NormalScale'),'staticSwitchNames':[str(n) for n in unreal.MaterialEditingLibrary.get_static_switch_parameter_names(mi)]})
assert len(rows)==3;assert level.save_current_level()
assert level.load_level('/Game/Qualification/NaturalWoodLab')
for actor in actors.get_all_level_actors():
 if not isinstance(actor,unreal.StaticMeshActor) or not actor.static_mesh_component.static_mesh:continue
 mi=actor.static_mesh_component.get_material(0);assert mi.get_path_name().startswith('/Game/Qualification/NaturalTimberGenerated/')
 unreal.MaterialEditingLibrary.set_material_usage_override(mi,unreal.MaterialUsage.MATUSAGE_NANITE,True,True)
 unreal.MaterialEditingLibrary.update_material_instance(mi);assert assets.save_loaded_asset(mi,False)
 rows.append({'material':mi.get_path_name(),'parent':mi.parent.get_path_name(),'purpose':'natural timber, explicit Nanite usage'})
assert len(rows)==4;assert level.save_current_level()
(ROOT/'evidence/wood-control-gpu-compiled.json').write_text(json.dumps({'ok':True,'materials':rows,'setup':'D3D12 editor, explicit Nanite material usage override, NormalScale=0 on comparison clones, conventional raster components'},indent=2))
