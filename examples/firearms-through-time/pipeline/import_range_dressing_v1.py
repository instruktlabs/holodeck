"""Add the reviewed range-dressing-v1 service station to WeaponLab only; existing actors, maps and generated assets stay byte-identical."""
from pathlib import Path
import json,hashlib,shutil,math,traceback
import unreal
R=Path(__file__).resolve().parents[1];E=R/'evidence';C=R/'native/ToolchainValidation/Content'
M=json.loads((E/'range-dressing-v1-manifest.json').read_text());TAG='RangeDressingV1';MAP='/Game/Qualification/WeaponLab';DEST='/Game/Qualification/RangeDressingV1Generated'
A=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);S=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
assert M['maps']==[MAP]
def put(name,data):(E/name).write_text(json.dumps(data,indent=2))
def hashfile(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def vec(v):return unreal.Vector(v[0]*100,v[2]*100,v[1]*100)
def tup(v):return [round(x,4) for x in v.to_tuple()]
def near(a,b,t=.08):return all(abs(x-y)<=t for x,y in zip(a,b))
Q=C/'Qualification'
def oldfiles():return {str(p.relative_to(C)):hashfile(p) for p in Q.rglob('*') if p.is_file() and p.name!='WeaponLab.umap' and 'RangeDressingV1Generated' not in p.parts}
def oldactors():
 result=[]
 for a in S.get_all_level_actors():
  if TAG in [str(t) for t in a.tags]:continue
  result.append({'name':a.get_path_name(),'class':a.get_class().get_name(),'location':tup(a.get_actor_location()),'rotation':tup(a.get_actor_rotation()),'scale':tup(a.get_actor_scale3d()),'components':len(a.get_components_by_class(unreal.ActorComponent))})
 return sorted(result,key=lambda a:a['name'])
checkpoint=E/'range-dressing-v1-native-checkpoint.json';backup=E/'range-dressing-v1-native-before'
assert not checkpoint.exists() and not backup.exists(),'Prior attempt exists; inspect checkpoint before retry'
assert not A.does_directory_exist(DEST)
result={'ok':False,'phase':'begin','imports':{},'oldFiles':oldfiles()};backup.mkdir();put(checkpoint.name,result)
try:
 assert L.load_level(MAP);assert not any(TAG in [str(t) for t in a.tags] for a in S.get_all_level_actors())
 src=Q/'WeaponLab.umap';dst=backup/'WeaponLab.umap';shutil.copy2(src,dst);assert hashfile(src)==hashfile(dst)
 result['mapBefore']={'sha256':hashfile(src),'actors':oldactors()};result['phase']='backed-up';put(checkpoint.name,result)
 pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES;pipeline.material_pipeline.reuse_existing_materials=False
 stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
 meshes_by_asset={}
 for row in M['assets']:
  assert 'sha256:'+hashfile(R/row['nativeFile'])==row['nativeHash'];assert 'sha256:'+hashfile(R/row['glb'])==row['sha256'];assert row['nativeDestination']==DEST+'/'+row['id']
  task=unreal.AssetImportTask();task.filename=str(R/row['nativeFile']);task.destination_path=row['nativeDestination'];task.options=stack;task.automated=True;task.replace_existing=False;task.save=True;task.async_=False
  unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
  loaded=[unreal.load_asset(p) for p in A.list_assets(row['nativeDestination'],recursive=True,include_folder=False)];meshes={m.get_name():m for m in loaded if isinstance(m,unreal.StaticMesh)}
  assert set(meshes)=={p['key'] for p in row['meshes']},('Importer names differ',row['id'],list(meshes))
  for p in row['meshes']:
   b=meshes[p['key']].get_bounding_box();assert near(tup(b.min),p['nativeMin']) and near(tup(b.max),p['nativeMax']),('Baked native frame differs',row['id'],p['key'],tup(b.min),tup(b.max))
  tex=[]
  for t in loaded:
   if isinstance(t,unreal.Texture2D):
    n=t.get_name().lower();normal='normal' in n;color='base' in n or 'color' in n;packed='metallic' in n or 'roughness' in n;assert [normal,color,packed].count(True)==1,t.get_name()
    t.srgb=color;t.flip_green_channel=False;t.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_DEFAULT if color else unreal.TextureCompressionSettings.TC_MASKS
    t.filter=unreal.TextureFilter.TF_TRILINEAR;t.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert A.save_loaded_asset(t,False);tex.append(t.get_path_name())
  meshes_by_asset[row['id']]=meshes;result['imports'][row['id']]={'meshes':{n:m.get_path_name() for n,m in meshes.items()},'textures':tex};result['phase']='imported-'+row['id'];put(checkpoint.name,result)
 assert oldactors()==result['mapBefore']['actors']
 cls=unreal.load_class(None,'/Script/ToolchainValidation.RangeExpansionActor');placed=[]
 for obj in M['objects']:
  row=next(a for a in M['assets'] if a['id']==obj['asset']);prefix=obj['id'].replace('-','_')+'_'
  # glTF (x,y,z) -> Unreal (x,z,y) mirrors handedness, so a Holodeck Y rotation becomes the negated Unreal yaw.
  yaw=-math.degrees(obj['rotation'][1]);assert obj['rotation'][0]==0 and obj['rotation'][2]==0
  actor=S.spawn_actor_from_class(cls,vec(obj['position']),unreal.Rotator(roll=0,pitch=0,yaw=yaw));actor.tags=[TAG];actor.set_actor_label('RangeDressingV1_'+obj['id'])
  actor.add_frame(prefix+'placement','None',unreal.Vector(0,0,0))
  for n in row['nodes']:actor.add_frame(prefix+n['key'],prefix+n['parent'] if n['parent'] else prefix+'placement',vec(n['localPosition']))
  for p in row['meshes']:actor.add_piece(prefix+p['key'],meshes_by_asset[row['id']][p['key']],prefix+p['parent'] if p['parent'] else prefix+'placement',vec([-v for v in p['parentPosition']]))
  col=obj['collider']
  if col:
   for i,b in enumerate(col['boxes'] if col['type']=='compound' else [col]):actor.add_blocker(prefix+'block_'+str(i),vec(b['offset']),vec(b['size']))
  placed.append({'id':obj['id'],'location':tup(actor.get_actor_location()),'yaw':round(actor.get_actor_rotation().yaw,4),'parts':len(actor.get_components_by_class(unreal.StaticMeshComponent)),'blockers':len(actor.get_components_by_class(unreal.BoxComponent))})
 assert sum(p['parts'] for p in placed)==19 and sum(p['blockers'] for p in placed)==6,placed
 assert oldactors()==result['mapBefore']['actors'];assert L.save_current_level();result['placed']=placed;result['phase']='saved';put(checkpoint.name,result)
 assert L.load_level(MAP);actors=[a for a in S.get_all_level_actors() if TAG in [str(t) for t in a.tags]]
 assert len(actors)==4 and sum(len(a.get_components_by_class(unreal.StaticMeshComponent)) for a in actors)==19 and sum(len(a.get_components_by_class(unreal.BoxComponent)) for a in actors)==6
 assert oldactors()==result['mapBefore']['actors'];assert oldfiles()==result['oldFiles'],'Existing qualification assets changed'
 result.update(ok=True,phase='complete',mapAfterSha256=hashfile(Q/'WeaponLab.umap'),generatedFiles={str(p.relative_to(C)):hashfile(p) for p in (Q/'RangeDressingV1Generated').rglob('*') if p.is_file()},oldFilesCount=len(result['oldFiles']))
 result.pop('oldFiles');put('range-dressing-v1-native-result.json',result);put(checkpoint.name,{'ok':True,'phase':'complete'});unreal.log('RANGE_DRESSING_V1_IMPORT_PASS')
except Exception:
 result['error']=traceback.format_exc();put(checkpoint.name,result);raise
