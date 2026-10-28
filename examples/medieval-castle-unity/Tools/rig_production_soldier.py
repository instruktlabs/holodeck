"""Explicit semantic Kiln -> Blender -> animated GLB delivery adapter.

Run with pinned Blender --background --python this_file -- --input ...
--manifest ... --out ... [--render]. Original source assets are never edited.
"""
import argparse
import fnmatch
import hashlib
import heapq
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--manifest', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--render', action='store_true')
parser.add_argument('--underarm-review', action='store_true', help='Render focused underarm poses in addition to full-body checks')
args = parser.parse_args(argv)
out = Path(args.out).resolve()
out.mkdir(parents=True, exist_ok=True)
source_path = Path(args.input).resolve()
manifest_path = Path(args.manifest).resolve()
manifest = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
sha = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
if manifest.get('glbSha256', '').removeprefix('sha256:') != sha(source_path):
    raise RuntimeError('Manifest must pin the exact source GLB hash')

# glTF +Y up/+Z right -> Blender +Z up/-Y right.
def point(v):
    return Vector((v[0], -v[2], v[1]))

def smooth(a, b, value):
    t = max(0.0, min(1.0, (value - a) / (b - a)))
    return t * t * (3 - 2 * t)

landmarks = manifest['joints']
joints = {name: landmarks[name.lower()] for name in ['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head']}
for side, prefix in [('R', 'right'), ('L', 'left')]:
    for name, suffix in [('UpperArm', 'Shoulder'), ('Forearm', 'Elbow'), ('Hand', 'Wrist'),
                         ('UpperLeg', 'Hip'), ('LowerLeg', 'Knee'), ('Foot', 'Ankle'), ('Toes', 'Toe')]:
        joints[name + '.' + side] = landmarks[prefix + suffix]
    if (joints['UpperArm.' + side][2] > 0) != (side == 'R'):
        raise RuntimeError('Anatomical R must be +Z and L must be -Z in glTF')

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(source_path))
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise RuntimeError('No source meshes')
shared_mesh_instances = sum(obj.data.users > 1 for obj in meshes)
# GLB instances may share a Blender mesh datablock. Detach every instance before
# baking transforms or assigning weights; otherwise edits contaminate its siblings.
source_world_positions = {obj.name: [obj.matrix_world @ v.co for v in obj.data.vertices] for obj in meshes}
for obj in meshes:
    obj.data = obj.data.copy()
    if len(obj.vertex_groups):
        raise RuntimeError('Expected a static source without existing skin weights')

rules = manifest['parts']
allowed_roles = {'head', 'neck', 'upper_body', 'sleeve', 'chest', 'hips', 'glove', 'forearm', 'upper_arm', 'leg', 'lower_leg', 'foot', 'boot', 'skirt', 'weapon'}
parts = []
for obj in meshes:
    matches = [r for r in rules if fnmatch.fnmatchcase(obj.name, r.get('pattern', r.get('mesh', '')))]
    if len(matches) != 1:
        raise RuntimeError(f'{obj.name}: expected exactly one semantic rule, got {len(matches)}')
    rule = matches[0]
    if rule['role'] not in allowed_roles:
        raise RuntimeError(f'Unknown semantic role: {rule}')
    if rule['role'] in {'sleeve', 'glove', 'forearm', 'upper_arm', 'leg', 'lower_leg', 'foot', 'boot', 'skirt', 'weapon'} and rule.get('side') not in {'L', 'R'}:
        raise RuntimeError(f'Explicit anatomical side required: {rule}')
    parts.append((obj, rule))

definitions = [('Root', joints['Root'], [0, .15, 0], None),
               ('Hips', joints['Hips'], joints['Spine'], 'Root'),
               ('Spine', joints['Spine'], joints['Chest'], 'Hips'),
               ('Chest', joints['Chest'], joints['Neck'], 'Spine'),
               ('Neck', joints['Neck'], joints['Head'], 'Chest'),
               ('Head', joints['Head'], landmarks.get('headTip', [-.008, 1.79, 0]), 'Neck')]
