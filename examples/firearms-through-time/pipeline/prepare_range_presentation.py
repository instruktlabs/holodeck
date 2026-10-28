"""Scoped v9 presentation materials; no maps or existing overrides are edited."""
from pathlib import Path
import hashlib,json
import unreal
R=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(R/'native/ToolchainValidation').resolve()
A=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
C=R/'native/ToolchainValidation/Content/Qualification'
def protected():return {str(p.relative_to(C)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['RangeSliceOverrides','WeaponOverrides'] for p in (C/folder).rglob('*') if p.is_file()}
before=protected();receipt={'ok':False,'materials':{},'nativeOverrideHashes':before}
for name,color in [('M_RangeScreen',None),('M_PaperFiber',(.72,.67,.51)),('M_SteelSpark',(1.6,.48,.08))]:
    dest='/Game/Qualification/RangeV9Generated'
    assert not A.does_asset_exist(dest+'/'+name), 'Existing candidate requires inspection before retry'
    m=unreal.AssetToolsHelpers.get_asset_tools().create_asset(name,dest,unreal.Material,unreal.MaterialFactoryNew())
    m.set_editor_property('shading_model',unreal.MaterialShadingModel.MSM_UNLIT)
    m.set_editor_property('two_sided',True)
    m.set_editor_property('used_with_instanced_static_meshes',True)
    if color:
        e=unreal.MaterialEditingLibrary.create_material_expression(m,unreal.MaterialExpressionConstant3Vector,-200,0)
        e.set_editor_property('constant',unreal.LinearColor(*color,1))
        assert unreal.MaterialEditingLibrary.connect_material_property(e,'',unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    else:
        e=unreal.MaterialEditingLibrary.create_material_expression(m,unreal.MaterialExpressionTextureSampleParameter2D,-200,0)
        e.set_editor_property('parameter_name','ScreenTexture')
        e.set_editor_property('texture',unreal.load_asset('/Engine/EngineResources/WhiteSquareTexture.WhiteSquareTexture'))
        assert unreal.MaterialEditingLibrary.connect_material_property(e,'RGB',unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    unreal.MaterialEditingLibrary.recompile_material(m)
    assert A.save_loaded_asset(m,False)
    f=C/'RangeV9Generated'/f'{name}.uasset'
    receipt['materials'][name]={'path':dest+'/'+name,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'ism':m.get_editor_property('used_with_instanced_static_meshes')}
assert protected()==before
receipt['ok']=True
(R/'evidence/range-v9-presentation-materials.json').write_text(json.dumps(receipt,indent=2))
unreal.log('RANGE_PRESENTATION_MATERIALS_PASS')
