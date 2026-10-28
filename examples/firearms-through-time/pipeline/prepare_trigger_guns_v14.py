"""Round v14 held-trigger guns (Colt M4 now; the Pattern 1742 joins once delivered). Import one profile's pinned derivatives into its own
folder and build its data asset; every other Qualification file keeps its bytes. Set TRIGGER_PROFILE (carbineM4) before the editor runs."""
from pathlib import Path
import unreal,json,hashlib,struct,math,os,sys
R=Path(__file__).resolve().parents[1];E=R/'evidence';C=R/'native/ToolchainValidation/Content/Qualification'
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
PLANS={'carbineM4':{'dir':'carbine-v14-delivery','folder':'CarbineV14','asset':'DA_CarbineM4','label':'carbine-v14','kind':'carbine','moving':{'Joint_Magazine':'magazine','Joint_ChargingHandle':'charging_handle','Joint_FrontSight':'front_sight'}}}
profile_id=os.environ.get('TRIGGER_PROFILE');assert profile_id in PLANS,profile_id;plan=PLANS[profile_id]
manifest=json.loads((E/plan['dir']/'manifest.json').read_text());dest=manifest['destination'];assert dest=='/Game/Qualification/'+plan['folder'] and manifest['profile']==profile_id
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);tools=unreal.AssetToolsHelpers.get_asset_tools()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def protected():return {str(p.relative_to(C)):sha(p) for p in C.rglob('*') if p.is_file() and not p.is_relative_to(C/plan['folder'])}
before=protected();receipt={'ok':False,'profile':profile_id,'protectedFiles':len(before),'imports':{},'dataAsset':None}
(E/(plan['label']+'-native-before.json')).write_text(json.dumps({'protectedBefore':before},indent=2))
def vec(v,scale=100):return unreal.Vector(v[0]*scale,v[2]*scale,v[1]*scale)
def transform(v):return unreal.Transform(location=vec(v),rotation=unreal.Rotator(pitch=0,yaw=0,roll=0),scale=unreal.Vector(1,1,1))
def gltf(path):
 b=path.read_bytes();return json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
def setprops(o,**values):
 for k,v in values.items():o.set_editor_property(k,v)
 return o
sys.path.insert(0,str(R/'pipeline'));import ghost_ring_material_v11
def cue_rotation(e):
 # three.js XYZ Euler to a quaternion, then through the handedness-changing (x,y,z)->(x,z,y) swap: (qx,qy,qz,w)->(-qx,-qz,-qy,w).
 c=[math.cos(v/2) for v in e];s=[math.sin(v/2) for v in e]
 qx=s[0]*c[1]*c[2]+c[0]*s[1]*s[2];qy=c[0]*s[1]*c[2]-s[0]*c[1]*s[2];qz=c[0]*c[1]*s[2]+s[0]*s[1]*c[2];qw=c[0]*c[1]*c[2]-s[0]*s[1]*s[2]
 return unreal.Quat(-qx,-qz,-qy,qw).rotator()
objects={}
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
 (E/(plan['label']+'-native-import-checkpoint.json')).write_text(json.dumps(receipt,indent=2))
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

