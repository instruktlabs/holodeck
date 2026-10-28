"""Repair the generated ghost-ring graph in place: the Clamp's single input is named '' (the original import wired 'Input', which
silently failed). Clearing the graph asserts on the rooted asset, so only the missing link is made. Touches SightV11/M_GhostRing only."""
import json,unreal
from pathlib import Path
R=Path(__file__).resolve().parents[1];mel=unreal.MaterialEditingLibrary;assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
m=unreal.load_asset('/Game/Qualification/SightV11/M_GhostRing');xs=mel.get_material_expressions(m)
one=lambda cls:[x for x in xs if x.get_class().get_name()==cls]
clamp=one('MaterialExpressionClamp')[0];neg=[x for x in one('MaterialExpressionMultiply') if [i.get_name() if i else None for i in mel.get_inputs_for_material_expression(m,x)][0]==one('MaterialExpressionDotProduct')[0].get_name()][0]
assert mel.connect_material_expressions(neg,'',clamp,'')
errors=[str(e) for e in mel.recompile_material(m)];assert not errors,errors;assert assets.save_loaded_asset(m,False)
(R/'evidence/bolt-v11/ghost-ring-rebuild.json').write_text(json.dumps({'ok':True,'material':m.get_path_name(),'repaired':'Multiply(dot,-1) -> Clamp','errors':errors},indent=2))
unreal.log('GHOST_RING_REPAIR_PASS')
