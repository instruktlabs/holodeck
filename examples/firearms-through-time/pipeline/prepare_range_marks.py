"""Create a separate runtime mark material; never edit target or native overrides."""
from pathlib import Path
import hashlib,json
import unreal
R=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
A=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
destination='/Game/Qualification/RangeV8Generated';name='M_RangeImpact';target=destination+'/'+name
assert not A.does_asset_exist(target), 'Inspect the existing material and receipt before retrying'
content=R/'native/ToolchainValidation/Content/Qualification'
def protected():return {str(p.relative_to(content)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['RangeSliceOverrides','WeaponOverrides'] for p in (content/folder).rglob('*') if p.is_file()}
before=protected()
m=unreal.AssetToolsHelpers.get_asset_tools().create_asset(name,destination,unreal.Material,unreal.MaterialFactoryNew())
assert m
m.set_editor_property('used_with_instanced_static_meshes',True)
m.set_editor_property('two_sided',True)
m.set_editor_property('shading_model',unreal.MaterialShadingModel.MSM_UNLIT)
c=unreal.MaterialEditingLibrary.create_material_expression(m,unreal.MaterialExpressionConstant3Vector,-200,0)
c.set_editor_property('constant',unreal.LinearColor(.012,.016,.018,1))
assert unreal.MaterialEditingLibrary.connect_material_property(c,'',unreal.MaterialProperty.MP_EMISSIVE_COLOR)
unreal.MaterialEditingLibrary.recompile_material(m)
assert A.save_loaded_asset(m,False)
assert m.get_editor_property('used_with_instanced_static_meshes')
assert protected()==before
f=content/'RangeV8Generated/M_RangeImpact.uasset'
(R/'evidence/range-v8-mark-material.json').write_text(json.dumps({'ok':True,'path':target,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'usedWithInstancedStaticMeshes':True,'shadingModel':'unlit','emissiveLinear':[.012,.016,.018],'nativeOverrideHashes':before,'reason':'Durable depth-tested surface marks independent of debug show flags'},indent=2))
unreal.log('RANGE_MARK_MATERIAL_PASS')
