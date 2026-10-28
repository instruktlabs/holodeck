import json,math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assert not (E/'wood-light-control-native-setup.json').exists()
mesh_paths=json.loads((E/'procedural-wood-lab-native-result.json').read_text())['meshes']
assert len(mesh_paths)==3
assert level.load_level('/Game/Qualification/WoodLightControlLab') if assets.does_asset_exist('/Game/Qualification/WoodLightControlLab') else level.new_level('/Game/Qualification/WoodLightControlLab')
assert not any(isinstance(a,unreal.StaticMeshActor) and a.static_mesh_component.static_mesh for a in actors.get_all_level_actors()),'Only resume an empty staging map'
for path in mesh_paths:
 mesh=unreal.load_asset(path);actor=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(1000,0,0));actor.static_mesh_component.set_static_mesh(mesh);actor.static_mesh_component.set_cast_shadow(False);actor.set_actor_label(mesh.get_name())
actors.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(1000,500,172),unreal.Rotator(pitch=0,yaw=-90,roll=0))
camera=actors.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(1000,340,172),unreal.Rotator(pitch=0,yaw=-90,roll=0));camera.set_editor_property('auto_activate_for_player',unreal.AutoReceiveInput.PLAYER0);camera.camera_component.set_field_of_view(math.degrees(2*math.atan(math.tan(math.radians(63)/2)*1280/720)));camera.camera_component.set_editor_property('constrain_aspect_ratio',False)
settings=camera.camera_component.get_editor_property('post_process_settings')
for key,value in {'auto_exposure_bias':0.,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():settings.set_editor_property('override_'+key,True);settings.set_editor_property(key,value)
camera.camera_component.set_editor_property('post_process_settings',settings)
driver=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.ExhibitActor'),unreal.Vector());driver.set_actor_hidden_in_game(True)
audit=[]
for actor in actors.get_all_level_actors():
 if isinstance(actor,unreal.DirectionalLight):
  actor.set_actor_rotation(unreal.Rotator(pitch=0,yaw=-90,roll=0),False);light=actor.light_component
  row={'kind':'light','sourceAngleBefore':light.get_editor_property('light_source_angle'),'softAngleBefore':light.get_editor_property('light_source_soft_angle'),'specularScale':light.get_editor_property('specular_scale')}
  light.set_intensity(1);light.set_light_source_angle(0);light.set_light_source_soft_angle(0);audit.append(row)
 if isinstance(actor,unreal.StaticMeshActor) and actor.static_mesh_component.static_mesh:
  mi=actor.static_mesh_component.get_material(0)
  row={'kind':'material','actor':actor.get_actor_label(),'source':mi.get_path_name(),'scalars':{str(n):unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,n) for n in unreal.MaterialEditingLibrary.get_scalar_parameter_names(mi)}}
  target='/Game/Qualification/LightingControls/'+actor.get_actor_label()+'_NoNormal'
  clone=unreal.load_asset(target) if assets.does_asset_exist(target) else assets.duplicate_asset(mi.get_path_name(),target)
  unreal.MaterialEditingLibrary.set_material_instance_static_switch_parameter_value(clone,'bHasNormalTexture',False)
  unreal.MaterialEditingLibrary.update_material_instance(clone);assert assets.save_loaded_asset(clone,False)
  actor.static_mesh_component.set_material(0,clone);audit.append(row)
assert level.save_current_level()
(E/'wood-light-control-native-setup.json').write_text(json.dumps({'ok':True,'audit':audit,'lightSourceAngle':0,'normals':'disabled via bHasNormalTexture on cloned material instances','originalMaterialsUnchanged':True},indent=2))
