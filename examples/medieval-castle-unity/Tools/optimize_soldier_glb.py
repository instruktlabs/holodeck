"""Exact-geometry two-material glTF derivative, then optional indexed LODs.

Flat PBR factors become linear COLOR_0 plus a tiny linear metallic/roughness
palette. Textured mail and its UVs remain separate and unchanged. No Blender
roundtrip or normal recalculation is involved. Original GLB remains authoritative.
"""
import argparse, copy, hashlib, json, struct, zlib
from pathlib import Path
import numpy as np

TYPES={5120:np.dtype('i1'),5121:np.dtype('u1'),5122:np.dtype('<i2'),5123:np.dtype('<u2'),5125:np.dtype('<u4'),5126:np.dtype('<f4')}
WIDTHS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
class Glb:
    def __init__(self, path):
        raw=Path(path).read_bytes(); magic,version,length=struct.unpack_from('<III',raw)
        assert magic==0x46546c67 and version==2 and length==len(raw)
        self.doc=None; self.bin=None; offset=12
        while offset<len(raw):
            size,kind=struct.unpack_from('<II',raw,offset);offset+=8;data=raw[offset:offset+size];offset+=size
            if kind==0x4e4f534a:self.doc=json.loads(data)
            elif kind==0x004e4942:self.bin=bytearray(data)
        assert self.doc and self.bin is not None and len(self.doc['buffers'])==1
    def array(self, index):
        a=self.doc['accessors'][index];assert 'sparse' not in a
        v=self.doc['bufferViews'][a['bufferView']];dt=TYPES[a['componentType']];w=WIDTHS[a['type']]
        offset=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',dt.itemsize*w)
        return np.ndarray((a['count'],w),dt,self.bin,offset=offset,strides=(stride,dt.itemsize)).copy()
    def view(self, data, target=None):
        self.bin.extend(b'\0'*((-len(self.bin))%4));offset=len(self.bin);self.bin.extend(data)
        view={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
        if target:view['target']=target
        self.doc.setdefault('bufferViews',[]).append(view);return len(self.doc['bufferViews'])-1
    def accessor(self, data, semantic):
        data=np.ascontiguousarray(data);component=next(k for k,v in TYPES.items() if v==data.dtype)
        width=data.shape[1] if data.ndim>1 else 1
        a={'bufferView':self.view(data.tobytes(),34963 if semantic=='indices' else 34962),'componentType':component,'count':len(data),'type':next(k for k,v in WIDTHS.items() if v==width)}
        if semantic=='POSITION':a.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())
        self.doc['accessors'].append(a);return len(self.doc['accessors'])-1
    def write(self,path):
        # Compact only referenced views/accessors; preserve animation and skin payloads.
        used=set()
        for mesh in self.doc['meshes']:
            for p in mesh['primitives']:
                used.update(p['attributes'].values());used.add(p['indices'])
                for target in p.get('targets',[]):used.update(target.values())
        for skin in self.doc.get('skins',[]):
            if 'inverseBindMatrices' in skin:used.add(skin['inverseBindMatrices'])
        for anim in self.doc.get('animations',[]):
            for sampler in anim['samplers']:used.update((sampler['input'],sampler['output']))
        remap={old:new for new,old in enumerate(sorted(used))}
        for mesh in self.doc['meshes']:
            for p in mesh['primitives']:
                p['attributes']={k:remap[v] for k,v in p['attributes'].items()};p['indices']=remap[p['indices']]
                for target in p.get('targets',[]):
                    for k in target:target[k]=remap[target[k]]
        for skin in self.doc.get('skins',[]):
            if 'inverseBindMatrices' in skin:skin['inverseBindMatrices']=remap[skin['inverseBindMatrices']]
        for anim in self.doc.get('animations',[]):
            for s in anim['samplers']:s['input']=remap[s['input']];s['output']=remap[s['output']]
        self.doc['accessors']=[self.doc['accessors'][old] for old in sorted(used)]
        views={a['bufferView'] for a in self.doc['accessors']}
        views.update(i['bufferView'] for i in self.doc.get('images',[]) if 'bufferView' in i)
        vmap={old:new for new,old in enumerate(sorted(views))};newbin=bytearray();newviews=[]
        for old in sorted(views):
            view=copy.deepcopy(self.doc['bufferViews'][old]);offset=view.get('byteOffset',0)
            newbin.extend(b'\0'*((-len(newbin))%4));view['byteOffset']=len(newbin)
            newbin.extend(self.bin[offset:offset+view['byteLength']]);newviews.append(view)
        for a in self.doc['accessors']:a['bufferView']=vmap[a['bufferView']]
        for i in self.doc.get('images',[]):
            if 'bufferView' in i:i['bufferView']=vmap[i['bufferView']]
        self.doc['bufferViews']=newviews;self.bin=newbin;self.doc['buffers']=[{'byteLength':len(newbin)}]
        j=json.dumps(self.doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
        b=bytes(newbin)+b'\0'*((-len(newbin))%4)
        Path(path).write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(b))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(b),0x004e4942)+b)