for side, sign in [('R', 1), ('L', -1)]:
    shoulder = joints['UpperArm.' + side]
    wrist, elbow = Vector(joints['Hand.' + side]), Vector(joints['Forearm.' + side])
    hand_tip = landmarks.get(('right' if side == 'R' else 'left') + 'HandTip', list(wrist + (wrist - elbow).normalized() * .12))
    toe_tip = list(Vector(joints['Toes.' + side]) + Vector((.06, 0, 0)))
    definitions += [('Shoulder.' + side, [shoulder[0], shoulder[1], sign * .07], shoulder, 'Chest'),
                    ('UpperArm.' + side, shoulder, joints['Forearm.' + side], 'Shoulder.' + side),
                    ('Forearm.' + side, joints['Forearm.' + side], joints['Hand.' + side], 'UpperArm.' + side),
                    ('Hand.' + side, joints['Hand.' + side], hand_tip, 'Forearm.' + side),
                    ('UpperLeg.' + side, joints['UpperLeg.' + side], joints['LowerLeg.' + side], 'Hips'),
                    ('LowerLeg.' + side, joints['LowerLeg.' + side], joints['Foot.' + side], 'UpperLeg.' + side),
                    ('Foot.' + side, joints['Foot.' + side], joints['Toes.' + side], 'LowerLeg.' + side),
                    ('Toes.' + side, joints['Toes.' + side], toe_tip, 'Foot.' + side)]

arm_data = bpy.data.armatures.new('GarrisonSkeleton')
arm = bpy.data.objects.new('GarrisonRig', arm_data)
bpy.context.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, head, tail, parent in definitions:
    bone = arm_data.edit_bones.new(name)
    bone.head, bone.tail = point(head), point(tail)
    if (bone.tail - bone.head).length < .001:
        raise RuntimeError('Degenerate bone ' + name)
    if parent:
        bone.parent = arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
bone_names = [entry[0] for entry in definitions]

def torso_weights(y):
    hips = 1 - smooth(joints['Hips'][1] - .02, joints['Spine'][1], y)
    chest = smooth(joints['Spine'][1] - .02, joints['Chest'][1], y)
    return {'Hips': hips, 'Spine': (1 - hips) * (1 - chest), 'Chest': (1 - hips) * chest}

def arm_weights(side, p):
    elbow = point(joints['Forearm.' + side])
    wrist = point(joints['Hand.' + side])
    axis = (wrist - elbow).normalized()
    forearm = smooth(-.055, .065, (p - elbow).dot(axis))
    hand = smooth(-.04, .025, (p - wrist).dot(axis))
    return {'UpperArm.' + side: (1 - forearm) * (1 - hand),
            'Forearm.' + side: forearm * (1 - hand), 'Hand.' + side: hand}

def skin_weights(rule, p, vertex_index):
    x, y, z = p.x, p.z, -p.y
    role, side = rule['role'], rule.get('side', 'R' if z >= 0 else 'L')
    if role == 'head':
        return {'Head': 1}
    if role == 'chest':
        return {'Chest': 1}
    if role == 'hips':
        return {'Hips': 1}
    if role == 'neck':
        t = smooth(joints['Neck'][1], joints['Head'][1], y)
        return {'Neck': 1 - t, 'Head': t}
    if role in {'glove', 'weapon'}:
        return {'Hand.' + side: 1}
    if role == 'forearm':
        return {'Forearm.' + side: 1}
    if role == 'upper_arm':
        return {'UpperArm.' + side: 1}
    if role == 'lower_leg':
        return {'LowerLeg.' + side: 1}
    if role == 'foot':
        return {'Foot.' + side: 1}
    if role == 'sleeve':
        return arm_weights(side, p)
    if vertex_index in rule.get('_sleeveRegions', {}):
        side, center, strength = rule['_sleeveRegions'][vertex_index]
        result = {name: weight * strength for name, weight in arm_weights(side, point(center)).items()}
        result['Chest'] = 1 - strength
        return result
    if role == 'skirt':
        t = .82 * (1 - smooth(rule.get('hemY', .72), rule.get('waistY', joints['Hips'][1]), y))
        return {'Hips': 1 - t, 'UpperLeg.' + side: t}
    if role == 'boot':
        ankle = joints['Foot.' + side][1]
        shaft = smooth(ankle, ankle + .12, y)
        toe = smooth(joints['Toes.' + side][0] - .02, joints['Toes.' + side][0] + .04, x) * (1 - shaft)
        return {'LowerLeg.' + side: shaft, 'Foot.' + side: 1 - shaft - toe, 'Toes.' + side: toe}
    if role == 'leg':
        knee = joints['LowerLeg.' + side][1]
        upper = smooth(knee - .07, knee + .07, y)
        pelvis = smooth(joints['UpperLeg.' + side][1] - .07, joints['UpperLeg.' + side][1] + .035, y)
        return {'Hips': pelvis, 'UpperLeg.' + side: (1 - pelvis) * upper, 'LowerLeg.' + side: (1 - pelvis) * (1 - upper)}
    # Shared position-based field for both sides of the torso/sleeve joins.
    az = abs(z)
    shoulder_z = abs(joints['UpperArm.' + side][2])
    lateral = smooth(shoulder_z * .72, shoulder_z + .11, az)
    root_height = smooth(joints['Spine'][1] - .03, joints['Chest'][1], y)
    distal_sleeve = smooth(shoulder_z + .06, shoulder_z + .14, az)
    shoulder = lateral * max(root_height, distal_sleeve)
    base = {n: w * (1 - shoulder) for n, w in torso_weights(y).items()}
    for name, weight in arm_weights(side, p).items():
        base[name] = shoulder * weight
    return base

