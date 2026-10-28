"""Catch incomplete cross-host Unity asset/GUID transfers before launching Editor."""
from pathlib import Path
import re, json

project=Path(__file__).resolve().parents[1]
def guid(asset):
    assert (project/asset).is_file(), f'Missing asset: {asset}'
    return re.search(r'^guid: ([0-9a-f]{32})$',(project/(asset+'.meta')).read_text(),re.M)[1]

pipeline=guid('Assets/Generated/Pipeline.asset')
renderer=guid('Assets/Generated/Renderer.asset')
global_settings=guid('Assets/UniversalRenderPipelineGlobalSettings.asset')
volume=guid('Assets/DefaultVolumeProfile.asset')
graphics=(project/'ProjectSettings/GraphicsSettings.asset').read_text()
assert re.search(r'm_CustomRenderPipeline:.*guid: '+pipeline,graphics),'GraphicsSettings pipeline GUID does not match source asset'
assert global_settings in graphics,'GraphicsSettings global settings GUID does not match source asset'
assert renderer in (project/'Assets/Generated/Pipeline.asset').read_text(),'Pipeline renderer GUID does not match source asset'
assert volume in (project/'Assets/UniversalRenderPipelineGlobalSettings.asset').read_text(),'Default volume GUID missing from global settings'
assert 'm_ActiveColorSpace: 1' in (project/'ProjectSettings/ProjectSettings.asset').read_text(),'Linear color space required'
print(json.dumps({'status':'passed','scope':'Required render settings asset files and GUIDs; not Editor/rendering proof','pipeline':pipeline,'renderer':renderer,'globalSettings':global_settings,'volume':volume}))
