"""No.4 v13 (support grip v13: hands v2 and arm rig v2). BoltV11 is preserved. Import pinned No.4 bolt profile derivatives only; never save existing maps/overrides or the rifle profile."""
from pathlib import Path
import unreal,json,hashlib,struct
R=Path(__file__).resolve().parents[1];E=R/'evidence';C=R/'native/ToolchainValidation/Content/Qualification'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
manifest=json.loads((E/'bolt-v13-delivery/manifest.json').read_text());dest=manifest['destination'];assert dest=='/Game/Qualification/BoltV13'
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);tools=unreal.AssetToolsHelpers.get_asset_tools()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def protected():
 files=list(C.glob('*.umap'))
 for folder in ['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RifleV12','RifleV13','BoltV11','SightV11','RangeDressingV1Generated']:
  files.extend(p for p in (C/folder).rglob('*') if p.is_file())
 return {str(p.relative_to(C)):sha(p) for p in files}
before=protected();receipt={'ok':False,'protectedBefore':before,'imports':{},'profile':None}
(E/'bolt-v13-native-before.json').write_text(json.dumps(receipt,indent=2))
def vec(v,scale=100):return unreal.Vector(v[0]*scale,v[2]*scale,v[1]*scale)
def transform(v):return unreal.Transform(location=vec(v),rotation=unreal.Rotator(pitch=0,yaw=0,roll=0),scale=unreal.Vector(1,1,1))
def gltf(path):
 b=path.read_bytes();return json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
def setprops(o,**values):
 for k,v in values.items():o.set_editor_property(k,v)
 return o
objects={}
import math
import sys;sys.path.insert(0,str(R/'pipeline'));import ghost_ring_material_v11
def ghost_ring_material():return ghost_ring_material_v11.ensure(assets,tools)
def cue_rotation(e):
 # three.js XYZ Euler to a quaternion, then through the handedness-changing (x,y,z)->(x,z,y) swap: (qx,qy,qz,w)->(-qx,-qz,-qy,w).
 c=[math.cos(v/2) for v in e];s=[math.sin(v/2) for v in e]
 qx=s[0]*c[1]*c[2]+c[0]*s[1]*s[2];qy=c[0]*s[1]*c[2]-s[0]*c[1]*s[2];qz=c[0]*c[1]*s[2]+s[0]*s[1]*c[2];qw=c[0]*c[1]*c[2]-s[0]*s[1]*s[2]
 return unreal.Quat(-qx,-qz,-qy,qw).rotator()
