import json
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);rows=[]
for path in assets.list_assets('/Game/Qualification/MaterialProbeGenerated',recursive=True,include_folder=False):
 asset=unreal.load_asset(path)
 if isinstance(asset,unreal.Texture2D) and asset.compression_settings==unreal.TextureCompressionSettings.TC_NORMALMAP:
  rows.append({'path':path,'beforeFlipGreen':asset.flip_green_channel,'afterFlipGreen':False})
  asset.flip_green_channel=False;assert assets.save_loaded_asset(asset,False)
assert len(rows)==3
(ROOT/'evidence/material-probe-normal-treatment.json').write_text(json.dumps({'scope':'Probe normals only','changes':rows},indent=2))
