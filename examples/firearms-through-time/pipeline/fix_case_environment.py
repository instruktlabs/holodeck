"""Use an explicit constant radiance cubemap for a reproducible studio environment."""
import json,math
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
# Deterministic Radiance RGBE data, generated from a scalar lighting value.
hdr=ROOT/'authoring/studio-radiance-040.hdr';m,e=math.frexp(.4)
hdr.write_bytes(b'#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 32 +X 64\n'+bytes([int(m*256)]*3+[e+128])*(64*32))
t=unreal.AssetImportTask();t.filename=str(hdr);t.destination_path='/Game/Qualification/TransportCaseStudio';t.automated=True;t.replace_existing=True;t.save=True
unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([t])
cubes=[a for p in t.imported_object_paths if isinstance(a:=unreal.load_asset(p),unreal.TextureCube)]
assert len(cubes)==1,'HDR must import as TextureCube'
level=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);assert level.load_level('/Game/Qualification/TransportCaseLab')
actors=unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
for a in actors:
 if isinstance(a,unreal.SkyLight):
  a.light_component.set_editor_property('real_time_capture',False)
  a.light_component.set_editor_property('source_type',unreal.SkyLightSourceType.SLS_SPECIFIED_CUBEMAP)
  a.light_component.set_editor_property('cubemap',cubes[0]);a.light_component.set_intensity(.6)
mat=unreal.load_asset('/Game/Qualification/TransportCaseStudio/M_StudioSky')
mat.set_editor_property('is_sky',True);unreal.MaterialEditingLibrary.recompile_material(mat)
assert unreal.get_editor_subsystem(unreal.EditorAssetSubsystem).save_loaded_asset(mat,False)
assert level.save_current_level()
(ROOT/'evidence/transport-case-environment-fix.json').write_text(json.dumps({'ok':True,'cubemap':cubes[0].get_path_name(),'linearRadiance':.4,'intensity':.6,'method':'Explicit uniform RGBE cube; previous scene-capture presentation produced black steel.','limit':'Holodeck captures the world and sky, so this is a shared neutral radiance intent, not identical reflection content.'},indent=2))
