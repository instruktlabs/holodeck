"""Staged facility geometry swap. Default read-only. Execute only through the serialized v5 wrapper.

Separate native namespace avoids reimporting shared baseline meshes/materials.
The same component objects, local frames, collision and effective material interfaces remain.
No runtime interactions are invoked here; run the existing 14-check fixture afterward.
"""
import os,json,hashlib,shutil,traceback
from pathlib import Path
import unreal

ROOT=Path(__file__).resolve().parents[1];E=ROOT/'evidence'
MODE=os.environ.get('FACILITY_V5_NATIVE_MODE','readonly')
assert MODE in ('readonly','apply','verify')
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
M=json.loads((E/'v5-facility-integration-manifest.json').read_text(encoding='utf-8-sig'))
A=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
AS=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
CONTENT=ROOT/'native/ToolchainValidation/Content'
BACKUP=E/'v5-facility-native-before'
RESULT=E/'v5-facility-native-result.json'
CHECKPOINT=E/'v5-facility-native-checkpoint.json'

def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def put(p,v):p.write_text(json.dumps(v,indent=2),encoding='utf-8')
def tup(v):return [float(x) for x in v.to_tuple()]
def material_path(m):return m.get_path_name() if m else None
def transform(c):return {'location':tup(c.relative_location),'rotation':tup(c.relative_rotation),'scale':tup(c.relative_scale3d),'parent':c.get_attach_parent().get_path_name() if c.get_attach_parent() else None}
def actor_record(a):return {'name':a.get_path_name(),'class':a.get_class().get_name(),'location':tup(a.get_actor_location()),'rotation':tup(a.get_actor_rotation()),'scale':tup(a.get_actor_scale3d()),'tags':sorted(str(x) for x in a.tags)}
def controller():
 matches=[a for a in AS.get_all_level_actors() if a.get_class().get_name()=='RangeSliceActor']
 assert len(matches)==1,'Expected exactly one existing RangeSliceActor'
 return matches[0]
def snapshot():
 actor=controller();parts=sorted(actor.get_components_by_class(unreal.StaticMeshComponent),key=lambda c:c.get_name())
 assert len(parts)==M['expectedComponentCount']
 boxes=sorted(actor.get_components_by_class(unreal.BoxComponent),key=lambda c:c.get_name())
 assert len(boxes)==M['expectedBlockerCount']
 return {'actor':actor_record(actor),'others':sorted([actor_record(a) for a in AS.get_all_level_actors() if a!=actor],key=lambda a:a['name']),
  'parts':[{'name':c.get_name(),'mesh':c.static_mesh.get_path_name(),'meshName':c.static_mesh.get_name(),'frame':transform(c),'materials':[material_path(c.get_material(i)) for i in range(c.get_num_materials())],'collision':str(c.get_collision_enabled()),'mobility':str(c.mobility),'min':tup(c.static_mesh.get_bounding_box().min),'max':tup(c.static_mesh.get_bounding_box().max)} for c in parts],
  'frames':sorted([{'name':c.get_name(),'frame':transform(c)} for c in actor.get_components_by_class(unreal.SceneComponent) if not isinstance(c,unreal.StaticMeshComponent)],key=lambda c:c['name']),
  'blockers':[{'name':c.get_name(),'frame':transform(c),'extent':tup(c.get_unscaled_box_extent()),'collision':str(c.get_collision_enabled())} for c in boxes]}
def invariant(s):
 d=json.loads(json.dumps(s))
 for p in d['parts']:
  for k in ['mesh','min','max']:p.pop(k)
 return d
def preserved_files():
 # Retain all old derivatives and all authored overrides byte-for-byte. They remain material dependencies.
 files={}
 for folder in ['Qualification/RangeSliceGenerated','Qualification/RangeSliceOverrides']:
  for p in (CONTENT/folder).rglob('*'):
   if p.is_file():files[str(p.relative_to(CONTENT))]=digest(p)
 return files
def source_checks():
 for row in M['assets']:
  assert 'sha256:'+digest(ROOT/row['glb'])==row['sha256']
  assert 'sha256:'+digest(ROOT/row['source'])==row['sourceSha256']
def near(a,b):return len(a)==len(b) and all(abs(x-y)<=M['boundsToleranceCm'] for x,y in zip(a,b))
def qualify_mesh(mesh,expected):
 assert len(mesh.static_materials)==1,'A role mesh must retain one slot'
 b=mesh.get_bounding_box()
 assert near(tup(b.min),expected['nativeMinCm']) and near(tup(b.max),expected['nativeMaxCm']),('Unexpected Interchange frame; do not guess pivot compensation',mesh.get_path_name(),tup(b.min),tup(b.max),expected)
def load_maps():
 states={}
 for name in M['maps']:
  assert A.does_asset_exist(name),name
  assert L.load_level(name)
  states[name]=snapshot()
  for joint,pos in M['expectedJoints'].items():
   f=next(x for x in states[name]['frames'] if x['name']==joint)
   assert near(f['frame']['location'],pos),'Unexpected current joint frame'
 return states

source_checks()
if MODE=='readonly':
 states=load_maps();put(E/'v5-facility-native-readonly.json',{'ok':True,'mode':MODE,'maps':states,'oldFiles':preserved_files(),'newNamespaceExists':A.does_directory_exist(M['generatedRoot']),'mutation':False})
 unreal.log('FACILITY_V5_READONLY_PASS')
