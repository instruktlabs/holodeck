"""Import pinned modules into a separate native interaction fixture."""
import json,hashlib,math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
tools=unreal.AssetToolsHelpers.get_asset_tools();target='/Game/Qualification/RangeSliceLab'
assert not assets.does_asset_exist(target),'Fixture exists; inspect receipt before further mutation'
contract=json.loads((E/'range-slice-contract.json').read_text());rows=[];all_meshes={}
for row in contract['assets']:
 source=ROOT/'authoring'/(row['id']+'.glb');assert hashlib.sha256(source.read_bytes()).hexdigest()==row['sha256']
 task=unreal.AssetImportTask();task.filename=str(source);task.destination_path='/Game/Qualification/RangeSliceGenerated/'+row['id'];task.automated=True;task.replace_existing=True;task.save=True;task.async_=False
 tools.import_asset_tasks([task]);meshes=sorted([a for p in task.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)],key=lambda m:m.get_name())
 assert len(meshes)==(7 if row['id']=='booth-console' else 8)
 all_meshes[row['id']]=meshes
 row={**row,'nativeMeshes':[{'path':m.get_path_name(),'min':list(m.get_bounding_box().min.to_tuple()),'max':list(m.get_bounding_box().max.to_tuple())} for m in meshes],'textures':[]}
 for p in assets.list_assets(task.destination_path,recursive=True,include_folder=False):
  a=unreal.load_asset(p)
  if isinstance(a,unreal.Texture2D):
   name=a.get_name();normal='Normal' in name;color='Albedo' in name
   a.srgb=color;a.flip_green_channel=False;a.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_DEFAULT if color else unreal.TextureCompressionSettings.TC_MASKS
   a.filter=unreal.TextureFilter.TF_TRILINEAR;a.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert assets.save_loaded_asset(a,False)
   row['textures'].append({'path':p,'srgb':a.srgb,'normal':normal,'size':[a.blueprint_get_size_x(),a.blueprint_get_size_y()]})
  elif isinstance(a,unreal.MaterialInstanceConstant):
   unreal.MaterialEditingLibrary.update_material_instance(a);assert assets.save_loaded_asset(a,False)
 rows.append(row)
 assert len(row['textures'])==(0 if row['id']=='target-module' else 3)
 (E/'range-slice-native-import-progress.json').write_text(json.dumps(rows,indent=2))
assert level.new_level(target)
actor=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.RangeSliceActor'),unreal.Vector());actor.set_actor_label('RangeSliceController')
for ident,short,loc,pivot in [('collection-bay','bay',[1200,0,0],[23,0,104]),('booth-console','console',[1800,0,0],[0,0,0]),('target-module','target',[2400,0,0],[0,0,170])]:
 meshes=all_meshes[ident];moving=[m for m in meshes if m.get_name().startswith('Mesh_Moving_')];body=[m for m in meshes if m.get_name().startswith('Mesh_Body_')]
 assert len(body)+len(moving)==len(meshes)
 if moving:assert all((98 if short=='bay' else 125)<m.get_bounding_box().max.z<(112 if short=='bay' else 230) for m in moving),'Unexpected baked joint frame'
 actor.add_module(short,body,moving,unreal.Vector(*loc),unreal.Vector(*pivot))
for obj in contract['objects']:
 collider=obj.get('collider')
 if not collider or obj['id']=='range-floor':continue
 for i,box in enumerate(collider['boxes'] if collider['type']=='compound' else [collider]):
  center=[obj['position'][j]+box['offset'][j] for j in range(3)];size=box['size']
  actor.add_blocker(obj['id']+str(i),unreal.Vector(center[0]*100,center[2]*100,center[1]*100),unreal.Vector(size[0]*100,size[2]*100,size[1]*100))
