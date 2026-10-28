"""Read-only: recompile M_GhostRing and record the compiler errors and each expression's wiring."""
import json,unreal
from pathlib import Path
R=Path(__file__).resolve().parents[1];mel=unreal.MaterialEditingLibrary;m=unreal.load_asset('/Game/Qualification/SightV11/M_GhostRing')
errors=[str(e) for e in mel.recompile_material(m)]
nodes=[{'name':x.get_name(),'class':x.get_class().get_name(),'inputs':[str(n) for n in mel.get_material_expression_input_names(x)],'outputs':[str(n) for n in mel.get_material_expression_output_names(x)],'from':[i.get_name() if i else None for i in mel.get_inputs_for_material_expression(m,x)]} for x in mel.get_material_expressions(m)]
(R/'evidence/bolt-v11/ghost-ring-diagnosis.json').write_text(json.dumps({'errors':errors,'nodes':nodes},indent=1))
unreal.log('GHOST_RING_DIAG '+json.dumps(errors))
