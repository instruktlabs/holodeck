"""Fixture-only texture sampling comparison; preserve the previous settings."""
import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
rows=[]
for path in assets.list_assets('/Game/Qualification/ExhibitGenerated',recursive=True,include_folder=False):
 t=unreal.load_asset(path)
 if not isinstance(t,unreal.Texture2D):continue
 before={k:str(t.get_editor_property(k)) for k in ['srgb','filter','mip_gen_settings','lod_bias','compression_settings','flip_green_channel']}
 t.set_editor_property('filter',unreal.TextureFilter.TF_TRILINEAR)
 t.set_editor_property('mip_gen_settings',unreal.TextureMipGenSettings.TMGS_SIMPLE_AVERAGE)
 assert assets.save_loaded_asset(t,False)
 rows.append({'path':path,'before':before,'after':{k:str(t.get_editor_property(k)) for k in before}})
(ROOT/'evidence/material-sampling-native-profile.json').write_text(json.dumps({'scope':'ExhibitGenerated textures only','textures':rows,'reason':'Explicit trilinear filtering and average mips for a browser-default comparison; no claim of identical GPU filtering.'},indent=2))
