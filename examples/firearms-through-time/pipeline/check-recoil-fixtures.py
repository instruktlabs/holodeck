# Independent check of game/recoil-fixtures-v1.json: a second implementation of the recoil v1 hash, PRNG, kicks and aim steps
# (docs/recoil-v1.md) written from the profile JSON, not from game/recoil.mjs. Run: uv run python -I pipeline/check-recoil-fixtures.py
import json, math, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
profiles = json.loads((root / 'game/recoil-profiles-v1.json').read_text(encoding='utf-8'))['profiles']
fixtures = json.loads((root / 'game/recoil-fixtures-v1.json').read_text(encoding='utf-8'))
M = 0xFFFFFFFF


def fnv1a32(text):
    h = 0x811C9DC5
    for b in text.encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & M
    return h


def mulberry32(seed):
    a = seed & M
    while True:
        a = (a + 0x6D2B79F5) & M
        t = ((a ^ (a >> 15)) * (a | 1)) & M
        t ^= (t + ((t ^ (t >> 7)) * (t | 61))) & M
        yield (t ^ (t >> 14)) & M


def kick(profile_id, index, session_id, shot_id):
    p = profiles[profile_id]
    r = p['response']
    rows = r['pattern']['value']
    row = rows[min(max(0, index), len(rows) - 1)]
    seed = fnv1a32(f"{fnv1a32(session_id)}|{shot_id}|{p['revision']}|weapon-response")
    draws = mulberry32(seed)
    a = 2 * next(draws) / 4294967296 - 1
    b = 2 * next(draws) / 4294967296 - 1
    base = r['baseKick']['value']
    return [base * row[0] * (1 + r['variation']['pitchScale']['value'] * a), base * (row[1] + r['variation']['yawScale']['value'] * b)]


failures = []


def check(ok, label):
    if not ok:
        failures.append(label)


for v in fixtures['hashVectors']:
    check(fnv1a32(v['text']) == v['fnv1a32'], f"hash {v['text']!r}")
for v in fixtures['prngVectors']:
    draws = mulberry32(v['seed'])
    check([next(draws) for _ in v['raw']] == v['raw'], f"prng seed {v['seed']}")
for s in fixtures['otherSession']['shots']:
    got = kick(fixtures['otherSession']['profile'], s['index'], fixtures['otherSession']['sessionId'], s['shotId'])
    check(all(abs(g - e) <= 1e-12 for g, e in zip(got, s['kick'])), f"other session {s['shotId']}")

worst = 0.0
for pid, sc in fixtures['scenarios'].items():
    r = profiles[pid]['response']
    tau, rise, keep, reset = r['recovery']['value'], r['rise']['value'], r['residual']['value'], r['resetAfter']['value']
    pending, view, aim = [0.0, 0.0], [0.0, 0.0], [0.0, 0.0]
    index, last, now = -1, None, 0
    shots = {s['ms']: s for s in sc['shots']}
    samples = {s['ms']: s for s in sc['samples']}
    for t in sorted(set(shots) | set(samples)):
        # Split every gap into 1 ms frames, unlike the generator's single step, to show the aim does not depend on the frame split.
        for _ in range(t - now):
            a, b, c = math.exp(-0.001 / tau), math.exp(-0.001 / rise), tau / (tau - rise)
            for i in range(2):
                u = pending[i]
                v = view[i] * b + u * c * (a - b)
                aim[i] += v - view[i]
                pending[i], view[i] = u * a, v
        now = t
        if t in samples:
            err = max(abs(g - e) for g, e in zip(aim, samples[t]['aim']))
            worst = max(worst, err)
            check(err <= 1e-9, f"{pid} aim at {t} ms off by {err:.3g} deg")
        if t in shots:
            shot = shots[t]
            index = 0 if last is None or (t - last) / 1000 >= reset else index + 1
            last = t
            check(index == shot['index'], f"{pid} pattern index at {t} ms")
            k = kick(pid, index, sc['sessionId'], shot['shotId'])
            check(all(abs(g - e) <= 1e-12 for g, e in zip(k, shot['kick'])), f"{pid} kick at {t} ms")
            check(shot['seedKey'] == f"{fnv1a32(sc['sessionId'])}|{shot['shotId']}|{profiles[pid]['revision']}|weapon-response", f"{pid} seed key at {t} ms")
            for i in range(2):
                pending[i] += (1 - keep) * k[i]
                view[i] -= keep * k[i]

if failures:
    print('FAIL', len(failures), *failures[:12], sep='\n')
    sys.exit(1)
print(f"recoil fixtures reproduced independently: {len(fixtures['hashVectors'])} hashes, {len(fixtures['prngVectors'])} PRNG seeds, "
      f"{sum(len(s['shots']) for s in fixtures['scenarios'].values())} kicks, {sum(len(s['samples']) for s in fixtures['scenarios'].values())} aim samples "
      f"(1 ms frames; worst aim difference {worst:.2e} deg)")