part_audit, source_vertices, role_indices, role_groups = [], [], {}, {}
for obj, rule in parts:
    if 'vertexRegions' in rule:
        rule['_sleeveRegions'] = {}
        for side, region in rule['vertexRegions']['sleeves'].items():
            # Ring spacing is deliberately nonuniform around the armpit. An
            # ordinal .75 -> .95 jump stretched an8mm underside edge nearly4x.
            # Measure distance along the authored surface instead, retaining
            # the shared armhole's existing .35 ownership and exact vertices.
            allowed = set(region['boundary']) | {i for ring in region['rings'] for i in ring}
            neighbors = {i: [] for i in allowed}
            for edge in obj.data.edges:
                a, b = edge.vertices
                if a in allowed and b in allowed:
                    length = (source_world_positions[obj.name][a] - source_world_positions[obj.name][b]).length
                    neighbors[a].append((b, length))
                    neighbors[b].append((a, length))
            distances = {i: math.inf for i in allowed}
            queue = []
            for i in region['boundary']:
                distances[i] = 0
                heapq.heappush(queue, (0, i))
            while queue:
                distance, i = heapq.heappop(queue)
                if distance != distances[i]:
                    continue
                for other, length in neighbors[i]:
                    candidate = distance + length
                    if candidate < distances[other]:
                        distances[other] = candidate
                        heapq.heappush(queue, (candidate, other))
            for index in region['boundary']:
                rule['_sleeveRegions'][index] = (side, joints['UpperArm.' + side], .35)
            for ring_index, indices in enumerate(region['rings']):
                for index in indices:
                    if not math.isfinite(distances[index]):
                        raise RuntimeError('Disconnected authored sleeve region')
                    strength = .35 + .65 * smooth(0, .16, distances[index])
                    rule['_sleeveRegions'][index] = (side, region['centers'][ring_index], strength)
    obj.data.transform(obj.matrix_world.copy())
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    instance_error = max((v.co - expected).length for v, expected in zip(obj.data.vertices, source_world_positions[obj.name]))
    if instance_error > 1e-5:
        raise RuntimeError('Imported instance transform was not preserved: ' + obj.name)
    groups = {name: obj.vertex_groups.new(name=name) for name in bone_names}
    name = obj.name
    used_bones = set()
    for vertex in obj.data.vertices:
        weights = {n: w for n, w in skin_weights(rule, vertex.co, vertex.index).items() if w > 1e-7}
        weights = dict(sorted(weights.items(), key=lambda item: item[1], reverse=True)[:4])
        total = sum(weights.values())
        if not math.isfinite(total) or total <= 0:
            raise RuntimeError('Unweighted or nonfinite vertex in ' + name)
        for bone, weight in weights.items():
            groups[bone].add([vertex.index], weight / total, 'REPLACE')
            used_bones.add(bone)
    if rule['role'] == 'head' and used_bones != {'Head'}:
        raise RuntimeError('Protected head part received a non-head influence')
    # A point-domain attribute survives joining and identifies each source component.
    tag = obj.data.attributes.new('source_part_id', 'INT', 'POINT')
    vertex_tag = obj.data.attributes.new('source_vertex_id', 'INT', 'POINT')
    part_id = len(part_audit)
    for index, value in enumerate(tag.data):
        value.value = part_id
        vertex_tag.data[index].value = index
    part_audit.append({'id': part_id, 'name': name, 'role': rule['role'], 'side': rule.get('side'),
                       'vertices': len(obj.data.vertices), 'bones': sorted(used_bones), 'instanceBakeErrorM': instance_error,
                       'colorAttributes': [a.name for a in obj.data.color_attributes],
                       'uvLayers': [u.name for u in obj.data.uv_layers]})
    obj.parent = arm
    modifier = obj.modifiers.new('GarrisonSkin', 'ARMATURE')
    modifier.object = arm
    modifier.use_deform_preserve_volume = False

