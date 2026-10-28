import json,hashlib,shutil
from pathlib import Path
import unreal
ROOT=Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve()==(ROOT/'native/ToolchainValidation').resolve()
assets=unreal.get_editor_subsystem(unreal.EditorAssetSubsystem);rows=[]
backup=ROOT/'evidence/opening-case-normal-before';backup.mkdir(exist_ok=True)
for path in assets.list_assets('/Game/Qualification/OpeningCaseGenerated',recursive=True,include_folder=False):
 a=unreal.load_asset(path)
 if isinstance(a,unreal.Texture2D) and a.compression_settings==unreal.TextureCompressionSettings.TC_NORMALMAP:
  file=ROOT/'native/ToolchainValidation/Content'/ (path.split('.')[0].removeprefix('/Game/')+'.uasset')
  dest=backup/file.name
  assert not dest.exists(),'Do not overwrite profile backup'
  shutil.copy2(file,dest)
  rows.append({'path':path,'beforeFlipGreen':a.flip_green_channel,'afterFlipGreen':False,'backupSha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
  a.flip_green_channel=False;assert assets.save_loaded_asset(a,False)
assert len(rows)==1
(ROOT/'evidence/opening-case-normal-profile.json').write_text(json.dumps({'basis':'Directional normal probe showed reversed response with automatic green flip; disabling that flip restored expected order. Applies only to this pinned Interchange/material path.','changes':rows},indent=2))