roles={role:manifest['metadata'][file] for role,file in manifest['roles'].items()};rules=roles['rules']['data'];motion=roles['motion']['data'];rig=roles['rig']['data'];view=roles['view']['data']
klass=unreal.load_class(None,'/Script/ToolchainValidation.WeaponProfileData');factory=unreal.DataAssetFactory();factory.set_editor_property('data_asset_class',klass);assert not assets.does_asset_exist(dest+'/'+plan['asset']);profile=tools.create_asset(plan['asset'],dest,klass,factory);assert profile
hand=[o for o in objects['hands'] if isinstance(o,unreal.SkeletalMesh)];assert len(hand)==1;assert len(hand[0].skeleton.get_reference_pose().get_bone_names())==41
# Held-trigger guns take their rules from the generated trigger data at runtime; the asset carries what Validate and the presentation read.
setprops(profile,profile_id=rules['profile'],collection_id=rules['id'],title=rules['title'],provenance_json=json.dumps({'pins':manifest['pins'],'metadataHashes':{p:v['sha256'] for p,v in manifest['metadata'].items()}},separators=(',',':')),rules_sha256=roles['rules']['sha256'],hands=hand[0],capacity=rules['capacity'],initial_reserve=rules['reserve'],fire_duration=motion['clips']['Fire']['duration'],reload_duration=rules['reload'],inspect_duration=rules['inspect'],reload_commit_phase=rules['reloadCommitPhase'],per_round_reload=rules['reloadPolicy']!='magazine-swap',rounds_per_commit=rules.get('roundsPerCommit') or rules['capacity'],action_kind=plan['kind'],finish=rules.get('initialFinish') or '',allowed_slots={k:v[0] for k,v in rules['slots'].items() if len(v)==1},ready_location=unreal.Vector(-view['hipPosition'][2]*100,view['hipPosition'][0]*100,view['hipPosition'][1]*100),aim_location=unreal.Vector(-view['aimPosition'][2]*100,view['aimPosition'][0]*100,view['aimPosition'][1]*100),recoil_back_cm=view['recoilBack']*100,recoil_pitch_radians=view['recoilPitch'])
for side,a in rig['arms'].items():
 for name in ['shoulder','wrist','pole']:profile.set_editor_property(side+'_'+name,vec(a[name]))
 profile.set_editor_property(side+'_lower_axis',vec(a['lowerAxis'],1));profile.set_editor_property(side+'_lengths',unreal.Vector2D(a['upperLength']*100,a['forearmLength']*100))
profile.set_editor_property('twist_fractions',unreal.Vector2D(*rig['twistFractions']))
gun=manifest['input']['gun'];nodes={n['key']:n for n in gun['nodes']};semantic={n['semantic']:n for n in gun['nodes']}
def owner(parent,names):
 # Nearest listed ancestor; its world position is the component pivot. Static pivots bake into the body frame.
 while parent:
  node=nodes[parent]
  if node['semantic'] in names:return names[node['semantic']],node['position']
  parent=node['parent']
 return 'body',[0,0,0]
# Owner-approved sight presentation (docs/sight-research-v1.md section 8), from the derived view. The ghost ring fades the meshes under its node.
ring=view['ghostRing'];front=view.get('frontSight') or {};ring_meshes=[m['semantic'] for m in gun['meshes'] if owner(m['parent'],{ring['node']:'ring'})[0]=='ring'];assert len(ring_meshes)==1,ring_meshes
setprops(profile,aim_fov_vertical_deg=view['aimFovDeg'],aim_near_cm=view['aimNear']*100,ghost_ring_material=ghost_ring_material_v11.ensure(assets,tools),ghost_ring_source_node=ring_meshes[0],ghost_aperture_cm=ring['apertureDiameter']*100,ghost_pupil_cm=ring['pupil']*100,ghost_darken=ring['darken'],front_sight_min_pixels=front.get('minPixels',0),front_sight_reference_height=front.get('referenceHeightPx',1080),front_sight_pivot=vec(semantic['Joint_FrontSight']['position']))
cue_meshes=[]
if plan['kind']=='carbine':
 # The magazine drops along its well axis and the charging handle slides along its own; the fresh magazine on the left wrist is the loading cue.
 mag=motion['magazine'];cue=motion['magazineCue'];handle=motion['chargingHandle']
 setprops(profile,magazine_pivot=vec(semantic[mag['node']]['position']),magazine_drop_axis=vec(mag['dropAxis'],1),magazine_drop_cm=mag['dropMetres']*100,charging_handle_pivot=vec(semantic[handle['node']]['position']),charging_handle_axis=vec(handle['axis'],1),charging_handle_travel_cm=handle['travelMetres']*100,loading_cue_bone=cue['parent'],loading_cue_offset=vec(cue['leftWristRelativeCenter']),loading_cue_rotation=cue_rotation(cue['leftWristRelativeRotation']))
 cue_meshes=[m['key'] for m in gun['meshes'] if owner(m['parent'],{mag['node']:'cue'})[0]=='cue'];assert cue_meshes