elif MODE=='verify':
 result=json.loads(RESULT.read_text());assert result['ok']
 assert preserved_files()==result['oldFiles'],'Old generated materials or authored overrides changed'
 states=load_maps();assert states==result['after'],'Fresh disk state differs from saved update receipt'
 for row in M['assets']:
  for expected in row['meshes']:
   mesh=unreal.load_asset(result['meshMapping'][row['id']][expected['name']]);assert isinstance(mesh,unreal.StaticMesh);qualify_mesh(mesh,expected)
 put(E/'v5-facility-native-fresh-readback.json',{'ok':True,'maps':list(states),'componentsPerMap':23,'sourceRevisions':{r['id']:r['revisionId'] for r in M['assets']},'checks':['exact_saved_snapshot','all_imported_bounds_and_material_slots','old_derivative_and_override_bytes_unchanged'],'runtimeInteractionTested':False})
 unreal.log('FACILITY_V5_FRESH_READBACK_PASS')
else:
 assert not BACKUP.exists() and not RESULT.exists() and not CHECKPOINT.exists(),'Prior attempt exists; inspect checkpoints and fresh-readback before any retry'
 assert not A.does_directory_exist(M['generatedRoot']),'New namespace exists; inspect previous import rather than overwrite'
 before=load_maps();oldfiles=preserved_files();BACKUP.mkdir()
 for name in M['maps']:
  relative=name.removeprefix('/Game/')+'.umap';src=CONTENT/relative;dst=BACKUP/relative;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst);assert digest(src)==digest(dst)
 for folder in ['Qualification/RangeSliceOverrides']:
  shutil.copytree(CONTENT/folder,BACKUP/folder)
 put(E/'v5-facility-native-before.json',{'maps':before,'oldFiles':oldfiles,'manifest':M})
 progress={'phase':'checkpointed-before-import','mapsSaved':[],'meshMapping':{},'ok':False};put(CHECKPOINT,progress)
 try:
  pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline')
  # Configure in-memory only; never save engine pipeline assets.
  pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES
  pipeline.material_pipeline.reuse_existing_materials=False
  stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
  meshMapping={}
  for row in M['assets']:
   task=unreal.AssetImportTask();task.filename=str(ROOT/row['glb']);task.destination_path=row['nativeDestination'];task.options=stack;task.automated=True;task.replace_existing=False;task.save=True;task.async_=False
   unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
   objects=[unreal.load_asset(p) for p in A.list_assets(row['nativeDestination'],recursive=True,include_folder=False)]
   meshes=[o for o in objects if isinstance(o,unreal.StaticMesh)]
   byName={o.get_name():o for o in meshes}
   assert len(byName)==len(meshes)==len(row['meshes'])
   assert set(byName)=={m['name'] for m in row['meshes']},'Importer renamed semantic meshes; stop before binding. Review an explicit name map.'
   for expected in row['meshes']:qualify_mesh(byName[expected['name']],expected)
   textures=[o for o in objects if isinstance(o,unreal.Texture2D)]
   assert len(textures)==(0 if row['id']=='target-module' else 3)
   # New derivatives use the established profile, but actor slots retain old effective materials.
   for t in textures:
    name=t.get_name();normal='Normal' in name;color='Albedo' in name
    assert normal or color or 'ORM' in name,'Unexpected texture identity requires mapping review'
    t.srgb=color;t.flip_green_channel=False;t.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_DEFAULT if color else unreal.TextureCompressionSettings.TC_MASKS
    t.filter=unreal.TextureFilter.TF_TRILINEAR;t.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert A.save_loaded_asset(t,False)
   meshMapping[row['id']]={n:o.get_path_name() for n,o in byName.items()}
   progress.update(phase='imported-and-qualified-'+row['id'],meshMapping=meshMapping);put(CHECKPOINT,progress)
  after={}
  for mapname in M['maps']:
   assert L.load_level(mapname);assert snapshot()==before[mapname],'Map changed after checkpoint'
   actor=controller()
   for c in actor.get_components_by_class(unreal.StaticMeshComponent):
    row=next((r for r in M['assets'] if c.get_name().startswith(r['module']+'_')),None);assert row,'Unexpected component outside facility trio'
    semantic=c.static_mesh.get_name();assert semantic in meshMapping[row['id']]
    savedMats=[c.get_material(i) for i in range(c.get_num_materials())]
    assert c.set_static_mesh(unreal.load_asset(meshMapping[row['id']][semantic]))
    for i,mat in enumerate(savedMats):c.set_material(i,mat)
   state=snapshot();assert invariant(state)==invariant(before[mapname]),'Component frame, parent, material, collision, actor or unrelated actor changed'
   assert preserved_files()==oldfiles,'Old generated or authored materials changed'
   assert L.save_current_level();after[mapname]=snapshot();progress['mapsSaved'].append(mapname);progress.update(phase='map-saved-'+mapname,after=after);put(CHECKPOINT,progress)
  assert preserved_files()==oldfiles
  result={'ok':True,'maps':M['maps'],'sourceRevisions':{r['id']:r['revisionId'] for r in M['assets']},'meshMapping':meshMapping,'before':before,'after':after,'oldFiles':oldfiles,'checks':['23_existing_components_per_map','same_named_actors_and_components','same_joint_frames_and_compensation','same_collision_and_blockers','same_material_interfaces','unrelated_actor_transforms_and_tags_unchanged','old_generated_and_override_files_identical','new_mesh_bounds_match_exact_glb'],'runtimeInteractionTested':False,'requiresFreshReadback':True}
  put(RESULT,result);progress.update(phase='all-maps-saved',ok=True);put(CHECKPOINT,progress);unreal.log('FACILITY_V5_NATIVE_SWAP_PASS')
 except Exception:
  progress.update(phase='failed-checkpoint-retained',error=traceback.format_exc());put(CHECKPOINT,progress);raise
