"""Generate an SVG review plate and engine-neutral placement study from layout.json.
Standard library only. This does not write a live Holodeck world or engine scene.
"""
from pathlib import Path
import json, math, hashlib
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
cfg = json.loads((ROOT / 'layout.json').read_text())
banks = cfg['banks']; count = cfg['lanes_per_bank']; w = cfg['width']; depth = cfg['depth']
assert banks and isinstance(count, int) and count > 0
assert len({b['id'] for b in banks}) == len(banks)
span = len(banks)*cfg['bank_width'] + (len(banks)-1)*cfg['bank_gap']
assert span <= w and cfg['collection_count'] % cfg['display_groups'] == 0
assert cfg['zones']['gallery'][1] == cfg['zones']['concourse'][0]
assert cfg['zones']['concourse'][1] == cfg['zones']['booths'][0]
margin = (w-span)/2
placements=[]
for bi,b in enumerate(banks):
    bx=margin+bi*(cfg['bank_width']+cfg['bank_gap'])
    for li in range(count):
        lane=f"{b['id']}-{li+1:02}"
        x=bx+(li+.5)*cfg['bank_width']/count
        placements.append({'id':lane,'kind':'lane','bank':b['id'],'x':x,'y':0,'z':0,
                           'width':cfg['bank_width']/count,'length':depth})
        placements.append({'id':lane+'-station','kind':'station','lane_id':lane,'x':x,'y':-4,'z':0})
        for ti,y in enumerate([30,70,120,190,250]):
            placements.append({'id':lane+f'-target-{ti+1}','kind':'target-marker','lane_id':lane,'x':x,'y':y,'z':0})
for i in range(cfg['collection_count']):
    placements.append({'id':f'collection-slot-{i+1:02}','kind':'display-slot','catalog_assignment':None,
        'x':cfg['wall_margin']+(i+.5)*(w-2*cfg['wall_margin'])/cfg['collection_count'],
        'y':cfg['collection_wall_y'],'z':0,'group':i//(cfg['collection_count']//cfg['display_groups'])+1})
for stair in cfg.get('upper_level',{}).get('stairs',[]):
    placements.append({'id':stair['id'],'kind':'stair-reservation','x':stair['x'],'y':stair['start_y'],'z':stair['bottom_z'],'end_y':stair['end_y'],'end_z':stair['top_z'],'width':stair['width']})
if 'upper_level' in cfg:
    d=cfg['upper_level']['deck']
    placements.append({'id':'upper-viewing-deck','kind':'deck-reservation','x':d['x'][0],'y':d['y'][0],'z':d['z'],'extent_x':d['x'][1]-d['x'][0],'extent_y':d['y'][1]-d['y'][0]})
assert len({p['id'] for p in placements})==len(placements)
lanes={p['id']:p for p in placements if p['kind']=='lane'}
for p in placements:
    assert all(math.isfinite(p[k]) for k in ('x','y','z'))
    if 'lane_id' in p:
        assert p['lane_id'] in lanes
        assert abs(p['x']-lanes[p['lane_id']]['x'])<1e-9
    assert -5<=p['x']<=w+5 and -40<=p['y']<=depth
manifest={'schema':cfg['schema'],'revision':cfg['revision'],'status':cfg['status'],
          'coordinates':cfg['coordinates'],'units':cfg['units'],'placements':placements}
(ROOT/'placements.json').write_text(json.dumps(manifest,indent=2)+'\n')
parts=['<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1500" viewBox="0 0 2000 1500">',
 '<style>text{font-family:DejaVu Sans,sans-serif;fill:#e8edf2}.small{font-size:15px}.body{font-size:21px}.sub{font-size:17px;fill:#a8b8c9}.title{font-size:39px;font-weight:bold}.h{font-size:26px;font-weight:bold}</style>',
 '<rect width="2000" height="1500" fill="#111c28"/>']
def rect(x,y,w,h,fill,stroke=None,r=0):
    parts.append(f'<rect x="{x:.2f}" y="{y:.2f}" width="{w:.2f}" height="{h:.2f}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}"' if stroke else '')+'/>')
def line(x1,y1,x2,y2,c='#63788d',dash=None):
    parts.append(f'<line x1="{x1:.2f}" y1="{y1:.2f}" x2="{x2:.2f}" y2="{y2:.2f}" stroke="{c}"'+(f' stroke-dasharray="{dash}"' if dash else '')+'/>')
def text(x,y,s,cl='body',color=None):
    parts.append(f'<text x="{x}" y="{y}" class="{cl}"'+(f' style="fill:{color}"' if color else '')+f'>{escape(str(s))}</text>')
def circle(x,y,r,c): parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r}" fill="none" stroke="{c}" stroke-width="1.5"/>')
text(70,70,'FIREARMS THROUGH TIME','title')
text(70,108,'SPATIAL STUDY 02   /   one environment · two facing experiences','sub')
text(1500,65,'PROPOSED · NOT APPROVED','sub')
text(1500,96,'Python → layout data → SVG','sub')
scale=3.5; ox=90; oy=190
X=lambda x:ox+x*scale
Y=lambda y:oy+(depth-y)*scale
text(90,145,'A  /  RANGE + COLLECTION CAMPUS','h')
rect(X(0),Y(depth),w*scale,(depth+40)*scale,'#192a36','#697e8c')
for y in range(0,281,20): line(X(0),Y(y),X(w),Y(y),'#263c49')
for x in range(0,241,20): line(X(x),Y(depth),X(x),Y(-40),'#263c49')
text(X(8),Y(270),'QUARRY LANDSCAPE / VISUAL ENCLOSURE','small')
for bi,b in enumerate(banks):
    bx=margin+bi*(cfg['bank_width']+cfg['bank_gap']); bw=cfg['bank_width']
    rect(X(bx),Y(260),bw*scale,260*scale,'#1c303b',b['color'])
    for li in range(1,count): line(X(bx+li*bw/count),Y(260),X(bx+li*bw/count),Y(0),'#3a4a54')
    for p in placements:
        if p['kind']=='target-marker' and p['lane_id'].startswith(b['id']+'-'):
            if b['id']=='paper':rect(X(p['x'])-3,Y(p['y'])-4,6,8,'none',b['color'])
            elif b['id']=='moving':line(X(p['x'])-5,Y(p['y']),X(p['x'])+5,Y(p['y']),b['color']);circle(X(p['x']),Y(p['y']),2.5,b['color'])
            else:circle(X(p['x']),Y(p['y']),3,b['color'])
    for li in range(count):
        x=bx+(li+.5)*bw/count
        rect(X(x)-6,Y(-1),12,22,'#273d4b',b['color'])
        rect(X(x)-3,Y(-2),6,4,b['color'])
    text(X(bx)+4,Y(263),f'{bi+1:02}', 'small',b['color'])
