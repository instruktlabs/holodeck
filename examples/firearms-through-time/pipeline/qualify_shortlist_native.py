"""First-pass material atlas. Each one-metre swatch keeps its own material closure."""
import json,math,hashlib,struct
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
# Reacquire handles after level reload, then independently verify the case delivery.
assert level.load_level('/Game/Qualification/OpeningCaseLab')
case=next(a for a in actors.get_all_level_actors() if a.get_class().get_name()=='OpeningCaseActor')
components=case.get_components_by_class(unreal.StaticMeshComponent)
def snapshot():
 return {'actor':case.get_path_name(),'actorCount':len(actors.get_all_level_actors()),'components':[{'path':c.get_path_name(),'mesh':c.static_mesh.get_path_name(),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())],'location':list(c.relative_location.to_tuple()),'rotation':[c.relative_rotation.pitch,c.relative_rotation.yaw,c.relative_rotation.roll],'parent':c.get_attach_parent().get_path_name(),'parentLocation':list(c.get_attach_parent().relative_location.to_tuple()),'boundsMin':list(c.static_mesh.get_bounding_box().min.to_tuple()),'boundsMax':list(c.static_mesh.get_bounding_box().max.to_tuple())} for c in components]}
before=json.loads((E/'fine-wood-native-before.json').read_text());after=snapshot();assert before==after
for row in json.loads((E/'opening-update-native-result.json').read_text())['overrides']:
 assert hashlib.sha256(Path(row['file']).read_bytes()).hexdigest()==row['sha256']
saved=json.loads((E/'fine-wood-case-saved.json').read_text(encoding='utf-8-sig'))
(E/'fine-wood-native-result.json').write_text(json.dumps({'ok':True,'revision':saved['asset']['revisionId'],'before':before,'after':after,'checks':['actor_and_components_unchanged','hinge_and_bindings_unchanged','override_files_unchanged'],'note':'Reacquired actor handles after explicit level reload; initial post-repair verification held a stale UObject reference.'},indent=2))
map_name='/Game/Qualification/MaterialLibraryLab'
assert level.load_level(map_name) if assets.does_asset_exist(map_name) else level.new_level(map_name)
assert not any(isinstance(a,unreal.StaticMeshActor) for a in actors.get_all_level_actors()),'Do not overwrite a populated lab'
rows=json.loads((E/'shortlist-swatches.json').read_text());results=[];exported=E/'shortlist-native-textures';exported.mkdir(exist_ok=True)
for row in rows:
 path=ROOT/(row['path']+'.glb');blob=path.read_bytes();n=struct.unpack_from('<I',blob,12)[0];g=json.loads(blob[20:20+n]);binary=blob[n+28:]
 task=unreal.AssetImportTask();task.filename=str(path);task.destination_path='/Game/Qualification/MaterialLibraryGenerated/'+row['id'];task.automated=True;task.save=True;task.replace_existing=True
 unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
 meshes=[a for p in task.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.StaticMesh)];assert len(meshes)==1
 x,y,z=row['position'];actor=actors.spawn_actor_from_class(unreal.StaticMeshActor,unreal.Vector(x*100,z*100,y*100));actor.static_mesh_component.set_static_mesh(meshes[0]);actor.static_mesh_component.set_cast_shadow(False);actor.set_actor_label(row['name'])
 textures=[]
 for p in assets.list_assets(task.destination_path,recursive=True,include_folder=False):
  obj=unreal.load_asset(p)
  if not isinstance(obj,unreal.Texture2D):continue
  name=obj.get_name();im=next(i for i in g['images'] if i['name']==name);view=g['bufferViews'][im['bufferView']];data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  source=exported/(name+'-source.png');source.write_bytes(data)
  obj.srgb=name.endswith('_Albedo');obj.flip_green_channel=False;obj.filter=unreal.TextureFilter.TF_TRILINEAR;obj.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE
  obj.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if name.endswith('_Normal') else unreal.TextureCompressionSettings.TC_DEFAULT if obj.srgb else unreal.TextureCompressionSettings.TC_MASKS
  assert assets.save_loaded_asset(obj,False)
  out=exported/(name+'-exported.png');export=unreal.AssetExportTask();export.object=obj;export.filename=str(out);export.exporter=unreal.TextureExporterPNG();export.automated=True;export.prompt=False;export.replace_identical=True;assert unreal.Exporter.run_asset_export_task(export)
  textures.append({'name':name,'source':str(source),'exported':str(out),'srgb':obj.srgb,'compression':str(obj.compression_settings),'flipGreen':obj.flip_green_channel})
 assert len(textures)==3
 results.append({'id':row['id'],'mesh':meshes[0].get_path_name(),'textures':textures})
light=actors.spawn_actor_from_class(unreal.DirectionalLight,unreal.Vector(0,500,172),unreal.Rotator(pitch=0,yaw=-90,roll=0));light.light_component.set_intensity(1);light.light_component.set_light_color(unreal.LinearColor(1,1,1,1))
camera=actors.spawn_actor_from_class(unreal.CameraActor,unreal.Vector(0,340,172),unreal.Rotator(pitch=0,yaw=-90,roll=0));camera.set_editor_property('auto_activate_for_player',unreal.AutoReceiveInput.PLAYER0)
camera.camera_component.set_field_of_view(math.degrees(2*math.atan(math.tan(math.radians(63)/2)*1280/720)));camera.camera_component.set_editor_property('constrain_aspect_ratio',False)
settings=camera.camera_component.get_editor_property('post_process_settings')
for key,value in {'auto_exposure_bias':0.,'vignette_intensity':0.,'bloom_intensity':0.,'scene_fringe_intensity':0.,'blue_correction':0.,'expand_gamut':0.}.items():settings.set_editor_property('override_'+key,True);settings.set_editor_property(key,value)
camera.camera_component.set_editor_property('post_process_settings',settings)
driver=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.ExhibitActor'),unreal.Vector());driver.set_actor_label('CalibrationCaptureDriver');driver.set_actor_hidden_in_game(True)
assert level.save_current_level();(E/'shortlist-native-import.json').write_text(json.dumps({'ok':True,'entries':results,'map':map_name,'camera':[0,3.4,1.72],'sunLux':1,'exposureBias':0},indent=2))

