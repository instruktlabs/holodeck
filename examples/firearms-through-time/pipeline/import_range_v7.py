"""Add the reviewed v7 layout without replacing the original gameplay actors/materials."""
from pathlib import Path
import json,hashlib,shutil,traceback,os
import unreal
R=Path(__file__).resolve().parents[1];E=R/'evidence';C=R/'native/ToolchainValidation/Content'
M=json.loads((E/'range-v7-manifest.json').read_text());A=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);S=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
def put(name,data):(E/name).write_text(json.dumps(data,indent=2))
def hashfile(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def vec(v):return unreal.Vector(v[0]*100,v[2]*100,v[1]*100)
def tup(v):return list(v.to_tuple())
def near(a,b,t=.08):return all(abs(x-y)<=t for x,y in zip(a,b))
def oldfiles():return {str(p.relative_to(C)):hashfile(p) for folder in ['RangeSliceOverrides','WeaponOverrides'] for p in (C/'Qualification'/folder).rglob('*') if p.is_file()}
def oldactors():
 result=[]
 for a in S.get_all_level_actors():
  if 'RangeExpansionV7' in [str(t) for t in a.tags]:continue
  result.append({'name':a.get_path_name(),'location':tup(a.get_actor_location()),'rotation':tup(a.get_actor_rotation()),'scale':tup(a.get_actor_scale3d()),'parts':[{'name':c.get_name(),'mesh':c.static_mesh.get_path_name() if c.static_mesh else None,'materials':[c.get_material(i).get_path_name() if c.get_material(i) else None for i in range(c.get_num_materials())]} for c in a.get_components_by_class(unreal.StaticMeshComponent)]})
 return sorted(result,key=lambda a:a['name'])
result={'ok':False,'phase':'begin','imports':{},'maps':{},'oldFiles':oldfiles()}
checkpoint=E/'range-v7-native-checkpoint.json';backup=E/'range-v7-native-before'
resume=os.environ.get('RANGE_V7_RESUME')=='1'
if resume:
 assert checkpoint.exists() and backup.exists()
 result=json.loads(checkpoint.read_text());assert not result['ok'];assert not any(r.get('afterPreserved') for r in result['maps'].values()),'Resume only supported before any level saves'
 assert oldfiles()==result['oldFiles'];result.pop('error',None)
else:
 assert not checkpoint.exists() and not backup.exists(),'Prior attempt exists; inspect checkpoint before retry'
 assert not A.does_directory_exist('/Game/Qualification/RangeV7Generated')
 backup.mkdir();put('range-v7-native-checkpoint.json',result)
try:
 for mapname in M['maps']:
  assert L.load_level(mapname);assert not any('RangeExpansionV7' in [str(t) for t in a.tags] for a in S.get_all_level_actors())
  relative=mapname.removeprefix('/Game/')+'.umap';src=C/relative;dst=backup/relative
  if resume:assert hashfile(src)==hashfile(dst);assert oldactors()==result['maps'][mapname]['before']
  else:dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst);assert hashfile(src)==hashfile(dst);result['maps'][mapname]={'before':oldactors()}
 pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES;pipeline.material_pipeline.reuse_existing_materials=False
 stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
 for row in M['assets']:
  assert 'sha256:'+hashfile(R/row['nativeFile'])==row['nativeHash'];assert 'sha256:'+hashfile(R/row['glb'])==row['sha256']
  if row['id'] not in result['imports']:
   assert not A.does_directory_exist(row['nativeDestination']),'Unrecorded namespace requires inspection'
   task=unreal.AssetImportTask();task.filename=str(R/row['nativeFile']);task.destination_path=row['nativeDestination'];task.options=stack;task.automated=True;task.replace_existing=False;task.save=True;task.async_=False
   unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
  loaded=[unreal.load_asset(p) for p in A.list_assets(row['nativeDestination'],recursive=True,include_folder=False)];meshes={m.get_name():m for m in loaded if isinstance(m,unreal.StaticMesh)}
  aliases={}
  if row['id']=='paper-support' and set(meshes)=={'paper-support'} and len(row['meshes'])==1:
   key=row['meshes'][0]['key'];aliases[key]='paper-support';meshes={key:meshes['paper-support']}
  result['imports'][row['id']]={'meshes':{n:{'path':m.get_path_name(),'min':tup(m.get_bounding_box().min),'max':tup(m.get_bounding_box().max)} for n,m in meshes.items()}}
  result['imports'][row['id']]['importerNameAliases']=aliases
  result['phase']='imported-'+row['id'];put('range-v7-native-checkpoint.json',result)
  assert set(meshes)=={p['key'] for p in row['meshes']},('Importer names differ',row['id'],list(meshes))
  for p in row['meshes']:
   m=meshes[p['key']];b=m.get_bounding_box();assert near(tup(b.min),p['nativeMin']) and near(tup(b.max),p['nativeMax']),('Baked native frame differs',row['id'],p['key'],tup(b.min),tup(b.max),p)
  tex=[]
  for t in loaded:
   if isinstance(t,unreal.Texture2D):
    n=t.get_name();normal='Normal' in n;color='Albedo' in n;assert normal or color or 'ORM' in n,n
    t.srgb=color;t.flip_green_channel=False;t.compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_DEFAULT if color else unreal.TextureCompressionSettings.TC_MASKS
    t.filter=unreal.TextureFilter.TF_TRILINEAR;t.mip_gen_settings=unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE;assert A.save_loaded_asset(t,False);tex.append(t.get_path_name())
  result['imports'][row['id']]['textures']=tex
 for mapname in M['maps']:
  assert L.load_level(mapname);assert oldactors()==result['maps'][mapname]['before']
  original=next(a for a in S.get_all_level_actors() if a.get_class().get_name()=='RangeSliceActor')
  original_parts={c.get_name():c for c in original.get_components_by_class(unreal.StaticMeshComponent)}
  actor=S.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.RangeExpansionActor'),unreal.Vector());actor.tags=['RangeExpansionV7'];actor.set_actor_label('RangeExpansionV7')
  for obj in M['objects']:
   row=next(a for a in M['assets'] if a['id']==obj['asset']);prefix=obj['id'].replace('-','_')+'_';actor.add_frame(prefix+'placement','None',vec(obj['position']))
   for n in row['nodes']:actor.add_frame(prefix+n['key'],prefix+n['parent'] if n['parent'] else prefix+'placement',vec(n['localPosition']))
   for p in row['meshes']:
    name=prefix+p['key'];actor.add_piece(name,unreal.load_asset(result['imports'][row['id']]['meshes'][p['key']]['path']),prefix+p['parent'] if p['parent'] else prefix+'placement',vec([-v for v in p['parentPosition']]))
    if row.get('existing'):
     old=original_parts[('bay_' if row['id']=='collection-bay' else 'console_')+p['semantic']]
     new=next(c for c in actor.get_components_by_class(unreal.StaticMeshComponent) if c.get_name()==name)
     for i in range(old.get_num_materials()):new.set_material(i,old.get_material(i))
   col=obj['collider']
   for i,b in enumerate(col['boxes'] if col['type']=='compound' else [col]):actor.add_blocker(prefix+'block_'+str(i),vec([a+b for a,b in zip(obj['position'],b['offset'])]),vec(b['size']))
  parts=actor.get_components_by_class(unreal.StaticMeshComponent);boxes=actor.get_components_by_class(unreal.BoxComponent)
  assert len(parts)==80 and len(boxes)==37
  assert oldactors()==result['maps'][mapname]['before'];assert oldfiles()==result['oldFiles']
  assert L.save_current_level();result['maps'][mapname]['afterPreserved']=True;result['maps'][mapname]['parts']=len(parts);result['maps'][mapname]['boxes']=len(boxes)
  result['phase']='saved-'+mapname;put('range-v7-native-checkpoint.json',result)
 # Load the saved packages in this process and count actual serialized instance components.
 for mapname in M['maps']:
  assert L.load_level(mapname);actors=[a for a in S.get_all_level_actors() if 'RangeExpansionV7' in [str(t) for t in a.tags]];assert len(actors)==1
  assert len(actors[0].get_components_by_class(unreal.StaticMeshComponent))==80;assert oldactors()==result['maps'][mapname]['before']
 result.update(ok=True,phase='complete',runtimeTested=False);put('range-v7-native-result.json',result);put('range-v7-native-checkpoint.json',result);unreal.log('RANGE_V7_IMPORT_PASS')
except Exception:
 result.update(error=traceback.format_exc());put('range-v7-native-checkpoint.json',result);raise