bpy.ops.object.select_all(action='DESELECT')
for obj, _ in parts:
    obj.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
body = bpy.context.object
body.name = 'GarrisonBody'
tags = body.data.attributes['source_part_id'].data
vertex_tags = body.data.attributes['source_vertex_id'].data
source_lookup = {(part_audit[tags[i].value]['name'], vertex_tags[i].value): i for i in range(len(body.data.vertices))}
weights_by_vertex = []
for vertex in body.data.vertices:
    weights = [(body.vertex_groups[g.group].name, g.weight) for g in vertex.groups if g.weight > 1e-7]
    if not weights or len(weights) > 4 or abs(sum(w for _, w in weights) - 1) > .0001:
        raise RuntimeError(f'Invalid joined skin weights at vertex {vertex.index}: {weights}')
    weights_by_vertex.append(weights)
    source_vertices.append(vertex.co.copy())
    role_indices.setdefault(part_audit[tags[vertex.index].value]['role'], []).append(vertex.index)
    role_groups.setdefault(tags[vertex.index].value, []).append(vertex.index)

scene = bpy.context.scene
scene.render.fps = 30
scene.frame_start, scene.frame_end = 1, 61
inverse_bind = {n: arm.data.bones[n].matrix_local.inverted() for n in bone_names}
rest_rotation = {n: arm.data.bones[n].matrix_local.to_quaternion() for n in bone_names}

def set_rotation(name, rotations):
    world = Quaternion()
    for axis, angle in rotations:
        world = Quaternion(point(axis), angle) @ world
    rest = rest_rotation[name]
    arm.pose.bones[name].rotation_quaternion = rest.inverted() @ world @ rest

def reset_pose():
    for bone in arm.pose.bones:
        bone.rotation_mode = 'QUATERNION'
        bone.rotation_quaternion = Quaternion()
        bone.location = (0, 0, 0)
        bone.scale = (1, 1, 1)

def pose(kind, phase, ground=True):
    reset_pose()
    wave = math.sin(phase * math.tau)
    for side, sign in [('R', 1), ('L', -1)]:
        upper = Vector(joints['Forearm.' + side]) - Vector(joints['UpperArm.' + side])
        lower = Vector(joints['Hand.' + side]) - Vector(joints['Forearm.' + side])
        angle_upper = math.atan2(abs(upper.z), -upper.y)
        angle_lower = math.atan2(abs(lower.z), -lower.y)
        swing = .32 * sign * wave if kind == 'Walk' else 0
        set_rotation('UpperArm.' + side, [([1, 0, 0], sign * (angle_upper - .14)), ([0, 0, 1], -swing * .72)])
        set_rotation('Forearm.' + side, [([1, 0, 0], sign * (angle_lower - angle_upper)), ([0, 0, 1], .10)])
        knee = -.52 * max(0, -sign * wave) if kind == 'Walk' else 0
        set_rotation('UpperLeg.' + side, [([0, 0, 1], swing)])
        set_rotation('LowerLeg.' + side, [([0, 0, 1], knee)])
        set_rotation('Foot.' + side, [([0, 0, 1], -swing - knee)])
    set_rotation('Chest', [([0, 1, 0], .018 * wave if kind == 'Walk' else .009 * wave)])
    if kind == 'LookAround':
        set_rotation('Head', [([0, 1, 0], .55 * wave), ([0, 0, 1], .10 * math.sin(phase * math.tau * 2))])
    elif kind == 'HeadTurn':
        set_rotation('Head', [([0, 1, 0], .65), ([0, 0, 1], .15)])
    elif kind == 'RaisedArms':
        for side, sign in [('R', 1), ('L', -1)]:
            set_rotation('UpperArm.' + side, [([1, 0, 0], -sign * 1.15)])
            set_rotation('Forearm.' + side, [([0, 0, 1], .85)])
    elif kind == 'Crouch':
        for side in ['R', 'L']:
            set_rotation('UpperLeg.' + side, [([0, 0, 1], .70)])
            set_rotation('LowerLeg.' + side, [([0, 0, 1], -1.10)])
            set_rotation('Foot.' + side, [([0, 0, 1], .40)])
        set_rotation('Spine', [([0, 0, 1], -.20)])
    bpy.context.view_layer.update()
    sole_indices = role_indices.get('boot', []) + role_indices.get('foot', [])
    if ground and sole_indices:
        transforms = {n: arm.pose.bones[n].matrix @ inverse_bind[n] for n in bone_names}
        minimum = min(sum((transforms[n] @ source_vertices[i]).z * w for n, w in weights_by_vertex[i])
                      for i in sole_indices)
        correction = -minimum
        if abs(correction) > .45:
            raise RuntimeError(f'Excessive root floor correction {correction} in {kind}')
        arm.pose.bones['Hips'].location = rest_rotation['Hips'].inverted() @ Vector((0, 0, correction))
        bpy.context.view_layer.update()

