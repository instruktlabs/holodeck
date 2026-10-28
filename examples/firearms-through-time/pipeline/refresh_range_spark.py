from pathlib import Path
import unreal,json,hashlib
R=Path(__file__).resolve().parents[1]
C=R/'native/ToolchainValidation/Content/Qualification'
def protected():return {str(p.relative_to(C)):hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['RangeSliceOverrides','WeaponOverrides'] for p in (C/folder).rglob('*') if p.is_file()}
before=protected();p=C/'RangeV9Generated/M_SteelSpark.uasset';oldhash=hashlib.sha256(p.read_bytes()).hexdigest()
m=unreal.load_asset('/Game/Qualification/RangeV9Generated/M_SteelSpark')
old=unreal.MaterialEditingLibrary.get_material_property_input_node(m,unreal.MaterialProperty.MP_EMISSIVE_COLOR)
assert old is not None
e=old
e.set_editor_property('constant',unreal.LinearColor(12,3,.3,1))
assert unreal.MaterialEditingLibrary.connect_material_property(e,'',unreal.MaterialProperty.MP_EMISSIVE_COLOR)
m.set_editor_property('shading_model',unreal.MaterialShadingModel.MSM_UNLIT)
m.set_editor_property('used_with_instanced_static_meshes',True)
unreal.MaterialEditingLibrary.recompile_material(m)
assert unreal.get_editor_subsystem(unreal.EditorAssetSubsystem).save_loaded_asset(m,False)
assert protected()==before
r={'ok':True,'material':m.get_path_name(),'beforeSha256':oldhash,'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'emissive':[12,3,.3],'unlit':str(m.get_editor_property('shading_model')),'ism':m.get_editor_property('used_with_instanced_static_meshes'),'originalOverridesUnchanged':True,'scope':'Generated spark material only. Rendering-enabled shader refresh; appearance still requires runtime capture.'}
(R/'evidence/range-v9-spark-material-refresh.json').write_text(json.dumps(r,indent=2))
unreal.log('SPARK_REFRESH_PASS')
