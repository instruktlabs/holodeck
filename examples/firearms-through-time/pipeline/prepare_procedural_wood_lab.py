import json,struct,math,hashlib
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert level.load_level('/Game/Qualification/OpeningCaseLab')
case_result=json.loads((E/'procedural-wood-case-native-result.json').read_text());assert case_result['ok']
for r in case_result['overrides']:assert hashlib.sha256(Path(r['file']).read_bytes()).hexdigest()==r['sha256']
case=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='OpeningCaseActor');assert len(case.get_components_by_class(unreal.StaticMeshComponent))==9
(E/'procedural-wood-native-reopen.json').write_text(json.dumps({'ok':True,'checks':['saved_map_reopens','nine_case_meshes_present','override_hashes_preserved_after_prior_process_timeout']},indent=2))
name='/Game/Qualification/ProceduralWoodLab';assert not assets.does_asset_exist(name);assert level.new_level(name)
path=ROOT/'authoring/procedural-wood-comparison.glb';blob=path.read_bytes();n=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+n]);binary=blob[n+28:]
task=unreal.AssetImportTask();task.filename=str(path);task.destination_path='/Game/Qualification/ProceduralWoodGenerated';task.automated=True;task.save=True
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task]);meshes=[a for p in task.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)];assert len(meshes)==3
for mesh in meshes:
 actor=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(1000,0,0));actor.static_mesh_component.set_static_mesh(mesh);actor.static_mesh_component.set_cast_shadow(False);actor.set_actor_label(mesh.get_name())
exported=E/'procedural-wood-lab-native-textures';exported.mkdir();textures=[]
for p in assets.list_assets(task.destination_path,recursive=True,include_folder=False):
 tex=unreal.load_asset(p)
 if not isinstance(tex,unreal.Texture2D):continue
 image=next(i for i in g['images'] if i['name']==tex.get_name());view=g['bufferViews'][image['bufferView']];data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']];source=exported/(tex.get_name()+'-source.png');source.write_bytes(data)
 color=tex.get_name().endswith('_Albedo');normal=tex.get_name().endswith('_Normal');tex.srgb=color;tex.flip_green_channel=False;tex.filter=unreal.TextureFilter.TF_TRILINEAR;tex.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE
 tex.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_DEFAULT if color else unreal.TextureCompressionSettings.TC_MASKS;assert assets.save_loaded_asset(tex,False)
 out=exported/(tex.get_name()+'-exported.png');ex=unreal.AssetExportTask();ex.object=tex;ex.filename=str(out);ex.exporter=unreal.TextureExporterPNG();ex.automated=True;ex.prompt=False;ex.replace_identical=True;assert unreal.Exporter.run_asset_export_task(ex)
 textures.append({'name':tex.get_name(),'source':str(source),'exported':str(out),'srgb':tex.srgb,'flipGreen':tex.flip_green_channel,'compression':str(tex.compression_settings)})
assert len(textures)==len(g['images'])
light=actors.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(1000,500,172),unreal.Rotator(pitch=0,yaw=-90,roll=0));light.set_actor_label('WoodQualificationSun');light.light_component.set_intensity(1);light.light_component.set_light_color(unreal.LinearColor(1,1,1,1))
camera=actors.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(1000,340,172),unreal.Rotator(pitch=0,yaw=-90,roll=0));camera.set_editor_property('auto_activate_for_player',unreal.AutoReceiveInput.PLAYER0);camera.camera_component.set_field_of_view(math.degrees(2*math.atan(math.tan(math.radians(63)/2)*1280/720)));camera.camera_component.set_editor_property('constrain_aspect_ratio',False)
settings=camera.camera_component.get_editor_property('post_process_settings')
for key,value in {'auto_exposure_bias':0.,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():settings.set_editor_property('override_'+key,True);settings.set_editor_property(key,value)
camera.camera_component.set_editor_property('post_process_settings',settings)
driver=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.ExhibitActor'),unreal.Vector());driver.set_actor_hidden_in_game(True);driver.set_actor_label('WoodCaptureDriver');assert level.save_current_level()
(E/'procedural-wood-lab-native-result.json').write_text(json.dumps({'ok':True,'textures':textures,'meshes':[m.get_path_name() for m in meshes],'map':name,'gltfCamera':[10,1.72,3.4],'cameraFovY':63,'sunDirectionToSource':[0,0,1],'sunIntensity':1},indent=2))
