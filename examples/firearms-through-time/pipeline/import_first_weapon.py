import unreal,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];tools=unreal.AssetToolsHelpers.get_asset_tools();assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);out=[]
for name in ['first-hands','first-pistol']:
 source=R/'authoring'/(name+'.glb');task=unreal.AssetImportTask();task.filename=str(source);task.destination_path='/Game/Qualification/WeaponGenerated/'+name;task.automated=True;task.replace_existing=True;task.save=True;task.async_=False
 tools.import_asset_tasks([task]);rows=[]
 for p in assets.list_assets(task.destination_path,recursive=True,include_folder=False):
  a=unreal.load_asset(p);row={'path':a.get_path_name(),'class':a.get_class().get_name()}
  if isinstance(a,unreal.SkeletalMesh):
   row['bones']=a.skeleton.get_reference_pose().get_bone_names() if hasattr(a.skeleton,'get_reference_pose') else []
  if isinstance(a,unreal.StaticMesh):row['bounds']=[list(a.get_bounding_box().min.to_tuple()),list(a.get_bounding_box().max.to_tuple())]
  rows.append(row)
 out.append({'name':name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'assets':rows});(R/'evidence/first-weapon-native-import.json').write_text(json.dumps(out,indent=2,default=str))
unreal.log('FIRST_WEAPON_IMPORT_DONE')
