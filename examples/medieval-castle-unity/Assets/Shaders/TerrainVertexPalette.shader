Shader "LastCrossing/TerrainVertexPalette"
{
 SubShader
 {
  Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" "Queue"="Geometry" }
  Pass
  {
   Name "ForwardLit"
   Tags { "LightMode"="UniversalForwardOnly" }
   Cull Back ZWrite On
   HLSLPROGRAM
   #pragma vertex Vert
   #pragma fragment Frag
   #pragma target 3.5
   #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
   #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
   #pragma multi_compile_fog
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
   struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; float4 color:COLOR; };
   struct Varyings { float4 positionCS:SV_POSITION; float3 positionWS:TEXCOORD0; half3 normalWS:TEXCOORD1; half3 color:TEXCOORD2; };
   Varyings Vert(Attributes i)
   {
    Varyings o; VertexPositionInputs p=GetVertexPositionInputs(i.positionOS.xyz);
    o.positionCS=p.positionCS; o.positionWS=p.positionWS;
    o.normalWS=TransformObjectToWorldNormal(i.normalOS); o.color=i.color.rgb; return o;
   }
   half4 Frag(Varyings i):SV_Target
   {
    half3 normal=normalize(i.normalWS);
    Light light=GetMainLight(TransformWorldToShadowCoord(i.positionWS),i.positionWS,half4(1,1,1,1),true,false);
    half3 ambient=SampleSHPixel(half3(0,0,0),normal);
    half3 lit=i.color*(ambient+light.color*saturate(dot(normal,light.direction))*light.distanceAttenuation*light.shadowAttenuation);
    return half4(BlendDistanceFog(lit,i.positionCS),1);
   }
   ENDHLSL
  }
  Pass
  {
   Name "ShadowCaster"
   Tags { "LightMode"="ShadowCaster" }
   ZWrite On ZTest LEqual ColorMask 0 Cull Back
   HLSLPROGRAM
   #pragma vertex ShadowVert
   #pragma fragment ShadowFrag
   #pragma target 3.5
   #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
   float3 _LightDirection; float3 _LightPosition;
   struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; };
   float4 ShadowVert(Attributes i):SV_POSITION
   {
    float3 p=TransformObjectToWorld(i.positionOS.xyz),n=TransformObjectToWorldNormal(i.normalOS);
    #if _CASTING_PUNCTUAL_LIGHT_SHADOW
     float3 direction=normalize(_LightPosition-p);
    #else
     float3 direction=_LightDirection;
    #endif
    return ApplyShadowClamping(TransformWorldToHClip(ApplyShadowBias(p,n,direction)));
   }
   half4 ShadowFrag():SV_Target { return 0; }
   ENDHLSL
  }
  Pass
  {
   Name "DepthOnly"
   Tags { "LightMode"="DepthOnly" }
   ZWrite On ColorMask R Cull Back
   HLSLPROGRAM
   #pragma vertex DepthVert
   #pragma fragment DepthFrag
   #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
   float4 DepthVert(float4 positionOS:POSITION):SV_POSITION { return TransformObjectToHClip(positionOS.xyz); }
   half4 DepthFrag():SV_Target { return 0; }
   ENDHLSL
  }
 }
 Fallback Off
}
