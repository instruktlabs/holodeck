"""Separate native material overlay; generated importer outputs remain owned by import."""
import json, math, hashlib
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/ExhibitLab')
allactors=actors.get_all_level_actors()
exhibits=[a for a in allactors if a.get_actor_label()=='KilnInteractionExhibit'];assert len(exhibits)==1
actor=exhibits[0]
components=actor.get_components_by_class(unreal.StaticMeshComponent)
hub=next(c for c in components if c.static_mesh.get_name()=='Mesh_CopperHub')
parent=hub.static_mesh.get_material(0)
path='/Game/Qualification/NativeOverrides/MI_ExhibitCopper'
override=unreal.load_asset(path) if assets.does_asset_exist(path) else unreal.AssetToolsHelpers.get_asset_tools().create_asset('MI_ExhibitCopper','/Game/Qualification/NativeOverrides',unreal.MaterialInstanceConstant,unreal.MaterialInstanceConstantFactoryNew())
assert override
unreal.MaterialEditingLibrary.set_material_instance_parent(override,parent)
unreal.MaterialEditingLibrary.update_material_instance(override)
parameter_info=next(s.parameter_info for s in parent.scalar_parameter_values if str(s.parameter_info.name)=='RoughnessFactor')
override.set_editor_property('scalar_parameter_values',[])
setter_result=unreal.MaterialEditingLibrary.set_material_instance_scalar_parameter_value(override,'RoughnessFactor',0.12,parameter_info.association)
# Preserve the complete imported parameter address, including layer association/index.
if not setter_result:
    override.set_editor_property('scalar_parameter_values',[unreal.ScalarParameterValue(parameter_info=parameter_info,parameter_value=.12)])
unreal.MaterialEditingLibrary.update_material_instance(override)
hub.set_material(0,override)
assert assets.save_loaded_asset(override)
for a in allactors:
    if isinstance(a,unreal.DirectionalLight):
        a.set_actor_rotation(unreal.Rotator(pitch=0,yaw=-90,roll=0),False)
        a.light_component.set_intensity(1)
        a.light_component.set_light_color(unreal.LinearColor(1,1,1,1))
    if isinstance(a,unreal.SkyLight):a.light_component.set_intensity(0)
    if isinstance(a,unreal.CameraActor):
        a.set_actor_location(unreal.Vector(40,300,172),False,False)
        a.set_actor_rotation(unreal.Rotator(pitch=-math.degrees(.2),yaw=-90,roll=0),False)
        a.camera_component.set_field_of_view(math.degrees(2*math.atan(math.tan(math.radians(63)/2)*1280/720)))
        a.camera_component.set_editor_property('constrain_aspect_ratio',False)
        settings=a.camera_component.get_editor_property('post_process_settings')
        for key,value in {'auto_exposure_bias':.09,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():
            settings.set_editor_property('override_'+key,True);settings.set_editor_property(key,value)
        a.camera_component.set_editor_property('post_process_settings',settings)
assert level.save_current_level()
receipt={'actor':actor.get_path_name(),'actorClass':actor.get_class().get_path_name(),'actorCount':len(allactors),'components':[{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())]} for c in components],'override':override.get_path_name(),'parent':parent.get_path_name(),'helperSetterResult':setter_result,'roughness':next(s.parameter_value for s in override.scalar_parameter_values if str(s.parameter_info.name)=='RoughnessFactor'),'sourceRoughness':next(s.parameter_value for s in parent.scalar_parameter_values if str(s.parameter_info.name)=='RoughnessFactor')}
file=ROOT/'native/ToolchainValidation/Content/Qualification/NativeOverrides/MI_ExhibitCopper.uasset'
receipt['overrideFileSha256']=hashlib.sha256(file.read_bytes()).hexdigest()
receipt['parameterInfo']=str(parameter_info)
receipt['apiReadback']=unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(override,'RoughnessFactor',parameter_info.association)
(ROOT/'evidence/native-override-before-update.json').write_text(json.dumps(receipt,indent=2))