for kind,row in manifest['input'].items():
 path=R/row.get('nativeFile',row['glb']);expected=row.get('nativeHash',row['sha256']).removeprefix('sha256:');assert sha(path)==expected
 target=dest+'/'+kind
 assert not assets.does_directory_exist(target),'Existing imported candidate requires explicit inspection, not duplicate import: '+target
 pipeline=unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline');pipeline.reimport_strategy=unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES;pipeline.material_pipeline.reuse_existing_materials=False
 pipeline.mesh_pipeline.set_editor_property('combine_skeletal_meshes_behavior',unreal.InterchangeCombineSkeletalMeshesBehavior.BY_SKELETON)
 stack=unreal.InterchangePipelineStackOverride();stack.add_pipeline(pipeline);stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
 task=unreal.AssetImportTask();setprops(task,filename=str(path),destination_path=target,options=stack,automated=True,replace_existing=False,save=True,async_=False);tools.import_asset_tasks([task])
 paths=sorted(assets.list_assets(target,recursive=True,include_folder=False));objects[kind]=[unreal.load_asset(p) for p in paths]
 rows=[]
 for obj in objects[kind]:
  record={'path':obj.get_path_name(),'class':obj.get_class().get_name(),'name':obj.get_name()}
  if isinstance(obj,unreal.StaticMesh):record['bounds']=[list(obj.get_bounding_box().min.to_tuple()),list(obj.get_bounding_box().max.to_tuple())]
  if isinstance(obj,unreal.AnimSequence):record['duration']=obj.get_play_length()
  if isinstance(obj,unreal.SkeletalMesh):record['bones']=[str(n) for n in obj.skeleton.get_reference_pose().get_bone_names()]
  rows.append(record)
 receipt['imports'][kind]={'sourceSha256':row['sha256'],'nativeSha256':expected,'assets':rows}
 (E/'bolt-v13-native-import-checkpoint.json').write_text(json.dumps(receipt,indent=2))
 # Reconcile this generated namespace with portable source PBR values.
 j=gltf(path);materials=[]
 for mat in j.get('materials',[]):
  matches=[o for o in objects[kind] if isinstance(o,unreal.MaterialInstanceConstant) and o.get_name()==mat['name']];assert len(matches)==1,(kind,mat['name'],[o.get_name() for o in objects[kind] if isinstance(o,unreal.MaterialInstanceConstant)])
  obj=matches[0];pbr=mat.get('pbrMetallicRoughness',{});color=pbr.get('baseColorFactor',[1,1,1,1]);scalar={'MetallicFactor':pbr.get('metallicFactor',1),'RoughnessFactor':pbr.get('roughnessFactor',1),'NormalScale':mat.get('normalTexture',{}).get('scale',1)}
  sv={str(v.parameter_info.name):v for v in obj.scalar_parameter_values}
  for name,value in scalar.items():sv[name]=unreal.ScalarParameterValue(parameter_info=unreal.MaterialParameterInfo(name=name),parameter_value=float(value))
  obj.set_editor_property('scalar_parameter_values',list(sv.values()));vv={str(v.parameter_info.name):v for v in obj.vector_parameter_values};vv['BaseColorFactor']=unreal.VectorParameterValue(parameter_info=unreal.MaterialParameterInfo(name='BaseColorFactor'),parameter_value=unreal.LinearColor(*color));obj.set_editor_property('vector_parameter_values',list(vv.values()))
  textures={};tv=[]
  for name,info in [('BaseColorTexture',pbr.get('baseColorTexture')),('MetallicRoughnessTexture',pbr.get('metallicRoughnessTexture')),('NormalTexture',mat.get('normalTexture'))]:
   if info is None:continue
   image=j['images'][j['textures'][info['index']]['source']]['name'];matches=[o for o in objects[kind] if isinstance(o,unreal.Texture2D) and o.get_name()==image];assert len(matches)==1,(kind,image);texture=matches[0]
   normal=name=='NormalTexture';data=name=='MetallicRoughnessTexture';setprops(texture,srgb=not(normal or data),flip_green_channel=False,compression_settings=unreal.TextureCompressionSettings.TC_NORMALMAP if normal else unreal.TextureCompressionSettings.TC_MASKS if data else unreal.TextureCompressionSettings.TC_DEFAULT,filter=unreal.TextureFilter.TF_TRILINEAR);assert assets.save_loaded_asset(texture,False)
   tv.append(unreal.TextureParameterValue(parameter_info=unreal.MaterialParameterInfo(name=name),parameter_value=texture));textures[name]=texture.get_path_name()
  obj.set_editor_property('texture_parameter_values',tv)
  for name in ['BaseColorTexture','MetallicRoughnessTexture','NormalTexture']:
   unreal.MaterialEditingLibrary.set_material_instance_static_switch_parameter_value(obj,'bHas'+name,name in textures);assert unreal.MaterialEditingLibrary.get_material_instance_static_switch_parameter_value(obj,'bHas'+name)==(name in textures)
  unreal.MaterialEditingLibrary.update_material_instance(obj);assert assets.save_loaded_asset(obj,False);materials.append({'path':obj.get_path_name(),'color':color,'scalar':scalar,'textures':textures})
 receipt['imports'][kind]['materials']=materials

rules=manifest['metadata']['game/bolt-no4-game-contract.json']['data'];motion=manifest['metadata']['game/bolt-no4-motion-v1.json']['data'];rig=manifest['metadata']['game/bolt-no4-arm-rig-v2.json']['data'];view=manifest['metadata']['game/bolt-no4-view-v2.json']['data']
klass=unreal.load_class(None,'/Script/ToolchainValidation.WeaponProfileData');factory=unreal.DataAssetFactory();factory.set_editor_property('data_asset_class',klass);assert not assets.does_asset_exist(dest+'/DA_BoltNo4');profile=tools.create_asset('DA_BoltNo4',dest,klass,factory);assert profile
hand=[o for o in objects['hands'] if isinstance(o,unreal.SkeletalMesh)];assert len(hand)==1;assert len(hand[0].skeleton.get_reference_pose().get_bone_names())==41
setprops(profile,profile_id=rules['profile'],collection_id=rules['id'],title=rules['title'],provenance_json=json.dumps({'pins':manifest['pins'],'metadataHashes':{p:v['sha256'] for p,v in manifest['metadata'].items()}},separators=(',',':')),rules_sha256=manifest['metadata']['game/bolt-no4-game-contract.json']['sha256'],hands=hand[0],capacity=rules['capacity'],initial_reserve=rules['reserve'],fire_duration=rules['cooldown'],reload_duration=rules['reload'],inspect_duration=rules['inspect'],reload_commit_phase=rules['reloadCommitPhase'],per_round_reload=True,rounds_per_commit=rules['roundsPerCommit'],action_kind='bolt',finish=rules['initialFinish'],allowed_slots={k:v[0] for k,v in rules['slots'].items() if len(v)==1},ready_location=unreal.Vector(-view['hipPosition'][2]*100,view['hipPosition'][0]*100,view['hipPosition'][1]*100),aim_location=unreal.Vector(-view['aimPosition'][2]*100,view['aimPosition'][0]*100,view['aimPosition'][1]*100),loading_cue_offset=vec(motion['cartridge']['rightWristRelativeCenter']),loading_cue_rotation=cue_rotation(motion['cartridge'].get('rightWristRelativeRotation',[0,0,0])),recoil_back_cm=view['recoilBack']*100,recoil_pitch_radians=view['recoilPitch'])
for side,a in rig['arms'].items():
 for name in ['shoulder','wrist','pole']:profile.set_editor_property(side+'_'+name,vec(a[name]))
 profile.set_editor_property(side+'_lower_axis',vec(a['lowerAxis'],1));profile.set_editor_property(side+'_lengths',unreal.Vector2D(a['upperLength']*100,a['forearmLength']*100))
