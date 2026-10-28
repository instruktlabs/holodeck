"""Normalize the artist's anatomical manifest into the strict Blender rig contract."""
import argparse
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--input', required=True)
parser.add_argument('--source', required=True)
parser.add_argument('--out', required=True)
parser.add_argument('--overrides')
args = parser.parse_args()
path = Path(args.input)
author = json.loads(path.read_text(encoding='utf-8-sig'))
joints = author['jointCentersWorld']
result = {'schemaVersion': 1, 'sourceManifestSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
          'glbSha256': hashlib.sha256(Path(args.source).read_bytes()).hexdigest(),
          'joints': {key.lower(): joints[key] for key in ['Root', 'Hips', 'Spine', 'Chest', 'Neck', 'Head']},
          'parts': [], 'sharedSeams': author['sharedSeams']}
result['joints']['headTip'] = author['terminalBoneTailsWorld']['Head']
for side, prefix in [('R', 'right'), ('L', 'left')]:
    for key in ['Shoulder', 'Elbow', 'Wrist', 'Hip', 'Knee', 'Ankle', 'Toe']:
        result['joints'][prefix + key] = joints[key + '.' + side]
    result['joints'][prefix + 'HandTip'] = author['terminalBoneTailsWorld']['Wrist.' + side]
roles = {'torsoWithSharedSleeves': 'upper_body', 'headRigid': 'head', 'pelvis': 'hips',
         'belt': 'hips', 'hipAccessory': 'hips', 'collar': 'chest', 'torsoDecoration': 'upper_body',
         'leg': 'leg', 'boot': 'boot', 'skirt': 'skirt', 'sleeveTrim': 'sleeve',
         'forearmEquipment': 'forearm', 'glove': 'glove', 'bootCalf': 'lower_leg', 'bootFoot': 'foot'}
for part in author['parts']:
    name, separator, side = part['role'].partition('.')
    rule = {'mesh': part['name'], 'role': roles[name]}
    if separator:
        rule['side'] = side
    if name == 'skirt':
        rule.update(hemY=.71, waistY=1.01)
    if name == 'torsoWithSharedSleeves':
        rule['vertexRegions'] = author['vertexRegions']
    result['parts'].append(rule)
if args.overrides:
    overrides_path = Path(args.overrides)
    overrides = json.loads(overrides_path.read_text(encoding='utf-8-sig'))
    result['overridesSha256'] = hashlib.sha256(overrides_path.read_bytes()).hexdigest()
    if overrides.get('sourceSha256') != result['glbSha256']:
        raise RuntimeError('Rig override source hash mismatch')
    for override in overrides['parts']:
        matches = [part for part in result['parts'] if part['mesh'] == override['mesh']]
        if len(matches) != 1:
            raise RuntimeError('Override must resolve exactly one named part')
        matches[0].update(override)
Path(args.out).parent.mkdir(parents=True, exist_ok=True)
Path(args.out).with_suffix('.author.json').write_bytes(path.read_bytes())
Path(args.out).write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps({'parts': len(result['parts']), 'sourceSha256': result['glbSha256']}))
