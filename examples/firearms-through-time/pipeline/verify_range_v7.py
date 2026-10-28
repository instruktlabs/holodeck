"""Fresh-process, read-only package qualification plus reversible in-memory rig probes."""
from pathlib import Path
import json,hashlib
import unreal
R=Path(__file__).resolve().parents[1];E=R/'evidence';C=R/'native/ToolchainValidation/Content'
M=json.loads((E/'range-v7-manifest.json').read_text());receipt=json.loads((E/'range-v7-native-result.json').read_text());assert receipt['ok']
L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);S=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
def v(a):return [a[0]*100,a[2]*100,a[1]*100]
def near(a,b):return all(abs(x-y)<.08 for x,y in zip(a,b))
def tup(a):return list(a.to_tuple())
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
maps={}
for mapname in M['maps']:
 path=C/(mapname.removeprefix('/Game/')+'.umap');before=digest(path);assert L.load_level(mapname)
 sky=[a for a in S.get_all_level_actors() if isinstance(a,unreal.StaticMeshActor) and a.static_mesh_component.static_mesh and a.static_mesh_component.static_mesh.get_path_name()=='/Engine/BasicShapes/Sphere.Sphere' and list(a.get_actor_scale3d().to_tuple())==[1000,1000,1000]]
 assert len(sky)==1 and not sky[0].get_actor_enable_collision()
 assert str(sky[0].static_mesh_component.get_collision_profile_name())=='NoCollision'
 assert sky[0].static_mesh_component.get_collision_enabled()==unreal.CollisionEnabled.NO_COLLISION
 directional=[a for a in S.get_all_level_actors() if isinstance(a,unreal.DirectionalLight)]
 assert len(directional)==1 and directional[0].light_component.mobility==unreal.ComponentMobility.MOVABLE
 actor=next(a for a in S.get_all_level_actors() if 'RangeExpansionV7' in [str(t) for t in a.tags]);components={c.get_name():c for c in actor.get_components_by_class(unreal.SceneComponent)}
 frame_count=0;mesh_count=0
 for obj in M['objects']:
  row=next(a for a in M['assets'] if a['id']==obj['asset']);prefix=obj['id'].replace('-','_')+'_'
  placement=components[prefix+'placement'];assert near(tup(placement.relative_location),v(obj['position']));assert placement.get_attach_parent()==actor.root_component
  for n in row['nodes']:
   c=components[prefix+n['key']];parent=components[prefix+n['parent']] if n['parent'] else placement
   assert c.get_attach_parent()==parent;assert near(tup(c.relative_location),v(n['localPosition']));assert near(tup(c.get_world_location()),v([a+b for a,b in zip(obj['position'],n['position'])]));frame_count+=1
  for p in row['meshes']:
   c=components[prefix+p['key']];parent=components[prefix+p['parent']] if p['parent'] else placement
   assert c.get_attach_parent()==parent;assert near(tup(c.relative_location),v([-x for x in p['parentPosition']]));assert near(tup(c.get_world_location()),v(obj['position']));assert c.static_mesh.get_path_name()==receipt['imports'][row['id']]['meshes'][p['key']]['path'];mesh_count+=1
 def find(suffix):
  found=[c for n,c in components.items() if n.endswith(suffix)];assert len(found)==1,(suffix,len(found));return found[0]
 carrier=find('pivot_carrier');sheet=find('anchor_sheet_front');dock=find('anchor_dock_pose');paper=find('Mesh_Paper_Sheet');base=tup(carrier.relative_location);anchor0=tup(sheet.get_world_location());mesh0=tup(paper.get_world_location());dock0=tup(dock.get_world_location())
 carrier.set_relative_location(unreal.Vector(base[0]+37,base[1],base[2]),False,False)
 assert near(tup(sheet.get_world_location()),[anchor0[0]+37,anchor0[1],anchor0[2]]);assert near(tup(paper.get_world_location()),[mesh0[0]+37,mesh0[1],mesh0[2]]);assert near(tup(dock.get_world_location()),dock0)
 carrier.set_relative_location(unreal.Vector(*base),False,False)
 pivot=find('pivot_plate_01');face=find('anchor_plate_01_face');face2=find('anchor_plate_02_face');plate=find('Mesh_Plate_Face_01');a0=tup(face.get_world_location());b0=tup(face2.get_world_location());p0=tup(plate.get_world_location());rotation={k:float(getattr(pivot.relative_rotation,k)) for k in ['pitch','yaw','roll']}
 pivot.set_relative_rotation(unreal.Rotator(pitch=20,yaw=0,roll=0),False,False)
 assert not near(tup(face.get_world_location()),a0);assert not near(tup(plate.get_world_location()),p0);assert near(tup(face2.get_world_location()),b0)
 pivot.set_relative_rotation(unreal.Rotator(**rotation),False,False);assert near(tup(face.get_world_location()),a0),(rotation,tup(face.get_world_location()),a0);assert near(tup(sheet.get_world_location()),anchor0)
 # Rig probes are reverted and intentionally never saved.
 assert digest(path)==before
 maps[mapname]={'frames':frame_count,'meshes':mesh_count,'checks':['all saved parents and transforms','baked-mesh compensation','carrier moves sheet and mesh but not dock','one plate moves mesh and face anchor but not neighbor','poses restored; map bytes unchanged','studio sky NoCollision profile and disabled actor collision persist']}
for name,sha in receipt['oldFiles'].items():assert digest(C/name)==sha
(E/'range-v7-native-fresh-proof.json').write_text(json.dumps({'ok':True,'maps':maps,'nativeOverrideBytesPreserved':True,'scoringOrRetrievalImplemented':False},indent=2));unreal.log('RANGE_V7_FRESH_PASS')