screen=next(c for c in actor.get_components_by_class(unreal.StaticMeshComponent) if c.static_mesh.get_name()=='Mesh_Body_screen');parent=screen.static_mesh.get_material(0)
mi=tools.create_asset('MI_ConsoleScreen','/Game/Qualification/RangeSliceOverrides',unreal.MaterialInstanceConstant,unreal.MaterialInstanceConstantFactoryNew());unreal.MaterialEditingLibrary.set_material_instance_parent(mi,parent)
info=next((v.parameter_info for v in parent.scalar_parameter_values if str(v.parameter_info.name)=='RoughnessFactor'),unreal.MaterialParameterInfo(name='RoughnessFactor',association=unreal.MaterialParameterAssociation.GLOBAL_PARAMETER,index=-1))
mi.set_editor_property('scalar_parameter_values',[unreal.ScalarParameterValue(parameter_info=info,parameter_value=.19)]);unreal.MaterialEditingLibrary.update_material_instance(mi);screen.set_material(0,mi);assert assets.save_loaded_asset(mi,False)
floor=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(1800,0,-4));floor.static_mesh_component.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Cube'));floor.set_actor_scale3d(unreal.Vector(20,12,.08));floor.set_actor_label('RangeFloor')
mat=tools.create_asset('M_RangeFloor','/Game/Qualification/RangeSliceOverrides',unreal.Material,unreal.MaterialFactoryNew());color=unreal.MaterialEditingLibrary.create_material_expression(mat,unreal.MaterialExpressionConstant3Vector);color.constant=unreal.LinearColor(.42,.43,.42,1);unreal.MaterialEditingLibrary.connect_material_property(color,'',unreal.MaterialProperty.MP_BASE_COLOR)
rough=unreal.MaterialEditingLibrary.create_material_expression(mat,unreal.MaterialExpressionConstant);rough.r=.85;unreal.MaterialEditingLibrary.connect_material_property(rough,'',unreal.MaterialProperty.MP_ROUGHNESS);unreal.MaterialEditingLibrary.recompile_material(mat);assert assets.save_loaded_asset(mat,False);floor.static_mesh_component.set_material(0,mat)
light=actors.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(1100,600,1200),unreal.Rotator(pitch=-52.5,yaw=-40.6,roll=0));light.light_component.set_mobility(unreal.ComponentMobility.MOVABLE);light.light_component.set_intensity(2);light.light_component.set_light_color(unreal.LinearColor(1,1,1,1))
sky=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(1800,0,0));sky.static_mesh_component.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Sphere'));sky.static_mesh_component.set_material(0,unreal.load_asset('/Game/Qualification/TransportCaseStudio/M_StudioSky'));sky.static_mesh_component.set_cast_shadow(False);sky.static_mesh_component.set_collision_profile_name('NoCollision');sky.static_mesh_component.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION);sky.set_actor_enable_collision(False);sky.set_actor_scale3d(unreal.Vector(1000,1000,1000))
fill=actors.spawn_actor_from_class(unreal.SkyLight,unreal.Vector(1800,0,200));fill.light_component.set_mobility(unreal.ComponentMobility.MOVABLE);fill.light_component.set_intensity(.5);fill.light_component.set_editor_property('source_type',unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP);fill.light_component.set_editor_property('cubemap',unreal.load_asset('/Game/Qualification/TransportCaseStudio/studio-radiance-040'));fill.light_component.set_editor_property('lower_hemisphere_is_black',False)
camera=actors.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(1800,1200,700),unreal.Rotator(pitch=-26.565,yaw=-90,roll=0));camera.tags=['RangeReviewCamera'];camera.set_actor_label('RangeReviewCamera');camera.camera_component.set_field_of_view(95);camera.camera_component.set_editor_property('constrain_aspect_ratio',False)
pawn=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.RangeSlicePawn'),unreal.Vector(1640,480,90),unreal.Rotator(pitch=0,yaw=-90,roll=0));pawn.set_actor_label('RangeWalkthroughPawn')
for cam in [camera.camera_component,pawn.get_component_by_class(unreal.CameraComponent)]:
 pp=cam.get_editor_property('post_process_settings')
 for k,v in {'auto_exposure_bias':.09,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():pp.set_editor_property('override_'+k,True);pp.set_editor_property(k,v)
 cam.set_editor_property('post_process_settings',pp)
assert level.save_current_level()
overridefile=ROOT/'native/ToolchainValidation/Content/Qualification/RangeSliceOverrides/MI_ConsoleScreen.uasset'
receipt={'ok':True,'map':target,'assets':rows,'components':len(actor.get_components_by_class(unreal.StaticMeshComponent)),'blockers':len(actor.get_components_by_class(unreal.BoxComponent)),'override':{'path':mi.get_path_name(),'roughness':unreal.MaterialEditingLibrary.get_material_instance_scalar_parameter_value(mi,'RoughnessFactor'),'file':str(overridefile),'sha256':hashlib.sha256(overridefile.read_bytes()).hexdigest()},'limitations':['First-person capsule walkthrough; no skeletal character','Renderer lighting is a presentation baseline, not numerical parity','No firearm, scoring or moving-part collision']}
(E/'range-slice-native-import.json').write_text(json.dumps(receipt,indent=2));unreal.log('RANGE_SLICE_IMPORTED')