# shared spine and gallery, same coordinate scale
rect(X(0),Y(-8),w*scale,17*scale,'#31424c','#b5c1c7')
text(X(47),Y(-18),'SHARED CONCOURSE · BROWSE ↔ CONFIGURE ↔ PLAY','small')
rect(X(0),Y(-25),w*scale,15*scale,'#514536','#c8a878')
for p in placements:
    if p['kind']=='display-slot': rect(X(p['x'])-4.7,Y(p['y'])-3,9.4,6,'#deb87e')
text(X(40),Y(-31),'CONTINUOUS COLLECTION WALL + CHRONOLOGICAL ART','small')
for stair in cfg.get('upper_level',{}).get('stairs',[]):
    sx=X(stair['x']-stair['width']/2); sy=Y(stair['end_y']); sh=(stair['end_y']-stair['start_y'])*scale
    rect(sx,sy,stair['width']*scale,sh,'#65522b','#edca82')
    for t in range(1,9): line(sx,sy+sh*t/9,sx+stair['width']*scale,sy+sh*t/9,'#edca82')
    text(sx-6,sy-9,'UP','small','#edca82')
line(X(0),Y(0)-5,X(w),Y(0)-5,'#edca82','5 4')
text(90,1352,'ENTRY / RETURN', 'sub');text(510,1352,'60 display slots · catalog assignments pending','sub')
line(X(0),Y(280)-5,X(w),Y(280)-5)
text(420,Y(280)-12,'240 virtual metres (proposal)','small')
# right side explanatory plate
rx=1040
text(rx,157,'B  /  CONFIGURABLE PRACTICE BANKS','h')
for i,b in enumerate(banks):
    y=205+i*46;rect(rx,y-20,27,27,b['color'],r=4)
    text(rx+44,y,f"{i+1:02}   {b['label']}")
    text(rx+480,y,f'{count} stations','sub')
text(rx,510,f'{len(banks)*count} stations shown as an option, not a fixed requirement.','sub')
text(rx,542,'All stations access the full collection. Activity ≠ era restriction.','sub')
text(rx,605,'C  /  COLLECTION WALL — EXPERIENCE','h')
text(rx,643,'One continuous wall faces the range across a shared concourse.','sub')
text(rx,675,'Exhibits + artwork carry the historical progression; controls stay modern.','sub')
for row in range(2):
    for col in range(5):
        idx=row*5+col;xx=rx+col*174;yy=710+row*118
        rect(xx,yy,159,100,'#3d3933','#b3946c',4)
        text(xx+10,yy+23,f'GROUP {idx+1:02}','small')
        for s in range(6):rect(xx+9+s*24,yy+36,18,23,'#e0bd88')
        rect(xx+9,yy+68,138,20,'#7b766e')
text(rx,972,'EARLIEST  →  historical sequence  →  CONTEMPORARY','sub')
text(rx,1004,'Groups are display modules, not approved era/date classifications.','sub')
text(rx,1065,'D  /  STATION INTERFACE','h')
for i,s in enumerate(['Choose exhibit / configuration','Select target type + arrangement','Set game distance, motion + sequence','Preview → start → results → reset']):
    text(rx,1107+i*32,f'{i+1}.  {s}','body')
text(rx,1270,'ALIGNMENT DECISIONS','h')
for i,s in enumerate(['Lane count and bank mix · gallery width and seating',
                      'Side stairs → viewing deck above booths (dashed gold)',
                      'Visual style and artwork references before bible approval']):
    text(rx,1306+i*29,s,'sub')
line(70,1420,1930,1420)
text(70,1455,'Virtual spatial proposal • Plan uses uniform scale • Right-hand wall diagram is schematic • Targets are illustrative placeholders','small')
parts.append('</svg>')
svg='\n'.join(parts)+'\n';ET.fromstring(svg)
(ROOT/'range-campus-01.svg').write_text(svg)
report={'status':'layout-data-and-svg-validated','lanes':len(lanes),'stations':sum(p['kind']=='station' for p in placements),
 'display_slots':sum(p['kind']=='display-slot' for p in placements),'unique_ids':len(placements),
 'checks':['bank bounds','unique IDs','station and target lane alignment','finite coordinates','contiguous zones','valid SVG XML'],
 'not_validated':['runtime import','3D visibility','walkability','art fidelity','performance','user acceptance'],
 'input_sha256':hashlib.sha256((ROOT/'layout.json').read_bytes()).hexdigest()}
(ROOT/'validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
