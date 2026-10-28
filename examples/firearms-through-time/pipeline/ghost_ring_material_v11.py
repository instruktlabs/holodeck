"""Analytic ghost-ring material (docs/sight-research-v1.md 5.3), shared by the bolt import and in-place rebuilds.
Opacity = lerp(1, smoothstep(Core, Outer, theta), Aim), where theta is the angle between the pixel's view ray and the eye-to-aperture
axis. Base colour and texture come from each part's imported material through BaseColorTexture and BaseColorFactor."""
import unreal
PATH='/Game/Qualification/SightV11/M_GhostRing'
def build(m):
 mel=unreal.MaterialEditingLibrary;mel.delete_all_material_expressions(m)
 m.set_editor_property('blend_mode',unreal.BlendMode.BLEND_TRANSLUCENT);m.set_editor_property('translucency_lighting_mode',unreal.TranslucencyLightingMode.TLM_SURFACE)
 def e(cls,x,y,**props):
  n=mel.create_material_expression(m,cls,x,y)
  for k,v in props.items():n.set_editor_property(k,v)
  return n
 def c(a,out,b,inp):assert mel.connect_material_expressions(a,out,b,inp),(a.get_name(),out,b.get_name(),inp)
 def p(node,out,prop):assert mel.connect_material_property(node,out,prop),(node.get_name(),prop)
 def scalar(name,value,y):return e(unreal.MaterialExpressionScalarParameter,-1100,y,parameter_name=name,default_value=value)
 tex=e(unreal.MaterialExpressionTextureSampleParameter2D,-1100,-400,parameter_name='BaseColorTexture',texture=unreal.load_asset('/Engine/EngineResources/WhiteSquareTexture'))
 color=e(unreal.MaterialExpressionVectorParameter,-1100,-200,parameter_name='BaseColorFactor',default_value=unreal.LinearColor(1,1,1,1))
 base=e(unreal.MaterialExpressionMultiply,-800,-300);c(tex,'RGB',base,'A');c(color,'RGB',base,'B')
 axis=e(unreal.MaterialExpressionVectorParameter,-1100,0,parameter_name='AxisWS',default_value=unreal.LinearColor(1,0,0,0))
 view=e(unreal.MaterialExpressionCameraVectorWS,-1100,150);dot=e(unreal.MaterialExpressionDotProduct,-850,50);c(view,'',dot,'A');c(axis,'RGB',dot,'B')
 neg=e(unreal.MaterialExpressionMultiply,-700,50,const_b=-1.0);c(dot,'',neg,'A')
 clamp=e(unreal.MaterialExpressionClamp,-560,50,min_default=-1.0,max_default=1.0);c(neg,'',clamp,'')
 theta=e(unreal.MaterialExpressionArccosine,-420,50);c(clamp,'',theta,'')
 core,outer,aim,darken=scalar('Core',0.0,250),scalar('Outer',1.0,350),scalar('Aim',0.0,450),scalar('Darken',.35,550)
 fade=e(unreal.MaterialExpressionSmoothStep,-280,150);c(core,'',fade,'Min');c(outer,'',fade,'Max');c(theta,'',fade,'Value')
 opacity=e(unreal.MaterialExpressionLinearInterpolate,-100,250,const_a=1.0);c(fade,'',opacity,'B');c(aim,'',opacity,'Alpha')
 t1=e(unreal.MaterialExpressionMultiply,-280,450);c(darken,'',t1,'A');c(aim,'',t1,'B');t2=e(unreal.MaterialExpressionMultiply,-150,450);c(t1,'',t2,'A');c(fade,'',t2,'B')
 keep=e(unreal.MaterialExpressionOneMinus,-30,450);c(t2,'',keep,'');shade=e(unreal.MaterialExpressionMultiply,-30,-300);c(base,'',shade,'A');c(keep,'',shade,'B')
 metal,rough=scalar('MetallicFactor',.8,-650),scalar('RoughnessFactor',.45,-750)
 p(shade,'',unreal.MaterialProperty.MP_BASE_COLOR);p(opacity,'',unreal.MaterialProperty.MP_OPACITY);p(metal,'',unreal.MaterialProperty.MP_METALLIC);p(rough,'',unreal.MaterialProperty.MP_ROUGHNESS)
 mel.recompile_material(m);return m
def ensure(assets,tools):
 if assets.does_asset_exist(PATH):return unreal.load_asset(PATH)
 m=build(tools.create_asset('M_GhostRing','/Game/Qualification/SightV11',unreal.Material,unreal.MaterialFactoryNew()));assert assets.save_loaded_asset(m,False);return m
