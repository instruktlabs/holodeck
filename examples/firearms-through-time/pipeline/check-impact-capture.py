"""Read-only color evidence for the fixed close-up native steel fixture.

This checks that a formerly dark streak region contains warm pixels. It does not
establish physical fidelity, production quality, motion quality or performance.
"""
from pathlib import Path
from PIL import Image
import hashlib,json,sys

source=Path(sys.argv[1])
output=Path(sys.argv[2]) if len(sys.argv)>2 else Path('evidence/range-v9-impact-pixels.json')
image=Image.open(source).convert('RGB')
assert image.size==(1280,720), 'The qualified camera/ROI expects 1280x720'
box=(480,400,650,510)
warm=[]
for y in range(box[1],box[3]):
    for x in range(box[0],box[2]):
        r,g,b=image.getpixel((x,y))
        if r>90 and r>g+20 and g>b+10: warm.append((x,y))
result={'ok':len(warm)>=5,'source':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'region':box,'warmPixels':len(warm),'threshold':'r>90, r>g+20, g>b+10; at least5 pixels','scope':'Fixed close-up fixture warm-streak presence only; image manually inspected separately'}
output.write_text(json.dumps(result,indent=2))
print(json.dumps(result))
sys.exit(0 if result['ok'] else 1)