audit = {'blender': bpy.app.version_string, 'sourceSha256': sha(source_path), 'manifestSha256': sha(manifest_path),
         'sharedMeshInstancesMadeSingleUser': shared_mesh_instances,
         'frame': '+X forward, +Y up, +Z anatomical right in glTF', 'restJointsGltf': joints,
         'bones': len(bone_names), 'parts': part_audit, 'vertices': len(body.data.vertices),
         'triangles': sum(len(p.vertices) - 2 for p in body.data.polygons), 'materials': len(body.data.materials),
         'maxInfluences': max(len(w) for w in weights_by_vertex), 'clips': ['Idle', 'Walk', 'LookAround'],
         'limitations': ['Procedural baked motion; no combat/reload or weapon grip claim',
                         'Global sole-height correction is not foot contact IK or horizontal foot locking',
                         'No facial animation bones', 'Workbench pose images qualify geometry, not PBR materials'],
         'deformationSamples': []}

edges = [(e.vertices[0], e.vertices[1], (source_vertices[e.vertices[0]] - source_vertices[e.vertices[1]]).length)
         for e in body.data.edges if (source_vertices[e.vertices[0]] - source_vertices[e.vertices[1]]).length > 1e-5]
seam_buckets = {}
for i in role_indices.get('upper_body', []):
    key = tuple(round(c, 5) for c in source_vertices[i])
    seam_buckets.setdefault(key, []).append(i)
seam_pairs = [(ids[0], index) for ids in seam_buckets.values() for index in ids[1:]
              if tags[ids[0]].value != tags[index].value]
edge_faces = {}
for polygon in body.data.polygons:
    for edge in polygon.edge_keys:
        key = tuple(sorted(edge))
        edge_faces[key] = edge_faces.get(key, 0) + 1
shared_loops = []
for seam in manifest.get('sharedSeams', []):
    if 'indices' not in seam:
        continue
    indices = [source_lookup[(seam['mesh'], index)] for index in seam['indices']]
    pairs = [(indices[i], indices[(i + 1) % len(indices)]) for i in range(len(indices))]
    counts = [edge_faces.get(tuple(sorted(pair)), 0) for pair in pairs]
    if not pairs or any(count != 2 for count in counts):
        raise RuntimeError(f'Expected welded two-face armhole boundary: {seam["name"]}: {counts}')
    shared_loops.append({'name': seam['name'], 'pairs': pairs, 'adjacentFaceCounts': counts})
if not shared_loops:
    raise RuntimeError('Production manifest must identify the connected armhole boundaries')
