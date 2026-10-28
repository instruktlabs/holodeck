"""Give the imported BoltV11 materials explicit Nanite usage before cooking (see rifle v10: the cooked game otherwise falls back to the default material). Touches /Game/Qualification/BoltV11 only."""
from pathlib import Path
import unreal,json,hashlib
R=Path(__file__).resolve().parents[1];E=R/'evidence';C=R/'native/ToolchainValidation/Content/Qualification'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def protected():
 files=list(C.glob('*.umap'))
 for folder in ['NativeOverrides','RangeSliceOverrides','WeaponGenerated','RifleV10','RangeDressingV1Generated']:
  files.extend(p for p in (C/folder).rglob('*') if p.is_file())
 return {str(p.relative_to(C)):sha(p) for p in files}
before=protected();assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);rows=[]
for path in assets.list_assets('/Game/Qualification/BoltV11',recursive=True,include_folder=False):
 asset=assets.load_asset(path)
 if not isinstance(asset,unreal.MaterialInterface):continue
 assert '/Materials/' in asset.get_path_name(),asset.get_path_name()
 unreal.MaterialEditingLibrary.set_material_usage_override(asset,unreal.MaterialUsage.MATUSAGE_NANITE,True,True)
 if isinstance(asset,unreal.MaterialInstanceConstant):unreal.MaterialEditingLibrary.update_material_instance(asset)
 assert assets.save_loaded_asset(asset,False)
 rows.append({'material':asset.get_path_name(),'class':asset.get_class().get_name(),'parent':asset.get_editor_property('parent').get_path_name() if isinstance(asset,unreal.MaterialInstance) else None})
assert any('/gun/' in r['material'] for r in rows) and any('/token/' in r['material'] for r in rows),rows
assert protected()==before,'Existing map/pistol/rifle/native override bytes changed'
(E/'bolt-v11-nanite-usage.json').write_text(json.dumps({'ok':True,'materials':rows,'protectedUnchanged':True,'files':{str(p.relative_to(C)):sha(p) for p in (C/'BoltV11').rglob('*') if p.is_file()}},indent=2))
unreal.log('BOLT_V11_NANITE_USAGE_PASS')
