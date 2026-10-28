import unreal,json
from pathlib import Path
R=Path(__file__).resolve().parents[1];assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);rows=[];lib=unreal.MaterialEditingLibrary
for p in assets.list_assets('/Game/Qualification/WeaponGenerated',recursive=True,include_folder=False):
 o=unreal.load_asset(p)
 if isinstance(o,unreal.MaterialInstanceConstant):
  names=lib.get_texture_parameter_names(o);scalars=lib.get_scalar_parameter_names(o)
  rows.append({'path':p,'parent':o.parent.get_path_name(),'textures':{str(n):str(lib.get_material_instance_texture_parameter_value(o,n)) for n in names},'scalars':{str(n):lib.get_material_instance_scalar_parameter_value(o,n) for n in scalars},'textureOverrides':[str(x) for x in o.texture_parameter_values],'static':str(o.get_editor_property('static_parameters')) if hasattr(o,'static_parameters') else 'not exposed'})
(R/'evidence/weapon-v2-material-inspection.json').write_text(json.dumps(rows,indent=2))
