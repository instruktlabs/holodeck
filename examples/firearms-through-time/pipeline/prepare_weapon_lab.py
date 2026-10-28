import unreal,json,struct
from pathlib import Path
R=Path(__file__).resolve().parents[1];assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
target='/Game/Qualification/WeaponLab'
if assets.does_asset_exist(target):
 assert level.load_level(target)
 assert not any(a.get_class().get_name()=='WeaponLoop' for a in actors.get_all_level_actors()),'Prepared map exists; do not duplicate controller'
else:assert level.new_level_from_template(target,'/Game/Qualification/RangeSliceLab')
weapon=actors.spawn_actor_from_class(unreal.load_class(None,'/Script/ToolchainValidation.WeaponLoop'),unreal.Vector());weapon.set_actor_label('WeaponLoop01')
receipt=json.loads((R/'evidence/first-weapon-native-import.json').read_text())
hand=next(unreal.load_asset(a['path']) for a in receipt[0]['assets'] if a['class']=='SkeletalMesh');weapon.set_hands(hand)
b=(R/'authoring/first-pistol.glb').read_bytes();j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
families={}
def walk(index,family='body'):
 n=j['nodes'][index];family={'Joint_Slide':'slide','Joint_Magazine':'magazine'}.get(n.get('name'),family)
 if 'mesh' in n:families[n['name'].replace('.','_')]=family
 for i in n.get('children',[]):walk(i,family)
for n in j['scenes'][0]['nodes']:walk(n)
for a in receipt[1]['assets']:
 if a['class']!='StaticMesh':continue
 mesh=unreal.load_asset(a['path']);name=mesh.get_name();family=families.get(name)
 assert family is not None,'Unmapped imported node '+name
 weapon.add_part(mesh,family)
for a in actors.get_all_level_actors():
 if a.get_class().get_name()=='RangeSliceActor':a.tags=list(a.tags)+['WeaponLab']
 if a.get_class().get_name()=='RangeSlicePawn':a.set_actor_location(unreal.Vector(2000,0,90),False,False);a.set_actor_rotation(unreal.Rotator(),False);a.get_component_by_class(unreal.CameraComponent).set_field_of_view(80)
assert level.save_current_level()
(R/'evidence/weapon-lab-prepared.json').write_text(json.dumps({'map':target,'hand':hand.get_path_name(),'parts':len(families),'ok':True},indent=2));unreal.log('WEAPON_LAB_READY')