samples = [('Rest', 0), ('Idle', .25), ('Walk', .25), ('Walk', .75), ('LookAround', .25), ('RaisedArms', 0), ('Crouch', 0), ('HeadTurn', 0)]
for kind, phase in samples:
    if kind == 'Rest':
        reset_pose()
        bpy.context.view_layer.update()
    else:
        pose(kind, phase)
    evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    vertices = [v.co.copy() for v in mesh.vertices]
    if len(vertices) != len(source_vertices) or any(not math.isfinite(c) for v in vertices for c in v):
        raise RuntimeError('Nonfinite deformation or unexpected vertex count')
    lengths = sorted(((vertices[a] - vertices[b]).length / length, a, b) for a, b, length in edges)
    seam_error = max(((vertices[a] - vertices[b]).length for a, b in seam_pairs), default=0)
    if seam_error > .0001:
        raise RuntimeError(f'Upper-body shared-position seam separated by {seam_error}m')
    protected_error = 0
    transform = arm.pose.bones['Head'].matrix @ inverse_bind['Head']
    for i in role_indices.get('head', []):
        protected_error = max(protected_error, (vertices[i] - transform @ source_vertices[i]).length)
    if protected_error > 1e-5:
        raise RuntimeError('Protected head component detached from head transform')
    regions = {}
    for role, indices in role_indices.items():
        regions[role] = {'min': [min(vertices[i][k] for i in indices) for k in range(3)],
                         'max': [max(vertices[i][k] for i in indices) for k in range(3)]}
    sample = {'pose': kind, 'phase': phase, 'headRigidErrorM': protected_error,
              'sharedUpperBodySeamPairs': len(seam_pairs), 'maxSeamGapM': seam_error,
              'maxEdgeStretch': lengths[-1][0] if lengths else None,
              'p99EdgeStretch': lengths[int((len(lengths) - 1) * .99)][0] if lengths else None,
              'regionsBlender': regions}
    sample['sharedIndexedBoundaries'] = [
        {'name': loop['name'], 'boundaryEdges': len(loop['pairs']), 'adjacentFaceCounts': loop['adjacentFaceCounts'],
         'maxEdgeStretch': max((vertices[a] - vertices[b]).length / (source_vertices[a] - source_vertices[b]).length
                               for a, b in loop['pairs'])} for loop in shared_loops]
    underarm_edges = [(a, b, length) for a, b, length in edges
                      if part_audit[tags[a].value]['name'] == 'Mesh_TunicBodyAndSleeves'
                      and min(source_vertices[a].z, source_vertices[b].z) > 1.19
                      and max(abs(source_vertices[a].y), abs(source_vertices[b].y)) > .14]
    underarm_ratios = sorted((vertices[a] - vertices[b]).length / length for a, b, length in underarm_edges)
    sample['underarmStrain'] = {'edges': len(underarm_ratios), 'max': max(underarm_ratios),
                               'p95': underarm_ratios[int((len(underarm_ratios) - 1) * .95)],
                               'p99': underarm_ratios[int((len(underarm_ratios) - 1) * .99)]}
    # Retain the previous pass's exact tiny underside edge as a fixed regression probe.
    probe_rest = [Vector((0, .225, 1.26)), Vector((0, .225170821, 1.251744032))]
    probe_ids = [min(role_indices['upper_body'], key=lambda i: (source_vertices[i] - p).length) for p in probe_rest]
    if max((source_vertices[i] - p).length for i, p in zip(probe_ids, probe_rest)) > 1e-5:
        raise RuntimeError('Underarm regression probe no longer matches source topology')
    a, b = probe_ids
    sample['previousWorstUnderarmEdge'] = {'sourceVertexIndices': [vertex_tags[a].value, vertex_tags[b].value],
                                         'restLengthM': (source_vertices[a] - source_vertices[b]).length,
                                         'posedLengthM': (vertices[a] - vertices[b]).length,
                                         'stretch': (vertices[a] - vertices[b]).length / (source_vertices[a] - source_vertices[b]).length,
                                         'weights': [weights_by_vertex[a], weights_by_vertex[b]]}
    if lengths:
        ratio, a, b = lengths[-1]
        sample['worstEdge'] = {'stretch': ratio, 'component': part_audit[tags[a].value]['name'],
                               'sourceVertexIndices': [vertex_tags[a].value, vertex_tags[b].value],
                               'weights': [weights_by_vertex[a], weights_by_vertex[b]],
                               'restLengthM': (source_vertices[a] - source_vertices[b]).length,
                               'posedLengthM': (vertices[a] - vertices[b]).length,
                               'rest': [list(source_vertices[a]), list(source_vertices[b])],
                               'posed': [list(vertices[a]), list(vertices[b])]}
    if kind == 'Rest':
        sample['restVertexErrorM'] = max((a - b).length for a, b in zip(vertices, source_vertices))
        if sample['restVertexErrorM'] > 1e-5:
            raise RuntimeError('Bind pose changed source geometry')
    audit['deformationSamples'].append(sample)
    evaluated.to_mesh_clear()

