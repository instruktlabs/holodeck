"""Reimport the delivery GLB and compare its clips with pre-export pose geometry."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.kdtree import KDTree

argv = sys.argv[sys.argv.index('--') + 1:]
parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--expected', required=True)
parser.add_argument('--out', required=True)
args = parser.parse_args(argv)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps = 30
bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
rigs = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
if len(rigs) != 1:
    raise RuntimeError('Expected one imported armature and at least one skinned mesh')
rig = rigs[0]
custom_shapes = {bone.custom_shape for bone in rig.pose.bones if bone.custom_shape is not None}
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o not in custom_shapes]
if not meshes:
    raise RuntimeError('No delivery meshes after excluding importer bone-display helpers')
rig.animation_data_create()
for track in rig.animation_data.nla_tracks:
    track.mute = True
expected = np.load(args.expected)
results = []

def furthest_nearest(source, target):
    tree = KDTree(len(target))
    for index, position in enumerate(target):
        tree.insert(Vector(position), index)
    tree.balance()
    return max(tree.find(Vector(position))[2] for position in source)

for key in expected.files:
    clip, phase = key.split('__')
    actions = [a for a in bpy.data.actions if clip in a.name]
    if len(actions) != 1:
        raise RuntimeError(f'{clip}: expected one action; found {[a.name for a in actions]}')
    action = actions[0]
    rig.animation_data.action = action
    if len(action.slots) == 1:
        rig.animation_data.action_slot = action.slots[0]
    start, end = action.frame_range
    frame = start + float(phase) * (end - start)
    bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
    bpy.context.view_layer.update()
    actual = []
    for obj in meshes:
        evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        actual.extend(tuple(obj.matrix_world @ v.co) for v in mesh.vertices)
        evaluated.to_mesh_clear()
    reference = expected[key]
    forward = furthest_nearest(actual, reference)
    reverse = furthest_nearest(reference, actual)
    results.append({'clip': clip, 'phase': float(phase), 'action': action.name,
                    'frameRange': [start, end], 'sourceVertices': len(reference), 'importedVertices': len(actual),
                    'symmetricNearestVertexErrorM': max(forward, reverse), 'pass': max(forward, reverse) < .0001})
report = {'blender': bpy.app.version_string,
          'inputSha256': hashlib.sha256(Path(args.input).read_bytes()).hexdigest(),
          'scope': 'Symmetric nearest-vertex distance after fresh GLB import. Tests clip pose geometry despite UV/material vertex splitting; not an art or collision test.',
          'armatures': len(rigs), 'meshes': len(meshes), 'clips': results,
          'excludedBoneDisplayHelpers': [obj.name for obj in custom_shapes],
          'pass': all(item['pass'] for item in results)}
Path(args.out).write_text(json.dumps(report, indent=2), encoding='utf-8')
print(json.dumps(report))
if not report['pass']:
    raise RuntimeError('Exported animation does not reproduce expected poses')
