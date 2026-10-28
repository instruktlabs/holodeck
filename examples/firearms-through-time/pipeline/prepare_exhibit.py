"""Dedicated generated exhibit import; run with Unreal Python commandlet."""
import hashlib, json
from pathlib import Path
import unreal
ROOT = Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve() == (ROOT / 'native/ToolchainValidation').resolve()
source = ROOT / 'authoring/interaction-exhibit.glb'
assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
tools = unreal.AssetToolsHelpers.get_asset_tools()
receipt = {'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'passes': []}
for phase in ['import', 'reimport']:
    task = unreal.AssetImportTask()
    task.filename = str(source)
    task.destination_path = '/Game/Qualification/ExhibitGenerated'
    task.automated = True
    task.replace_existing = True
    task.replace_existing_settings = False
    task.save = True
    task.async_ = False
    tools.import_asset_tasks([task])
    meshes = sorted([a for p in task.imported_object_paths if isinstance(a := unreal.load_asset(p), unreal.StaticMesh)], key=lambda m:m.get_path_name())
    receipt['passes'].append({'phase':phase,'paths':list(task.imported_object_paths),'meshes':[{'path':m.get_path_name(),'min':[m.get_bounding_box().min.x,m.get_bounding_box().min.y,m.get_bounding_box().min.z],'max':[m.get_bounding_box().max.x,m.get_bounding_box().max.y,m.get_bounding_box().max.z],'materials':[str(s.material_interface.get_path_name()) if s.material_interface else None for s in m.static_materials]} for m in meshes]})
    (ROOT/'evidence/exhibit-native-import.json').write_text(json.dumps(receipt,indent=2))
    assert len(meshes) == 5, 'This fixture must preserve five named mesh parts'
assert receipt['passes'][0]['meshes'] == receipt['passes'][1]['meshes'], 'Reimport changed identity, bounds or materials'
mesh = meshes[0]
level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
map_path = '/Game/Qualification/ExhibitLab'
assert not assets.does_asset_exist(map_path), 'Map exists; do not overwrite task state'
assert level.new_level(map_path)
cls = unreal.load_class(None, '/Script/ToolchainValidation.ExhibitActor')
assert cls
actor = actors.spawn_actor_from_class(cls, unreal.Vector(0,0,0))
actor.set_mesh_parts(meshes)
actor.set_actor_label('KilnInteractionExhibit')
floor = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0,0,-15))
floor.static_mesh_component.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Cube.Cube'))
floor.set_actor_scale3d(unreal.Vector(10,10,0.2))
floor.set_actor_label('ExhibitFloor')
actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,600), unreal.Rotator(pitch=-45,yaw=-135,roll=0))
sky = actors.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,500))
camera = actors.spawn_actor_from_class(unreal.CameraActor, unreal.Vector(320,440,260), unreal.Rotator(pitch=-19,yaw=-126,roll=0))
camera.set_editor_property('auto_activate_for_player', unreal.AutoReceiveInput.PLAYER0)
camera.camera_component.set_field_of_view(45)
actors.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(800,800,100))
assert level.save_current_level()
receipt.update({'map':map_path,'ok':True,'engine_version':unreal.SystemLibrary.get_engine_version()})
(ROOT/'evidence/exhibit-native-import.json').write_text(json.dumps(receipt,indent=2))
unreal.log('EXHIBIT_IMPORT_REIMPORT_PASSED')