clip_references = {}
for kind in audit['clips']:
    for phase in [0, .25, .75]:
        pose(kind, phase)
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        clip_references[f'{kind}__{phase}'] = np.asarray([tuple(v.co) for v in mesh.vertices], dtype=np.float32)
        evaluated.to_mesh_clear()
np.savez_compressed(out / 'expected-clip-poses.npz', **clip_references)
actions = []
for kind in audit['clips']:
    arm.animation_data_create()
    action = bpy.data.actions.new(kind)
    arm.animation_data.action = action
    for frame in range(1, 62):
        scene.frame_set(frame)
        pose(kind, (frame - 1) / 60)
        for bone in arm.pose.bones:
            bone.keyframe_insert('rotation_quaternion', frame=frame)
            bone.keyframe_insert('location', frame=frame)
    action.use_fake_user = True
    actions.append(action)
audit['bakedClipChecks'] = []
for action in actions:
    arm.animation_data.action = action
    for phase in [0, .25, .75]:
        scene.frame_set(1 + round(phase * 60))
        bpy.context.view_layer.update()
        evaluated = body.evaluated_get(bpy.context.evaluated_depsgraph_get())
        mesh = evaluated.to_mesh()
        actual = np.asarray([tuple(v.co) for v in mesh.vertices], dtype=np.float32)
        expected = clip_references[f'{action.name}__{phase}']
        error = float(np.linalg.norm(actual - expected, axis=1).max())
        evaluated.to_mesh_clear()
        audit['bakedClipChecks'].append({'clip': action.name, 'phase': phase, 'maxVertexErrorM': error})
        if error > .00002:
            raise RuntimeError(f'Baked {action.name} differs from procedural pose: {error}m')
arm.animation_data.action = None
reset_pose()
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
body.select_set(True)
arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.wm.save_as_mainfile(filepath=str(out / 'Garrison.blend'))
bpy.ops.export_scene.gltf(filepath=str(out / 'Garrison-rigged.glb'), export_format='GLB', use_selection=True,
                          export_animations=True, export_animation_mode='ACTIONS', export_skins=True)
audit['outputGlbSha256'] = sha(out / 'Garrison-rigged.glb')
audit['blendSha256'] = sha(out / 'Garrison.blend')
(out / 'rig-audit.json').write_text(json.dumps(audit, indent=2), encoding='utf-8')

if args.render or args.underarm_review:
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.background_type = 'WORLD'
    scene.world.color = (.16, .18, .20)
    scene.render.resolution_x, scene.render.resolution_y = 640, 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    cam_data = bpy.data.cameras.new('RigReview')
    cam = bpy.data.objects.new('RigReview', cam_data)
    bpy.context.collection.objects.link(cam)
    scene.camera = cam
    cam_data.type, cam_data.ortho_scale = 'ORTHO', 2.05
    views = {'front': ((4, 0, 1.05), (0, 0, .92)), 'quarter': ((3.5, -2.5, 1.9), (0, 0, .95)),
             'profile': ((0, -4, 1.05), (0, 0, .92))}
    for kind, phase in [('Idle', 0), ('Walk', .25), ('RaisedArms', 0), ('Crouch', 0), ('HeadTurn', 0)]:
        pose(kind, phase)
        for label in (['front', 'quarter'] if kind in {'Idle', 'RaisedArms'} else ['profile']):
            position, target = views[label]
            cam.location = position
            cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
            scene.render.filepath = str(out / f'{kind}-{label}.png')
            bpy.ops.render.render(write_still=True)
    if args.underarm_review:
        cam_data.ortho_scale = .78
        for kind, phase in [('Idle', .25), ('Walk', .25), ('RaisedArms', 0)]:
            pose(kind, phase)
            for label, position in [('front', (3, 0, 1.34)), ('quarter', (2.8, -1.6, 1.48))]:
                cam.location = position
                cam.rotation_euler = (Vector((0, 0, 1.32)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
                scene.render.filepath = str(out / f'Underarm-{kind}-{label}.png')
                bpy.ops.render.render(write_still=True)
print('PRODUCTION_RIG_COMPLETE', json.dumps({'out': str(out), 'sourceSha256': audit['sourceSha256'],
                                           'outputGlbSha256': audit['outputGlbSha256'], 'clips': audit['clips']}))
