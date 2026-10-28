import json,struct,math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
name='/Game/Qualification/NaturalWoodLab';assert not assets.does_asset_exist(name);assert level.new_level(name)
path=ROOT/'authoring/timber-specimen.glb';blob=path.read_bytes();n=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+n]);binary=blob[28+n:]
t=unreal.AssetImportTask();t.filename=str(path);t.destination_path='/Game/Qualification/NaturalTimberGenerated';t.automated=True;t.save=True;unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
meshes=[a for p in t.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)];assert len(meshes)==1
for mesh in meshes:
 actor=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(1000,0,52));actor.static_mesh_component.set_static_mesh(mesh);actor.static_mesh_component.set_cast_shadow(False);actor.set_actor_label(mesh.get_name())
exported=E/'natural-timber-native-textures';exported.mkdir();textures=[]
for p in assets.list_assets(t.destination_path,recursive=True,include_folder=False):
 tex=unreal.load_asset(p)
 if not isinstance(tex,unreal.Texture2D):continue
 image=next(i for i in g['images'] if i['name']==tex.get_name());v=g['bufferViews'][image['bufferView']];source=exported/(tex.get_name()+'-source.png');source.write_bytes(binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])
 color=tex.get_name().endswith('_Albedo');normal=tex.get_name().endswith('_Normal');tex.srgb=color;tex.flip_green_channel=False;tex.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_DEFAULT if color else unreal.TextureCompressionSettings.TC_MASKS;tex.filter=unreal.TextureFilter.TF_TRILINEAR;tex.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert assets.save_loaded_asset(tex,False)
 out=exported/(tex.get_name()+'-exported.png');ex=unreal.AssetExportTask();ex.object=tex;ex.filename=str(out);ex.exporter=unreal.TextureExporterPNG();ex.automated=True;ex.prompt=False;ex.replace_identical=True;assert unreal.Exporter.run_asset_export_task(ex)
 textures.append({'name':tex.get_name(),'source':str(source),'exported':str(out),'srgb':tex.srgb,'compression':str(tex.compression_settings)})
assert len(textures)==3
light=actors.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(1300,500,400),unreal.Rotator(pitch=-math.degrees(math.atan2(4,math.hypot(3,5))),yaw=math.degrees(math.atan2(-5,-3)),roll=0));light.light_component.set_intensity(2.5);light.light_component.set_light_source_angle(0);light.light_component.set_light_source_soft_angle(0)
camera=actors.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(1000,210,172),unreal.Rotator(pitch=-math.degrees(math.atan2(.55,2.1)),yaw=-90,roll=0));camera.set_editor_property('auto_activate_for_player',unreal.AutoReceiveInput.PLAYER0);camera.camera_component.set_field_of_view(math.degrees(2*math.atan(math.tan(math.radians(63)/2)*1280/720)));camera.camera_component.set_editor_property('constrain_aspect_ratio',False)
settings=camera.camera_component.get_editor_property('post_process_settings')
for key,value in {'auto_exposure_bias':0.,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():settings.set_editor_property('override_'+key,True);settings.set_editor_property(key,value)
camera.camera_component.set_editor_property('post_process_settings',settings)
driver=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.ExhibitActor'),unreal.Vector());driver.set_actor_hidden_in_game(True);assert level.save_current_level()
(E/'natural-timber-native-result.json').write_text(json.dumps({'ok':True,'map':name,'textures':textures,'camera':[10,1.72,2.1],'objectOffset':[10,.52,0],'look':[0,-math.atan2(.55,2.1)],'lightDirectionToSource':[3,4,5],'lightIntensity':2.5,'sourceAngle':0},indent=2))
