import unreal,json
from pathlib import Path
rows=[]
a=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
for p in a.list_assets('/Game/Qualification/OpeningCaseGenerated',recursive=True,include_folder=False):
 o=unreal.load_asset(p)
 if isinstance(o,unreal.MaterialInstanceConstant):
  rows.append({'path':p,'parent':str(o.parent),'scalars':str(o.scalar_parameter_values),'vectors':str(o.vector_parameter_values),'layers':str(o.get_editor_property('base_property_overrides'))})
Path(__file__).resolve().parents[1].joinpath('evidence/opening-update-material-probe.json').write_text(json.dumps(rows,indent=2))
