"""Bind only the two intentionally revised exterior meshes, preserving material interfaces."""
import unreal,json,hashlib,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1];E=R/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
A=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);AS=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert L.load_level('/Game/Qualification/WeaponLab')
w=next(a for a in AS.get_all_level_actors() if a.get_class().get_name()=='WeaponLoop');parts=w.get_components_by_class(unreal.StaticMeshComponent);assert len(parts)==72
def snap():return [{'name':c.get_name(),'mesh':c.static_mesh.get_path_name(),'parent':c.get_attach_parent().get_path_name(),'location':list(c.relative_location.to_tuple()),'rotation':list(c.relative_rotation.to_tuple()),'scale':list(c.relative_scale3d.to_tuple()),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())]} for c in parts]
before=snap();backup=E/'pistol-v5-native-before';backup.mkdir(exist_ok=False);shutil.copy2(R/'native/ToolchainValidation/Content/Qualification/WeaponLab.umap',backup/'WeaponLab.umap')
pin=json.loads((R/'game/asset-pins.json').read_text())['assets']['pistol'];src=R/'authoring/first-pistol.glb';assert hashlib.sha256(src.read_bytes()).hexdigest()==pin['sha256']
dest='/Game/Qualification/WeaponGenerated/first-pistol-v5';assert not A.does_directory_exist(dest)
p=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');p.material_pipeline.reuse_existing_materials=False
stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(p);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
t=unreal.AssetImportTask();t.filename=str(src);t.destination_path=dest;t.options=stack;t.automated=True;t.replace_existing=False;t.save=True;t.async_=False;unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
meshes={o.get_name():o for path in A.list_assets(dest,True,False) if isinstance(o:=unreal.load_asset(path),unreal.StaticMesh)};assert len(meshes)==72
for c in parts:
 if c.get_name() not in ('Mesh_Frame','Mesh_Trigger'):continue
 mats=[c.get_material(i) for i in range(c.get_num_materials())];assert c.set_static_mesh(meshes[c.get_name()])
 for i,m in enumerate(mats):c.set_material(i,m)
after=snap()
for b,a in zip(before,after):
 assert {k:v for k,v in b.items() if k!='mesh'}=={k:v for k,v in a.items() if k!='mesh'}
 if b['name'] not in ('Mesh_Frame','Mesh_Trigger'):assert b==a
assert L.save_current_level();(E/'pistol-v5-native-import.json').write_text(json.dumps({'ok':True,'pin':pin,'before':before,'after':after,'changedMeshes':['Mesh_Frame','Mesh_Trigger']},indent=2));unreal.log('PISTOL_V5_IMPORT_PASS')
