"""Verify the active validation map and capture its real editor viewport."""
import base64
import json
from pathlib import Path
from unreal_rpc import UnrealRPC

ROOT = Path(__file__).resolve().parents[1]
c = UnrealRPC()
c.initialize()
def call(toolset, name, arguments):
    r = c.request('tools/call', {'name':'call_tool', 'arguments':{'toolset_name':toolset,'tool_name':name,'arguments':arguments}})
    if r.get('isError'):
        raise RuntimeError(r)
    return r
r = call('editor_toolset.toolsets.scene.SceneTools','get_current_level',{})
assert json.loads(r['content'][0]['text'])['returnValue'] == '/Game/Qualification/ValidationMap', r
r = call('EditorToolset.EditorAppToolset','CaptureViewport',{
    'captureTransform': {'location': {'x':600,'y':650,'z':450},'rotation': {'pitch':-23,'yaw':-132.7,'roll':0}},
    'annotations': {'gridSpacing':0,'gridExtent':0,'gridHeight':0,'maxLabelDistance':0,'classFilter':{'refPath':'/Script/Engine.Actor'},'maxLabels':0},
    'bShowUI':False,
})
images = []
for i, block in enumerate(r.get('content', [])):
    if block['type'] == 'image':
        path = ROOT / f'evidence/native-viewport-{i}.png'
        path.write_bytes(base64.b64decode(block['data']))
        block['data'] = f'[saved to {path}]'
        images.append(str(path))
    elif block['type'] == 'text':
        obj = json.loads(block['text'])
        img = obj.get('returnValue', {}).get('image')
        if img and img.get('data'):
            path = ROOT / 'evidence/native-viewport.png'
            path.write_bytes(base64.b64decode(img['data']))
            img['data'] = f'[saved to {path}]'
            block['text'] = json.dumps(obj)
            images.append(str(path))
assert images, 'Viewport tool returned no image'
(ROOT / 'evidence/mcp-viewport-receipt.json').write_text(json.dumps(r,indent=2))
print(json.dumps({'images':images}))