parts=[];anchors=[]
for n in gun['nodes']:
 if n['semantic'].startswith('anchor_'):
  family,pivot=owner(n['parent'],plan['moving'])
  anchors.append(setprops(unreal.WeaponAnchorBinding(),name=n['semantic'],joint=family,relative_transform=transform([a-b for a,b in zip(n['position'],pivot)])))
meshes=[o for o in objects['gun'] if isinstance(o,unreal.StaticMesh)];assert len(meshes)==len(gun['meshes'])
for source in gun['meshes']:
 matches=[o for o in meshes if o.get_name()==source['key']];assert len(matches)==1,source['key'];mesh=matches[0];b=mesh.get_bounding_box();actual=list(b.min.to_tuple())+list(b.max.to_tuple());expected=source['nativeMin']+source['nativeMax'];assert max(abs(a-b) for a,b in zip(actual,expected))<.025,('Importer did not bake expected world frame',source['key'],actual,expected)
 family,pivot=owner(source['parent'],plan['moving'])
 parts.append(setprops(unreal.WeaponPartBinding(),mesh=mesh,joint=family,source_node=source['semantic'],relative_transform=transform([-x for x in pivot])))
 # The same meshes again under the loading cue, about the magazine's own origin, as the browser copies the magazine node.
 if source['key'] in cue_meshes:parts.append(setprops(unreal.WeaponPartBinding(),mesh=mesh,joint='loading',source_node='Cue_'+source['semantic'],relative_transform=transform([-x for x in pivot])))
profile.set_editor_property('parts',parts);profile.set_editor_property('anchors',anchors)
clips=[]
for name,clip in motion['clips'].items():
 matches=[o for o in objects['hands'] if isinstance(o,unreal.AnimSequence) and o.get_name().endswith(name)];assert len(matches)==1,(name,[o.get_name() for o in objects['hands'] if isinstance(o,unreal.AnimSequence)]);sequence=matches[0];assert abs(sequence.get_play_length()-clip['duration'])<.035
 keys=[]
 for key in clip['keys']:
  d=dict(zip(motion['channels'],key['v']));g=lambda k:d.get(k,0)
  keys.append(setprops(unreal.WeaponMotionKey(),t=key['t'],root_translation=vec([d['forward'],d['lift'],d['side']]),root_rotation=unreal.Rotator(pitch=d['pitch']*180/math.pi,yaw=-d['yaw']*180/math.pi,roll=d['roll']*180/math.pi),left_offset=vec([d['handX'],d['handY'],d['handZ']]),right_offset=vec([d['rightHandX'],d['rightHandY'],d['rightHandZ']]),lever=0,hammer=0,bolt_lift=0,bolt_slide=0,cartridge=g('magCue') if plan['kind']=='carbine' else g('cartridge'),mag_out=g('magOut'),charging_handle=g('chargingHandle')))
 clips.append(setprops(unreal.WeaponClipBinding(),name=name,sequence=sequence,duration=clip['duration'],keys=keys))
profile.set_editor_property('clips',clips);assert assets.save_loaded_asset(profile,False);assert protected()==before,'Existing Qualification bytes changed'
receipt.update(ok=True,dataAsset=profile.get_path_name(),parts=len(parts),cueParts=len(cue_meshes),anchors=len(anchors),ringNode=ring_meshes[0],protectedUnchanged=True,files={str(p.relative_to(C)):sha(p) for p in (C/plan['folder']).rglob('*') if p.is_file()})
(E/(plan['label']+'-native-import.json')).write_text(json.dumps(receipt,indent=2));unreal.log('TRIGGER_V14_IMPORT_PASS '+profile_id)
