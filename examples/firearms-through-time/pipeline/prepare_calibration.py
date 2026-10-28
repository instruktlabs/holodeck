import json,math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
task=unreal.AssetImportTask()
task.filename=str(ROOT/'authoring/calibration-chart.glb');task.destination_path='/Game/Qualification/CalibrationGenerated'
task.automated=True;task.replace_existing=True;task.save=True;task.async_=False
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
meshes=[a for p in task.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)]
assert len(meshes)==8
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert not assets.does_asset_exist('/Game/Qualification/CalibrationMap'), 'Calibration map already exists'
assert level.new_level('/Game/Qualification/CalibrationMap')
for mesh in meshes:
    a=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector())
    a.static_mesh_component.set_static_mesh(mesh)
    a.static_mesh_component.set_cast_shadow(False)
    a.set_actor_label(mesh.get_name())
light=actors.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(0,500,172),unreal.Rotator(pitch=0,yaw=-90,roll=0))
light.light_component.set_intensity(1)
light.light_component.set_light_color(unreal.LinearColor(1,1,1,1))
camera=actors.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(0,500,172),unreal.Rotator(pitch=0,yaw=-90,roll=0))
camera.set_editor_property('auto_activate_for_player',unreal.AutoReceiveInput.PLAYER0)
hfov=math.degrees(2*math.atan(math.tan(math.radians(63)/2)*1280/720))
camera.camera_component.set_field_of_view(hfov)
camera.camera_component.set_editor_property('constrain_aspect_ratio',False)
settings=camera.camera_component.get_editor_property('post_process_settings')
for key,value in {'auto_exposure_bias':0.,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():
    settings.set_editor_property('override_'+key,True)
    settings.set_editor_property(key,value)
camera.camera_component.set_editor_property('post_process_settings',settings)
driver=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.ExhibitActor'),unreal.Vector())
driver.set_actor_label('CalibrationCaptureDriver')
assert level.save_current_level()
(ROOT/'evidence/calibration-setup.json').write_text(json.dumps({'hfov':hfov,'vfov':63,'cameraCm':[0,500,172],'sunLux':1,'fill':0,'exposureBias':0,'map':'/Game/Qualification/CalibrationMap'},indent=2))