def png_rgba(pixels):
    h,w,_=pixels.shape
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(b'\0'+row.tobytes() for row in pixels)))+chunk(b'IEND',b'')

def palette(source,out):
    glb=Glb(source);d=glb.doc;assert len(d['meshes'])==1 and len(d['skins'])==1
    original=copy.deepcopy(d['materials']);primitives=d['meshes'][0]['primitives']
    textured=[i for i,m in enumerate(original) if 'baseColorTexture' in m['pbrMetallicRoughness']]
    assert len(textured)==1 and len(d.get('images',[]))==1 and not d.get('extensionsUsed')
    for m in original:
        assert m.get('alphaMode','OPAQUE')=='OPAQUE' and not m.get('doubleSided',False)
        assert not any(k in m for k in ('normalTexture','occlusionTexture','emissiveTexture','extensions'))
        assert set(m['pbrMetallicRoughness'])<= {'baseColorFactor','baseColorTexture','metallicFactor','roughnessFactor'}
    flat=[i for i in range(len(original)) if i not in textured];width=32
    pixels=np.zeros((4,width,4),np.uint8);pixels[:,:,3]=255
    entries=[]
    for column,mi in enumerate(flat):
        pbr=original[mi]['pbrMetallicRoughness'];r=pbr.get('roughnessFactor',1);m=pbr.get('metallicFactor',1)
        pixels[:,column,1]=round(r*255);pixels[:,column,2]=round(m*255)
        entries.append({'sourceMaterial':mi,'uv':[(column+.5)/width,.5],'roughness':r,'metallic':m,'storedRoughness':round(r*255)/255,'storedMetallic':round(m*255)/255})
    image=png_rgba(pixels);image_index=len(d['images']);d['images'].append({'name':'Garrison PBR palette','mimeType':'image/png','bufferView':glb.view(image)})
    sampler_index=len(d.setdefault('samplers',[]));d['samplers'].append({'magFilter':9728,'minFilter':9728,'wrapS':33071,'wrapT':33071})
    texture_index=len(d.setdefault('textures',[]));d['textures'].append({'name':'Garrison PBR palette','source':image_index,'sampler':sampler_index})
    d['materials']=[{'name':'GarrisonPalette','pbrMetallicRoughness':{'baseColorFactor':[1,1,1,1],'metallicFactor':1,'roughnessFactor':1,'metallicRoughnessTexture':{'index':texture_index}}},copy.deepcopy(original[textured[0]])]
    d['materials'][1]['name']='GarrisonMail'
    output=[];provenance=[];proof=[]
    for group in (flat,textured):
        arrays={};indices=[];offset=0
        for prim in primitives:
            mi=prim['material']
            if mi not in group:continue
            assert prim.get('mode',4)==4 and not prim.get('targets')
            attrs={k:glb.array(v) for k,v in prim['attributes'].items()};count=len(attrs['POSITION'])
            assert set(attrs)=={'POSITION','NORMAL','TEXCOORD_0','JOINTS_0','WEIGHTS_0'}
            pbr=original[mi]['pbrMetallicRoughness'];color=pbr.get('baseColorFactor',[1,1,1,1]) if mi in flat else [1,1,1,1]
            attrs['COLOR_0']=np.tile(np.array(color,dtype='<f4'),(count,1))
            if mi in flat:attrs['TEXCOORD_0']=np.tile(np.array(entries[flat.index(mi)]['uv'],dtype='<f4'),(count,1))
            raw_indices=glb.array(prim['indices']).reshape(-1).astype('<u4');indices.append(raw_indices+offset)
            for key,array in attrs.items():arrays.setdefault(key,[]).append(array)
            provenance.append({'sourceMaterial':mi,'outputPrimitive':len(output),'vertexStart':offset,'vertices':count,'triangles':len(raw_indices)//3})
            proof.append({'sourceMaterial':mi,'positionSha256':hashlib.sha256(attrs['POSITION'].tobytes()).hexdigest(),'normalSha256':hashlib.sha256(attrs['NORMAL'].tobytes()).hexdigest(),'jointSha256':hashlib.sha256(attrs['JOINTS_0'].tobytes()).hexdigest(),'weightSha256':hashlib.sha256(attrs['WEIGHTS_0'].tobytes()).hexdigest()})
            offset+=count
        output.append({'attributes':{k:glb.accessor(np.concatenate(v),k) for k,v in arrays.items()},'indices':glb.accessor(np.concatenate(indices).reshape(-1,1),'indices'),'material':len(output),'mode':4})
    d['meshes'][0]['primitives']=output;d.setdefault('extras',{})['runtimeDerivative']={'operation':'linear vertex-color + metallic/roughness palette','sourceSha256':hashlib.sha256(Path(source).read_bytes()).hexdigest()}
    path=out/'Garrison-LOD0.glb';glb.write(path)
    check=Glb(path)
    for item,expected in zip(provenance,proof):
        prim=check.doc['meshes'][0]['primitives'][item['outputPrimitive']];a=item['vertexStart'];b=a+item['vertices']
        for sem,name in [('POSITION','position'),('NORMAL','normal'),('JOINTS_0','joint'),('WEIGHTS_0','weight')]:
            assert hashlib.sha256(check.array(prim['attributes'][sem])[a:b].tobytes()).hexdigest()==expected[name+'Sha256']
    report={'sourceSha256':d['extras']['runtimeDerivative']['sourceSha256'],'lod0Sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'sourceMaterials':len(original),'materials':2,'sourceTriangles':sum(x['triangles'] for x in provenance),'vertices':sum(x['vertices'] for x in provenance),'geometryNormalsSkinPreserved':True,'baseColors':'Exact linear float32 COLOR_0; mail COLOR_0 white','mailTextureAndUvPreserved':True,'palette':entries,'maxPbrFactorQuantization':max(abs(e[k]-e['stored'+k[0].upper()+k[1:]]) for e in entries for k in ('roughness','metallic')),'primitiveMapping':provenance,'limits':['LOD0 material pixel equivalence must be checked in Unity; material count alone is not measured performance.','UV0 of originally untextured parts intentionally repurposed for the tiny PBR palette.']}
    (out/'palette-audit.json').write_text(json.dumps(report,indent=2)+'\n')
    job={'sourceSha256':report['lod0Sha256'],'primitiveMapping':provenance,'primitives':[{**{k:check.array(v).tolist() for k,v in p['attributes'].items()},'indices':check.array(p['indices']).reshape(-1).tolist()} for p in check.doc['meshes'][0]['primitives']]}
    (out/'simplifier-input.json').write_text(json.dumps(job,separators=(',',':')))
    return report

def lods(base, index_file, out):
    all_lods=json.loads(Path(index_file).read_text());reports=[]
    expected=hashlib.sha256(Path(base).read_bytes()).hexdigest()
    if all_lods.get('sourceSha256')!=expected:raise ValueError('LOD index source hash mismatch')
    for lod in all_lods['lods']:
        glb=Glb(base);stats=[]
        if len(lod['primitives'])!=len(glb.doc['meshes'][0]['primitives']):raise ValueError('LOD primitive count mismatch')
        for p,entry in zip(glb.doc['meshes'][0]['primitives'],lod['primitives']):
            count=len(glb.array(p['attributes']['POSITION']))
            if not entry['indices'] or len(entry['indices'])%3 or any(type(i)!=int or i<0 or i>=count for i in entry['indices']):raise ValueError('Invalid LOD triangle indices')
            selected=np.array(entry['indices'],dtype='<u4');used=np.unique(selected);mapping=np.zeros(int(used.max())+1,dtype='<u4');mapping[used]=np.arange(len(used),dtype='<u4')
            data={k:glb.array(v)[used] for k,v in p['attributes'].items()}
            p['attributes']={k:glb.accessor(v,k) for k,v in data.items()};p['indices']=glb.accessor(mapping[selected].reshape(-1,1),'indices')
            stats.append({'vertices':len(used),'triangles':len(selected)//3,'simplificationErrorM':entry['error']})
        glb.doc['extras']['runtimeDerivative']['lod']=lod['name']
        path=out/(lod['name']+'.glb');glb.write(path)
        reports.append({'name':lod['name'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'vertices':sum(s['vertices'] for s in stats),'triangles':sum(s['triangles'] for s in stats),'materials':2,'primitives':stats})
    (out/'lod-audit.json').write_text(json.dumps({'source':str(base),'sourceSha256':hashlib.sha256(Path(base).read_bytes()).hexdigest(),'method':all_lods['method'],'lods':reports,'limits':['Meshoptimizer error is a geometric bound from simplification, not a rendered skin-deformation or material parity result.','Selected vertices preserve exact source attributes; Unity pose and tactical-view checks remain required.']},indent=2)+'\n')
    return reports

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--input',required=True);parser.add_argument('--out',required=True);parser.add_argument('--lod-indices');args=parser.parse_args()
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    print(json.dumps(lods(args.input,args.lod_indices,out) if args.lod_indices else palette(args.input,out),indent=2))
