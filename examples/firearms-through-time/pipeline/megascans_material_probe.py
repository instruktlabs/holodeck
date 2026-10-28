import unreal,json
from pathlib import Path
out={'materialEditingFunctions':[x for x in dir(unreal.MaterialEditingLibrary) if 'parameter' in x.lower()], 'textureExporters':[x for x in dir(unreal) if x.startswith('TextureExporter')]}
m=unreal.load_asset('/Game/Qualification/OpeningCaseGenerated/opening-case-delivery/Materials/opening-case-delivery_material_0')
for name in ['get_static_switch_parameter_names','get_texture_parameter_names','get_scalar_parameter_names']:
 fn=getattr(unreal.MaterialEditingLibrary,name,None)
 if fn:out[name]=[str(v) for v in fn(m)]
out['instanceMembers']=[n for n in dir(m) if 'static' in n.lower() or 'parameter' in n.lower()]
Path(__file__).resolve().parents[1].joinpath('evidence/megascans-material-native-probe.json').write_text(json.dumps(out,indent=2))
