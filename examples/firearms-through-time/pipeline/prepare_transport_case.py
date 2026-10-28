"""Import a pinned realistic prop into a separate, repeatable native test map."""
import json,hashlib,math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
map_path='/Game/Qualification/TransportCaseLab'
assert not assets.does_asset_exist(map_path),'Fixture exists; do not overwrite'
saved=json.loads((ROOT/'evidence/transport-case-saved.json').read_text(encoding='utf-8-sig'))['asset']
source=ROOT/'authoring/museum-transport-case-final.glb'
assert 'sha256:'+hashlib.sha256(source.read_bytes()).hexdigest()==saved['files']['asset.glb']['sha256']
task=unreal.AssetImportTask();task.filename=str(source);task.destination_path='/Game/Qualification/TransportCaseGenerated'
task.automated=True;task.replace_existing=True;task.save=True;task.async_=False
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
meshes=sorted([a for p in task.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)],key=lambda m:m.get_name())
assert len(meshes)==5
receipt={'sourceHash':hashlib.sha256(source.read_bytes()).hexdigest(),'assetId':saved['assetId'],'sourceRevision':saved['revisionId'],'map':map_path,'meshes':[],'textures':[],'materials':[]}
for p in assets.list_assets('/Game/Qualification/TransportCaseGenerated',recursive=True,include_folder=False):
 a=unreal.load_asset(p)
 if isinstance(a,unreal.Texture2D):
  row={'path':p,'name':a.get_name(),'srgb':a.srgb,'filter':str(a.filter),'compression':str(a.compression_settings),'flipGreen':a.flip_green_channel,'mips':str(a.mip_gen_settings)}
  if '_MR' in a.get_name() or '_Normal' in a.get_name():assert not a.srgb,'Data map imported as sRGB'
  else:assert a.srgb,'Albedo imported as linear'
  a.filter=unreal.TextureFilter.TF_TRILINEAR;a.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE
  assert assets.save_loaded_asset(a,False)
  receipt['textures'].append(row)
 elif isinstance(a,unreal.MaterialInstanceConstant):
  receipt['materials'].append({'path':p,'parent':a.parent.get_path_name(),'scalars':{str(s.parameter_info.name):s.parameter_value for s in a.scalar_parameter_values},'textures':{str(t.parameter_info.name):t.parameter_value.get_path_name() for t in a.texture_parameter_values if t.parameter_value}})
assert len(receipt['textures'])==6
for m in meshes:
 b=m.get_bounding_box();receipt['meshes'].append({'name':m.get_name(),'min':[b.min.x,b.min.y,b.min.z],'max':[b.max.x,b.max.y,b.max.z],'material':m.get_material(0).get_path_name()})
assert level.new_level(map_path)
actor=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.ExhibitActor'),unreal.Vector())
actor.set_mesh_parts(meshes);actor.set_actor_label('MuseumTransportCase')
floor=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(0,0,-11))
floor.static_mesh_component.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Cube'));floor.set_actor_scale3d(unreal.Vector(30,30,.2));floor.set_actor_label('StudyFloor')
light=actors.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(0,0,600),unreal.Rotator(pitch=math.degrees(math.atan2(-5,math.hypot(3,5))),yaw=math.degrees(math.atan2(-5,3)),roll=0))
light.light_component.set_intensity(3);light.light_component.set_light_color(unreal.LinearColor(1,1,1,1))
camera=actors.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(65,145,172),unreal.Rotator(pitch=-39.72,yaw=-114.1455,roll=0))
camera.set_editor_property('auto_activate_for_player',unreal.AutoReceiveInput.PLAYER0)
camera.camera_component.set_field_of_view(math.degrees(2*math.atan(math.tan(math.radians(63)/2)*1280/720)))
camera.camera_component.set_editor_property('constrain_aspect_ratio',False)
pp=camera.camera_component.get_editor_property('post_process_settings')
for k,v in {'auto_exposure_bias':.09,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():pp.set_editor_property('override_'+k,True);pp.set_editor_property(k,v)
camera.camera_component.set_editor_property('post_process_settings',pp)
# A neutral captured environment supplies metal reflections; source albedo stays intact.
matpath='/Game/Qualification/TransportCaseStudio/M_StudioSky'
mat=unreal.load_asset(matpath) if assets.does_asset_exist(matpath) else unreal.AssetToolsHelpers.get_asset_tools().create_asset('M_StudioSky','/Game/Qualification/TransportCaseStudio',unreal.Material,unreal.MaterialFactoryNew())
mat.set_editor_property('shading_model',unreal.MaterialShadingModel.MSM_UNLIT);mat.set_editor_property('two_sided',True)
unreal.MaterialEditingLibrary.delete_all_material_expressions(mat)
color=unreal.MaterialEditingLibrary.create_material_expression(mat,unreal.MaterialExpressionConstant3Vector)
color.set_editor_property('constant',unreal.LinearColor(.4,.4,.4,1))
unreal.MaterialEditingLibrary.connect_material_property(color,'',unreal.MaterialProperty.MP_EMISSIVE_COLOR)
unreal.MaterialEditingLibrary.recompile_material(mat);assert assets.save_loaded_asset(mat,False)
sky=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector())
sky.static_mesh_component.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Sphere'));sky.static_mesh_component.set_material(0,mat)
sky.static_mesh_component.set_cast_shadow(False);sky.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION)
sky.set_actor_scale3d(unreal.Vector(1000,1000,1000));sky.set_actor_label('NeutralStudioSky')
fill=actors.spawn_actor_from_class(unreal.SkyLight,unreal.Vector(0,0,200));fill.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
fill.light_component.set_intensity(.6);fill.light_component.set_editor_property('real_time_capture',True)
fill.light_component.set_editor_property('lower_hemisphere_is_black',False)
actors.spawn_actor_from_class(unreal.PlayerStart,unreal.Vector(1500,1500,100))
assert level.save_current_level()
receipt['lighting']={'sunGltf':[-3,5,5],'sunIntensity':3,'skyLinearRGB':[.4,.4,.4],'skyIntensity':.6,'nativeEV':.09,'limit':'Presentation setup; captured environments are not numerically identical across engines.'}
receipt['ok']=True
(ROOT/'evidence/transport-case-native-import.json').write_text(json.dumps(receipt,indent=2))
