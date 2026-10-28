"""Run inside Unreal's Python commandlet; edits only ToolchainValidation content."""
import hashlib
import json
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve() == (ROOT / "native/ToolchainValidation").resolve()
SOURCE = ROOT / "authoring/qualification-block.glb"
DESTINATION = "/Game/Qualification/Imported"
MAP = "/Game/Qualification/ValidationMap"
receipt = {"source": str(SOURCE), "sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(), "passes": []}
assets = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
tools = unreal.AssetToolsHelpers.get_asset_tools()
for phase in ["import", "reimport"]:
    task = unreal.AssetImportTask()
    task.filename = str(SOURCE)
    task.destination_path = DESTINATION
    task.automated = True
    task.replace_existing = True  # Dedicated generated fixture path; supports interrupted setup.
    task.replace_existing_settings = False
    task.save = True
    task.async_ = False
    tools.import_asset_tasks([task])
    paths = list(task.imported_object_paths)
    meshes = [a for p in paths if isinstance(a := unreal.load_asset(p), unreal.StaticMesh)]
    assert len(meshes) == 1, (phase, paths)
    mesh = meshes[0]
    box = mesh.get_bounding_box()
    dimensions = [box.max.x-box.min.x, box.max.y-box.min.y, box.max.z-box.min.z]
    assert all(abs(a-b) < 0.05 for a,b in zip(sorted(dimensions),[100,200,300])), dimensions
    receipt["passes"].append({"phase": phase, "paths": paths, "mesh": mesh.get_path_name(), "dimensions_cm": dimensions, "bounds_min": [box.min.x, box.min.y, box.min.z], "bounds_max": [box.max.x, box.max.y, box.max.z]})
assert receipt["passes"][0]["mesh"] == receipt["passes"][1]["mesh"]
level = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
if assets.does_asset_exist(MAP):
    assert level.load_level(MAP)
else:
    assert level.new_level(MAP)
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert not any(a.get_actor_label() == "KilnDimensionFixture" for a in actors.get_all_level_actors()), "Fixture already prepared; inspect receipt instead of duplicating"
actor = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0,0,0))
assert actor is not None
actor.static_mesh_component.set_static_mesh(mesh)
actor.set_actor_label("KilnDimensionFixture")
floor = actors.spawn_actor_from_class(unreal.StaticMeshActor, unreal.Vector(0,0,-30))
floor.static_mesh_component.set_static_mesh(unreal.load_asset('/Engine/BasicShapes/Cube.Cube'))
floor.set_actor_scale3d(unreal.Vector(12,12,0.5))
floor.set_actor_label("QualificationFloor")
light = actors.spawn_actor_from_class(unreal.DirectionalLight, unreal.Vector(0,0,600), unreal.Rotator(pitch=-45,yaw=-135,roll=0))
light.set_actor_label("QualificationLight")
actors.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0,0,500))
actors.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(650,650,350), unreal.Rotator(pitch=-20,yaw=-135,roll=0))
assert level.save_current_level()
receipt["map"] = MAP
receipt["engine_version"] = unreal.SystemLibrary.get_engine_version()
receipt["ok"] = True
(ROOT / "evidence/native-import-validation.json").write_text(json.dumps(receipt, indent=2))
unreal.log("WORKSPACE_QUALIFICATION_IMPORT_PASSED")
