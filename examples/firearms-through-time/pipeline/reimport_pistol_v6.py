"""Pistol v6 sights (owner sight decisions, 27 Oct): bind only the revised sight meshes, preserving material interfaces.
Mesh_FrontSight is swapped in place; the two v5 rear posts become one notched Mesh_RearSight on the slide. Other parts are unchanged."""
import unreal,json,hashlib,shutil
from pathlib import Path
R=Path(__file__).resolve().parents[1];E=R/'evidence'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
A=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);AS=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert L.load_level('/Game/Qualification/WeaponLab')
w=next(a for a in AS.get_all_level_actors() if a.get_class().get_name()=='WeaponLoop')
def comps():return {c.get_name():c for c in w.get_components_by_class(unreal.StaticMeshComponent) if c.get_name().startswith('Mesh_')}
def snap(cs):return {n:{'mesh':c.static_mesh.get_path_name() if c.static_mesh else None,'parent':c.get_attach_parent().get_name(),'location':list(c.relative_location.to_tuple()),'rotation':list(c.relative_rotation.to_tuple()),'scale':list(c.relative_scale3d.to_tuple()),'materials':[c.get_material(i).get_path_name() for i in range(c.get_num_materials())]} for n,c in cs.items()}
before=snap(comps());assert len(before)==72 and {'Mesh_RearSight_L','Mesh_RearSight_R','Mesh_FrontSight'}<=set(before),sorted(before)
backup=E/'sight-v12/pistol-native-before';backup.mkdir(parents=True,exist_ok=False);shutil.copy2(R/'native/ToolchainValidation/Content/Qualification/WeaponLab.umap',backup/'WeaponLab.umap')
pin=json.loads((R/'game/pistol-asset-pins-v2.json').read_text())['assets']['pistol'];src=R/pin['alias'];assert hashlib.sha256(src.read_bytes()).hexdigest()==pin['sha256']
dest='/Game/Qualification/WeaponGenerated/first-pistol-v6';assert not A.does_directory_exist(dest)
p=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');p.material_pipeline.reuse_existing_materials=False
stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(p);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
t=unreal.AssetImportTask();t.filename=str(src);t.destination_path=dest;t.options=stack;t.automated=True;t.replace_existing=False;t.save=True;t.async_=False;unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
meshes={o.get_name():o for path in A.list_assets(dest,True,False) if isinstance(o:=unreal.load_asset(path),unreal.StaticMesh)};assert len(meshes)==71 and 'Mesh_RearSight' in meshes,len(meshes)
cs=comps();front=cs['Mesh_FrontSight'];mats=[front.get_material(i) for i in range(front.get_num_materials())];assert front.set_static_mesh(meshes['Mesh_FrontSight'])
for i,m in enumerate(mats):front.set_material(i,m)
rear_mats=[cs['Mesh_RearSight_L'].get_material(i) for i in range(cs['Mesh_RearSight_L'].get_num_materials())]
w.add_part(meshes['Mesh_RearSight'],'slide');assert w.remove_part('Mesh_RearSight_L') and w.remove_part('Mesh_RearSight_R')
cs=comps();rear=cs['Mesh_RearSight'];assert rear.get_attach_parent().get_name()==before['Mesh_RearSight_L']['parent']
for i in range(rear.get_num_materials()):rear.set_material(i,rear_mats[min(i,len(rear_mats)-1)])
after=snap(cs);assert len(after)==71
for n,b in before.items():
 if n in ('Mesh_RearSight_L','Mesh_RearSight_R'):assert n not in after;continue
 a=after[n];assert {k:v for k,v in b.items() if k!='mesh'}=={k:v for k,v in a.items() if k!='mesh'},n
 if n!='Mesh_FrontSight':assert a==b,n
assert L.save_current_level();(E/'sight-v12/pistol-v6-native-import.json').write_text(json.dumps({'ok':True,'pin':pin,'removed':['Mesh_RearSight_L','Mesh_RearSight_R'],'added':{'Mesh_RearSight':after['Mesh_RearSight']},'swapped':{'Mesh_FrontSight':after['Mesh_FrontSight']},'parts':len(after)},indent=2));unreal.log('PISTOL_V6_IMPORT_PASS')
