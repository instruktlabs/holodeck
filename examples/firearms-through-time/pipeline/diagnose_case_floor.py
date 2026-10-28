import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
target='/Game/Qualification/MaterialDiagnostics'
assert not assets.does_asset_exist(target),'Preserve existing diagnostic'
assert level.new_level_from_template(target,'/Game/Qualification/TransportCaseLab')
floor=next(a for a in unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors() if a.get_actor_label()=='StudyFloor')
old=floor.static_mesh_component.get_material(0)
mat=unreal.AssetToolsHelpers.get_asset_tools().create_asset('M_NeutralFloor','/Game/Qualification/MaterialStudy',unreal.Material,unreal.MaterialFactoryNew())
col=unreal.MaterialEditingLibrary.create_material_expression(mat,unreal.MaterialExpressionConstant3Vector);col.constant=unreal.LinearColor(.35,.35,.35,1)
rough=unreal.MaterialEditingLibrary.create_material_expression(mat,unreal.MaterialExpressionConstant);rough.r=1
unreal.MaterialEditingLibrary.connect_material_property(col,'',unreal.MaterialProperty.MP_BASE_COLOR)
unreal.MaterialEditingLibrary.connect_material_property(rough,'',unreal.MaterialProperty.MP_ROUGHNESS)
unreal.MaterialEditingLibrary.recompile_material(mat);assert assets.save_loaded_asset(mat,False)
floor.static_mesh_component.set_material(0,mat);assert level.save_current_level()
(ROOT/'evidence/floor-material-diagnostic.json').write_text(json.dumps({'originalMaterial':old.get_path_name(),'replacement':mat.get_path_name(),'map':target,'changed':'Only floor material; source map preserved.'},indent=2))
