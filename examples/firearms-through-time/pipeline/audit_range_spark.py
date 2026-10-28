from pathlib import Path
import unreal,json
R=Path(__file__).resolve().parents[1]
m=unreal.load_asset('/Game/Qualification/RangeV9Generated/M_SteelSpark')
e=unreal.MaterialEditingLibrary.get_material_property_input_node(m,unreal.MaterialProperty.MP_EMISSIVE_COLOR)
mesh=unreal.load_asset('/Engine/BasicShapes/Cylinder')
r={'material':m.get_path_name(),'shading':str(m.get_editor_property('shading_model')),'ism':m.get_editor_property('used_with_instanced_static_meshes'),'emissiveNode':str(e),'constant':str(e.get_editor_property('constant')) if e else None,'slots':[str(s.material_interface) for s in mesh.get_editor_property('static_materials')]}
(R/'evidence/range-v9-spark-material-audit.json').write_text(json.dumps(r,indent=2))
unreal.log('SPARK_AUDIT '+json.dumps(r))