profile.set_editor_property('twist_fractions',unreal.Vector2D(*rig['twistFractions']))
# Owner-approved sight presentation (docs/sight-research-v1.md section 8), from the derived view v2.
ring=view['ghostRing'];front=view.get('frontSight') or {}
setprops(profile,aim_fov_vertical_deg=view['aimFovDeg'],aim_near_cm=view['aimNear']*100,ghost_ring_material=ghost_ring_material(),ghost_ring_source_node=ring['node'],ghost_aperture_cm=ring['apertureDiameter']*100,ghost_pupil_cm=ring['pupil']*100,ghost_darken=ring['darken'],front_sight_min_pixels=front.get('minPixels',0),front_sight_reference_height=front.get('referenceHeightPx',1080))
parts=[];anchors=[]
MOVING={'Joint_BoltLift':'bolt_lift','Joint_BoltSlide':'bolt_slide','Joint_FrontSight':'front_sight'}
def moving(nodes,parent):
 # Nearest moving owner; its world position is the component pivot. Static pivots bake into the body frame.
 while parent:
  node=nodes[parent]
  if node['semantic'] in MOVING:return MOVING[node['semantic']],node['position']
  parent=node['parent']
 return 'body',[0,0,0]
for kind in ['gun','token']:
 row=manifest['input'][kind];nodes={n['key']:n for n in row['nodes']};meshes=[o for o in objects[kind] if isinstance(o,unreal.StaticMesh)];assert len(meshes)==len(row['meshes'])
 for n in row['nodes']:
  if kind=='gun' and n['semantic']=='Joint_BoltSlide':profile.set_editor_property('bolt_pivot',vec(n['position']))
  if kind=='gun' and n['semantic']=='Joint_FrontSight':profile.set_editor_property('front_sight_pivot',vec(n['position']))
 for n in row['nodes']:
  if kind=='gun' and n['semantic'].startswith('anchor_'):
   owner=moving(nodes,n['parent'])
   anchors.append(setprops(unreal.WeaponAnchorBinding(),name=n['semantic'],joint=owner[0],relative_transform=transform([a-b for a,b in zip(n['position'],owner[1])])))
 for source in row['meshes']:
  matches=[o for o in meshes if o.get_name()==source['key']];assert len(matches)==1,(kind,source['key']);mesh=matches[0];b=mesh.get_bounding_box();actual=list(b.min.to_tuple())+list(b.max.to_tuple());expected=source['nativeMin']+source['nativeMax'];assert max(abs(a-b) for a,b in zip(actual,expected))<.025,('Importer did not bake expected world frame',source['key'],actual,expected)
  family,pivot=('loading',[0,0,0]) if kind=='token' else moving(nodes,source['parent'])
  parts.append(setprops(unreal.WeaponPartBinding(),mesh=mesh,joint=family,source_node=source['semantic'],relative_transform=transform([-x for x in pivot])))
profile.set_editor_property('parts',parts);profile.set_editor_property('anchors',anchors)
clips=[]
for name,clip in motion['clips'].items():
 matches=[o for o in objects['hands'] if isinstance(o,unreal.AnimSequence) and o.get_name().endswith(name)];assert len(matches)==1,(name,[o.get_name() for o in objects['hands'] if isinstance(o,unreal.AnimSequence)]);sequence=matches[0];assert abs(sequence.get_play_length()-clip['duration'])<.035
 keys=[]
 for key in clip['keys']:
  d=dict(zip(motion['channels'],key['v']));keys.append(setprops(unreal.WeaponMotionKey(),t=key['t'],root_translation=vec([d['forward'],d['lift'],d['side']]),root_rotation=unreal.Rotator(pitch=d['pitch']*180/3.141592653589793,yaw=-d['yaw']*180/3.141592653589793,roll=d['roll']*180/3.141592653589793),left_offset=vec([d['handX'],d['handY'],d['handZ']]),right_offset=vec([d['rightHandX'],d['rightHandY'],d['rightHandZ']]),lever=0,hammer=0,bolt_lift=d['boltLift'],bolt_slide=d['boltSlide']*100,cartridge=d['cartridge']))
 clips.append(setprops(unreal.WeaponClipBinding(),name=name,sequence=sequence,duration=clip['duration'],keys=keys))
profile.set_editor_property('clips',clips);assert assets.save_loaded_asset(profile,False);assert protected()==before,'Existing map/pistol/native override bytes changed'
receipt.update(ok=True,profile=profile.get_path_name(),parts=len(parts),anchors=len(anchors),protectedUnchanged=True,files={str(p.relative_to(C)):sha(p) for p in (C/'BoltV13').rglob('*') if p.is_file()});(E/'bolt-v13-native-import.json').write_text(json.dumps(receipt,indent=2));unreal.log('BOLT_V13_IMPORT_PASS')
