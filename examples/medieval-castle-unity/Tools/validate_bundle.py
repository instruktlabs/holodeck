"""Portable, dependency-free artifact check. Not a renderer or Unity substitute."""
import hashlib
import json
import math
import pathlib
import platform
import struct
import sys
import time

root = pathlib.Path(sys.argv[1])
started = time.perf_counter()
bundle = json.loads((root / 'bundle.json').read_text(encoding='utf-8-sig'))
assets = {}
for asset in bundle['assets']:
    assert asset['id'] not in assets, 'duplicate asset ID'
    raw = (root / (asset['id'] + '.glb')).read_bytes()
    digest = 'sha256:' + hashlib.sha256(raw).hexdigest()
    assert digest == asset['sha256'], 'hash mismatch: ' + asset['id']
    magic, version, size = struct.unpack_from('<III', raw)
    assert magic == 0x46546c67 and version == 2 and size == len(raw)
    length, kind = struct.unpack_from('<II', raw, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(raw[20:20 + length])
    assert not doc.get('skins') and not doc.get('animations'), 'rigid profile only'
    nodes = doc.get('nodes', [])
    def visit(i, ancestors):
        assert 0 <= i < len(nodes) and i not in ancestors, 'invalid node graph'
        for child in nodes[i].get('children', []):
            visit(child, ancestors | {i})
    for i in range(len(nodes)):
        visit(i, set())
    triangles = 0
    for mesh in doc.get('meshes', []):
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4
            index = primitive.get('indices', primitive['attributes']['POSITION'])
            triangles += doc['accessors'][index]['count'] // 3
    assets[asset['id']] = {'sha256': digest, 'bytes': size, 'nodes': len(nodes), 'meshTriangles': triangles}
ids = set()
for placement in bundle['placements']:
    assert placement['id'] not in ids
    ids.add(placement['id'])
    assert placement['asset'] in assets
    for field in ['position', 'rotation', 'scale']:
        assert len(placement[field]) == 3 and all(math.isfinite(v) for v in placement[field])
    assert all(v > 0 for v in placement['scale']), 'nonpositive scale unsupported'
    for box in placement['collider']['boxes']:
        assert len(box['size']) == len(box['offset']) == 3
        assert all(math.isfinite(v) and v > 0 for v in box['size'])
        assert all(math.isfinite(v) for v in box['offset'])
print(json.dumps({'status': 'pass', 'revision': bundle['revision'], 'host': platform.node(),
    'platform': platform.platform(), 'python': platform.python_version(), 'assets': assets,
    'placements': len(ids), 'seconds': time.perf_counter()-started,
    'limitations': ['Structural artifact checks only', 'No Unity execution, visual parity, traversal or game performance claim']}, indent=2))
