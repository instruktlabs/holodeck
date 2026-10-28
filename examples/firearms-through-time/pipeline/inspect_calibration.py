import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
receipt={'materials':[]}
for path in assets.list_assets('/Game/Qualification/ExhibitGenerated',recursive=True,include_folder=False):
    obj=unreal.load_asset(path)
    if isinstance(obj,unreal.MaterialInstanceConstant):
        m={'path':path,'parent':obj.parent.get_path_name(),'vectors':[],'scalars':[],'textures':[]}
        for v in obj.vector_parameter_values:
            m['vectors'].append({'name':str(v.parameter_info.name),'value':[v.parameter_value.r,v.parameter_value.g,v.parameter_value.b,v.parameter_value.a]})
        for s in obj.scalar_parameter_values:m['scalars'].append({'name':str(s.parameter_info.name),'value':s.parameter_value})
        for t in obj.texture_parameter_values:m['textures'].append({'name':str(t.parameter_info.name),'value':t.parameter_value.get_path_name() if t.parameter_value else None})
        receipt['materials'].append(m)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
assert level.load_level('/Game/Qualification/ExhibitLab')
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
receipt['lights']=[]
for a in actors.get_all_level_actors():
    if isinstance(a,unreal.DirectionalLight):receipt['lights'].append({'type':'directional','intensity':a.light_component.intensity,'color':str(a.light_component.light_color),'rotation':str(a.get_actor_rotation())})
    if isinstance(a,unreal.SkyLight):receipt['lights'].append({'type':'sky','intensity':a.light_component.intensity,'source':str(a.light_component.source_type)})
(ROOT/'evidence/calibration-initial-materials.json').write_text(json.dumps(receipt,indent=2))
