import unreal,json,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[1];tools=unreal.AssetToolsHelpers.get_asset_tools();assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
saved=json.loads((R/'evidence/first-hands-final-saved.json').read_text())['asset'];source=R/'authoring/first-hands.glb';sha=hashlib.sha256(source.read_bytes()).hexdigest();assert saved['files']['asset.glb']['sha256']=='sha256:'+sha
task=unreal.AssetImportTask();task.filename=str(source);task.destination_path='/Game/Qualification/WeaponGenerated/first-hands';task.automated=True;task.replace_existing=True;task.save=True;task.async_=False;tools.import_asset_tasks([task])
mesh=unreal.load_asset('/Game/Qualification/WeaponGenerated/first-hands/first-hands/SkeletalMeshes/first-hands');bones=[str(n) for n in mesh.skeleton.get_reference_pose().get_bone_names()];assert len(bones)==33
grip=unreal.load_asset('/Game/Qualification/WeaponGenerated/first-pistol/first-pistol/Materials/WalnutGrip');params=[str(v.parameter_info.name) for v in grip.vector_parameter_values]
assert 'BaseColorFactor' in params
(R/'evidence/weapon-hands-reimport.json').write_text(json.dumps({'ok':True,'assetId':saved['assetId'],'revisionId':saved['revisionId'],'sha256':sha,'bones':bones,'gripParameters':params},indent=2));unreal.log('WEAPON_HANDS_REIMPORT_DONE')
