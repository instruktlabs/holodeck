"""Read back the actual UE asset settings, bounds and material bindings."""
import json
from pathlib import Path
import unreal
ROOT = Path(__file__).resolve().parents[1]
assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve() == (ROOT/'native/ToolchainValidation').resolve()
base='/Game/Qualification/ExhibitGenerated/interaction-exhibit'
receipt={'textures':[],'meshes':[]}
for name in ['UV_Checker','Axis_Stripes']:
    t=unreal.load_asset(base+'/Textures/'+name)
    assert isinstance(t,unreal.Texture2D)
    receipt['textures'].append({'name':name,'path':t.get_path_name(),'srgb':t.get_editor_property('srgb'),'compression':str(t.get_editor_property('compression_settings')),'mipGenSettings':str(t.get_editor_property('mip_gen_settings')),'lodGroup':str(t.get_editor_property('lod_group'))})
    assert t.get_editor_property('srgb'), 'Albedo should decode from sRGB'
expected={'Mesh_RedPositiveX':([100,-10,70],[120,10,90]),'Mesh_BluePositiveZ':([-8,62,64],[8,78,106]),'Mesh_CheckerPanel':([-25,-9,60],[95,9,170]),'Mesh_CopperHub':([-22,-22,0],[22,22,70]),'Mesh_StripedArm':([-90,19,72],[0,45,88])}
for name,(lo,hi) in expected.items():
    mesh=unreal.load_asset(base+'/StaticMeshes/'+name)
    box=mesh.get_bounding_box()
    bounds=[[box.min.x,box.min.y,box.min.z],[box.max.x,box.max.y,box.max.z]]
    assert all(abs(x-y)<0.01 for observed,wanted in zip(bounds,[lo,hi]) for x,y in zip(observed,wanted))
    receipt['meshes'].append({'name':name,'boundsCm':bounds,'materials':[s.material_interface.get_path_name() for s in mesh.static_materials],'naniteEnabled':mesh.get_editor_property('nanite_settings').enabled})
receipt['conversion']='UE centimetres [X,Y,Z] = glTF metres [x,z,y] * 100; import baked node translation into each mesh; component transforms must remain identity.'
receipt['ok']=True
(ROOT/'evidence/exhibit-native-material-audit.json').write_text(json.dumps(receipt,indent=2))
unreal.log('EXHIBIT_ASSET_AUDIT_PASSED')
