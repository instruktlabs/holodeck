// CastleKit: castle material look-dev shader (hand-written URP HLSL; Shader Graph was not authored
// because .shadergraph files cannot be created reliably from a headless batch Editor).
// albedo = BaseColor x (tiling base map) x COLOR_0, normal map + packed ORM (R occlusion,
// G roughness, B metallic, as exported by Kiln) when _CK_TILING is on. UV0 carries metres;
// _MetersPerTile converts them to tile space. Tangent frames are derived per pixel from
// screen-space derivatives, so imported meshes need no TANGENT attribute.
Shader "LastCrossing/CastleKitRun01Ref"
{
    Properties
    {
        _BaseColor("Base colour (sRGB)", Color) = (1,1,1,1)
        _BaseMap("Albedo tiling map", 2D) = "white" {}
        [Normal] _BumpMap("Normal tiling map (OpenGL +Y)", 2D) = "bump" {}
        _OrmMap("ORM tiling map (R AO, G roughness, B metallic)", 2D) = "white" {}
        _MetersPerTile("Metres per tile", Float) = 1
        _NormalStrength("Normal strength", Range(0,2)) = 1
        _OcclusionStrength("Map occlusion strength", Range(0,1)) = 1
        _Roughness("Roughness (no ORM map)", Range(0,1)) = 0.95
        _Metallic("Metallic (no ORM map)", Range(0,1)) = 0
        _VertexColorStrength("COLOR_0 strength", Range(0,1)) = 1
        [Toggle(_CK_TILING)] _Tiling("Use tiling maps", Float) = 0
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" "RenderPipeline"="UniversalPipeline" "Queue"="Geometry" }
        HLSLINCLUDE
        #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
        CBUFFER_START(UnityPerMaterial)
            float4 _BaseColor;
            float4 _BaseMap_ST;
            float _MetersPerTile, _NormalStrength, _OcclusionStrength, _Roughness, _Metallic, _VertexColorStrength;
        CBUFFER_END
        TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
        TEXTURE2D(_BumpMap); SAMPLER(sampler_BumpMap);
        TEXTURE2D(_OrmMap); SAMPLER(sampler_OrmMap);
        ENDHLSL

        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            HLSLPROGRAM
            #pragma vertex Vert
            #pragma fragment Frag
            #pragma shader_feature_local _CK_TILING
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile _ _ADDITIONAL_LIGHTS_VERTEX _ADDITIONAL_LIGHTS
            #pragma multi_compile_fragment _ _ADDITIONAL_LIGHT_SHADOWS
            #pragma multi_compile_fragment _ _SHADOWS_SOFT _SHADOWS_SOFT_LOW _SHADOWS_SOFT_MEDIUM _SHADOWS_SOFT_HIGH
            #pragma multi_compile_fog
            #pragma multi_compile_instancing
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"
            struct Attributes { float4 positionOS:POSITION; float3 normalOS:NORMAL; float2 uv:TEXCOORD0; float4 color:COLOR; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct Varyings { float4 positionCS:SV_POSITION; float3 positionWS:TEXCOORD0; float3 normalWS:TEXCOORD1; float2 uv:TEXCOORD2; float4 color:COLOR; float fogCoord:TEXCOORD3; UNITY_VERTEX_OUTPUT_STEREO };
            Varyings Vert(Attributes v)
            {
                Varyings o; UNITY_SETUP_INSTANCE_ID(v); UNITY_INITIALIZE_VERTEX_OUTPUT_STEREO(o);
                o.positionWS = TransformObjectToWorld(v.positionOS.xyz);
                o.positionCS = TransformWorldToHClip(o.positionWS);
                o.normalWS = TransformObjectToWorldNormal(v.normalOS);
                o.uv = v.uv; o.color = v.color; o.fogCoord = ComputeFogFactor(o.positionCS.z);
                return o;
            }
            half4 Frag(Varyings i) : SV_Target
            {
                float3 n = normalize(i.normalWS);
                half3 tint = lerp(half3(1,1,1), (half3)i.color.rgb, _VertexColorStrength);
                half3 albedo = _BaseColor.rgb * tint;
                half roughness = _Roughness, metallic = _Metallic, occlusion = 1;
                #if defined(_CK_TILING)
                    float2 uv = i.uv / max(_MetersPerTile, 1e-4);
                    albedo *= SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv).rgb;
                    half3 orm = SAMPLE_TEXTURE2D(_OrmMap, sampler_OrmMap, uv).rgb;
                    occlusion = lerp(1, orm.r, _OcclusionStrength); roughness = orm.g; metallic = orm.b;
                    half3 nts = UnpackNormalScale(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uv), _NormalStrength);
                    float3 dp1 = ddx(i.positionWS), dp2 = ddy(i.positionWS); float2 du1 = ddx(uv), du2 = ddy(uv);
                    float3 p2 = cross(dp2, n), p1 = cross(n, dp1);
                    float3 t = p2 * du1.x + p1 * du2.x, b = p2 * du1.y + p1 * du2.y;
                    float s = rsqrt(max(max(dot(t,t), dot(b,b)), 1e-20));
                    n = normalize(nts.x * t * s + nts.y * b * s + nts.z * n);
                #endif
                InputData input = (InputData)0;
                input.positionWS = i.positionWS; input.positionCS = i.positionCS; input.normalWS = n;
                input.viewDirectionWS = GetWorldSpaceNormalizeViewDir(i.positionWS);
                input.shadowCoord = TransformWorldToShadowCoord(i.positionWS);
                input.fogCoord = i.fogCoord; input.bakedGI = SampleSH(n);
                input.normalizedScreenSpaceUV = GetNormalizedScreenSpaceUV(i.positionCS);
                input.shadowMask = half4(1,1,1,1);
                SurfaceData surface = (SurfaceData)0;
                surface.albedo = albedo; surface.metallic = metallic; surface.smoothness = 1 - roughness;
                surface.occlusion = occlusion; surface.alpha = 1; surface.normalTS = half3(0,0,1);
                half4 c = UniversalFragmentPBR(input, surface);
                c.rgb = MixFog(c.rgb, input.fogCoord);
                return half4(c.rgb, 1);
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
            #pragma multi_compile_instancing
            #pragma multi_compile_vertex _ _CASTING_PUNCTUAL_LIGHT_SHADOW
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Shadows.hlsl"
            float3 _LightDirection; float3 _LightPosition;
            struct A { float4 positionOS:POSITION; float3 normalOS:NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            float4 ShadowVert(A v) : SV_POSITION
            {
                UNITY_SETUP_INSTANCE_ID(v);
                float3 p = TransformObjectToWorld(v.positionOS.xyz), n = TransformObjectToWorldNormal(v.normalOS);
                #if defined(_CASTING_PUNCTUAL_LIGHT_SHADOW)
                    float3 l = normalize(_LightPosition - p);
                #else
                    float3 l = _LightDirection;
                #endif
                float4 c = TransformWorldToHClip(ApplyShadowBias(p, n, l));
                #if UNITY_REVERSED_Z
                    c.z = min(c.z, UNITY_NEAR_CLIP_VALUE);
                #else
                    c.z = max(c.z, UNITY_NEAR_CLIP_VALUE);
                #endif
                return c;
            }
            half4 ShadowFrag() : SV_Target { return 0; }
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
            #pragma multi_compile_instancing
            struct A { float4 positionOS:POSITION; UNITY_VERTEX_INPUT_INSTANCE_ID };
            float4 DepthVert(A v) : SV_POSITION { UNITY_SETUP_INSTANCE_ID(v); return TransformObjectToHClip(v.positionOS.xyz); }
            half DepthFrag(float4 p : SV_POSITION) : SV_Target { return p.z; }
            ENDHLSL
        }
        Pass
        {
            Name "DepthNormals"
            Tags { "LightMode"="DepthNormals" }
            ZWrite On Cull Back
            HLSLPROGRAM
            #pragma vertex DNVert
            #pragma fragment DNFrag
            #pragma multi_compile_instancing
            #pragma multi_compile_fragment _ _GBUFFER_NORMALS_OCT
            struct A { float4 positionOS:POSITION; float3 normalOS:NORMAL; UNITY_VERTEX_INPUT_INSTANCE_ID };
            struct V { float4 positionCS:SV_POSITION; float3 normalWS:TEXCOORD0; };
            V DNVert(A v) { UNITY_SETUP_INSTANCE_ID(v); V o; o.positionCS = TransformObjectToHClip(v.positionOS.xyz); o.normalWS = TransformObjectToWorldNormal(v.normalOS); return o; }
            half4 DNFrag(V i) : SV_Target
            {
                float3 n = normalize(i.normalWS);
                #if defined(_GBUFFER_NORMALS_OCT)
                    float2 r = saturate(PackNormalOctQuadEncode(n) * 0.5 + 0.5); return half4(PackFloat2To888(r), 0);
                #else
                    return half4(n, 0);
                #endif
            }
            ENDHLSL
        }
    }
    FallBack Off
}
