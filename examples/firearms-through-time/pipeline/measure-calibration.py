"""Measure fixed chart interiors, not UI/background pixels or edge antialiasing."""
from pathlib import Path
from PIL import Image, ImageStat
import json, hashlib
ROOT=Path(__file__).resolve().parents[1]
names=['dark','gray-low','gray-18-percent','gray-high','red','blue','green','warm-white']
points=[(x,y) for y in [303,417] for x in [489,590,690,790]]
files={'nativeInitial':'calibration-native-baseline.png','nativeCalibrated':'calibration-native-ev009.png','webgpu':'calibration-holodeck-chart-webgpu.png','webgl':'calibration-holodeck-chart-webgl.png'}
samples={};hashes={}
for key,name in files.items():
    path=ROOT/'evidence'/name;im=Image.open(path).convert('RGB');assert im.size==(1280,720)
    hashes[key]=hashlib.sha256(path.read_bytes()).hexdigest()
    samples[key]=[ImageStat.Stat(im.crop((x-10,y-10,x+11,y+11))).mean for x,y in points]
def diffs(a,b):return [[abs(x-y) for x,y in zip(c,d)] for c,d in zip(samples[a],samples[b])]
initial=diffs('nativeInitial','webgpu');final=diffs('nativeCalibrated','webgpu')
result={'schemaVersion':1,'method':'Mean sRGB code values in 21x21 pixel patches; not linear radiance or perceptual DeltaE. Matched camera, white directional light1, fill0, bloom0; UE EV+0.09, Holodeck exposure1.','patches':names,'sampleCenters':points,'files':files,'hashes':hashes,'samples':samples,'initialAbsoluteDifference':initial,'calibratedAbsoluteDifference':final,'grayMaxBefore':max(max(v) for v in initial[:4]),'grayMaxAfter':max(max(v) for v in final[:4]),'allPatchMaxAfter':max(max(v) for v in final),'browserBackendMaxDifference':max(max(v) for v in diffs('webgpu','webgl')),'limits':['Eight flat roughness1 dielectric patches, frontal light, one exposure; not a full BRDF/metal/reflection/HDR calibration.','Saturated red retains a tone-response difference; source values were not altered to compensate.','Native chart was captured in Unreal game mode using editor binaries; packaged updated exhibit is verified separately.']}
assert result['grayMaxAfter']<result['grayMaxBefore']
assert result['grayMaxAfter']<3
assert result['browserBackendMaxDifference']<1
(ROOT/'evidence/calibration-measurements.json').write_text(json.dumps(result,indent=2))
print(json.dumps({k:result[k] for k in ['grayMaxBefore','grayMaxAfter','allPatchMaxAfter','browserBackendMaxDifference']}))
