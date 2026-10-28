// CastleKit: castle material look-dev shader (hand-written URP HLSL; Shader Graph was not authored
// because .shadergraph files cannot be created reliably from a headless batch Editor).
// albedo = BaseColor x (tiling base map) x COLOR_0, normal map + packed ORM (R occlusion,
// G roughness, B metallic, as exported by Kiln) when _CK_TILING is on. UV0 carries metres;
// _MetersPerTile converts them to tile space. Tangent frames are derived per pixel from
// screen-space derivatives, so imported meshes need no TANGENT attribute.
// Run 02 additions (each behind its own material keyword; with both off the fragment code is
// the run-01 code unchanged):
//  _CK_TRIPLANAR  world-space triplanar projection of the same three maps (metres / _MetersPerTile),
//                 whiteout normal blend with back-face sign correction; blend weights below 2% are
//                 skipped with explicit-gradient samples, so planar walls pay for one projection.
//                 UV0 is ignored, so the authors' UV conventions and identical bays do not matter.
//  _CK_DETILE     triplanar only: Inigo Quilez's texture-repetition technique 3. A world-space index
//                 (3-D value noise at _DetileScale) picks two random tile offsets per region and blends
//                 the two samples, so the tile period stops showing on large faces. Offsets keep the
//                 tangent frame and the expected value, so the albedo mean is unchanged. Cost: one extra
//                 value noise per pixel and a second fetch of each map per active projection.
//  _CK_MACRO      low-frequency world-space variation: 3-D value noise at _MacroScale and 0.383x it,
//                 zero-mean, multiplicative on albedo (luminance +-_MacroStrength, warm/cool +-_MacroHue),
//                 so the expected albedo mean is unchanged.
// Run 02c additions (cost study; the keywords above and the run-01 path are unchanged):
//  _CK_DETILE     now also works with _CK_TILING (UV-mapped maps), with the same world regions.
//  _CK_DETAIL     triplanar rock prototype: a second normal octave of the same map at 1/_DetailRatio of
//                 the tile, rotated 37 degrees, faded out between 1.5 and 4 detail texels per pixel.
Shader "LastCrossing/CastleKit"
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
        [Toggle(_CK_TRIPLANAR)] _Triplanar("World triplanar projection (run 02)", Float) = 0
        _TriplanarSharpness("Triplanar blend sharpness", Range(1,32)) = 8
        [Toggle(_CK_MACRO)] _Macro("World macro variation (run 02)", Float) = 0
        _MacroScale("Macro scale (m)", Float) = 17
        _MacroStrength("Macro luminance amplitude", Range(0,0.2)) = 0.05
        _MacroHue("Macro warm/cool amplitude", Range(0,0.05)) = 0.012
        [Toggle(_CK_DETILE)] _Detile("World de-tiling, triplanar only (run 02)", Float) = 0
        _DetileScale("De-tiling region size (m)", Float) = 9
        [Toggle(_CK_DETAIL)] _Detail("Rock detail normal octave, triplanar only (run 02c)", Float) = 0
        _DetailRatio("Detail octave: tiles per main tile", Float) = 3.13
        _DetailStrength("Detail normal strength", Range(0,2)) = 0.6
        _DetailTexels("Normal map texels per tile (fade)", Float) = 1024
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
            float _TriplanarSharpness, _MacroScale, _MacroStrength, _MacroHue, _DetileScale;
            float _DetailRatio, _DetailStrength, _DetailTexels;
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
            #pragma shader_feature_local _CK_TRIPLANAR
            #pragma shader_feature_local _CK_MACRO
            #pragma shader_feature_local _CK_DETILE
            #pragma shader_feature_local _CK_DETAIL
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
            #if defined(_CK_MACRO) || defined(_CK_DETILE)
            float CKHash13(float3 p3) { p3 = frac(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return frac((p3.x + p3.y) * p3.z); }
            float CKValueNoise3(float3 p)
            {
                float3 i = floor(p), f = p - i;
                float3 u = f * f * f * (f * (f * 6 - 15) + 10);
                float n000 = CKHash13(i), n100 = CKHash13(i + float3(1,0,0)), n010 = CKHash13(i + float3(0,1,0)), n110 = CKHash13(i + float3(1,1,0));
                float n001 = CKHash13(i + float3(0,0,1)), n101 = CKHash13(i + float3(1,0,1)), n011 = CKHash13(i + float3(0,1,1)), n111 = CKHash13(i + float3(1,1,1));
                return lerp(lerp(lerp(n000, n100, u.x), lerp(n010, n110, u.x), u.y), lerp(lerp(n001, n101, u.x), lerp(n011, n111, u.x), u.y), u.z);
            }
            #endif
            #if defined(_CK_DETILE)
            void CKDetileParams(float3 positionWS, out float2 offA, out float2 offB, out half t)
            {
                float k = CKValueNoise3(positionWS / max(_DetileScale, 1e-3) + float3(7.1, 3.7, 1.3));
                float l = k * 8.0, i = floor(l), f = l - i;
                offA = sin(float2(3.0, 7.0) * i);
                offB = sin(float2(3.0, 7.0) * (i + 1.0));
                t = (half)smoothstep(0.2, 0.8, f);
            }
            #endif
            #if defined(_CK_TRIPLANAR)
            #if defined(_CK_DETILE)
            #define CK_TEX(tex, smp) lerp(SAMPLE_TEXTURE2D_GRAD(tex, smp, uv + offA, gx, gy), SAMPLE_TEXTURE2D_GRAD(tex, smp, uv + offB, gx, gy), t)
            #else
            #define CK_TEX(tex, smp) SAMPLE_TEXTURE2D_GRAD(tex, smp, uv, gx, gy)
            #endif
            // One projection: albedo, ORM and the whiteout-blended normal (already swizzled to world).
            void CKSampleAxis(float2 uv, float2 gx, float2 gy, float w, float flip, float3 nAxis, int axis,
                              float2 offA, float2 offB, half t, inout half3 a, inout half3 orm, inout float3 nb)
            {
                a += w * CK_TEX(_BaseMap, sampler_BaseMap).rgb;
                orm += w * CK_TEX(_OrmMap, sampler_OrmMap).rgb;
                half3 tn = UnpackNormalScale(CK_TEX(_BumpMap, sampler_BumpMap), _NormalStrength);
                #if defined(_CK_DETAIL)
                // Run 02c prototype (rock only): a second octave of the same normal map at 1/_DetailRatio of the tile,
                // rotated 37 degrees, whiteout-blended. It fades out between 1.5 and 4 detail texels per pixel, so it
                // costs one more fetch per active projection only at close range.
                float dfp = max(length(gx), length(gy)) * _DetailRatio * _DetailTexels;
                half dk = (half)(1.0 - smoothstep(1.5, 4.0, dfp));
                [branch] if (dk > 0)
                {
                    float2 duv = float2(0.8 * uv.x - 0.6 * uv.y, 0.6 * uv.x + 0.8 * uv.y) * _DetailRatio + float2(0.37, 0.71);
                    float2 dgx = float2(0.8 * gx.x - 0.6 * gx.y, 0.6 * gx.x + 0.8 * gx.y) * _DetailRatio;
                    float2 dgy = float2(0.8 * gy.x - 0.6 * gy.y, 0.6 * gy.x + 0.8 * gy.y) * _DetailRatio;
                    half3 dn = UnpackNormalScale(SAMPLE_TEXTURE2D_GRAD(_BumpMap, sampler_BumpMap, duv, dgx, dgy), _DetailStrength * dk);
                    tn = half3(tn.xy + half2(0.8 * dn.x + 0.6 * dn.y, -0.6 * dn.x + 0.8 * dn.y), tn.z * dn.z);
                }
                #endif
                tn.x *= flip;
                tn = half3(tn.xy + (half2)nAxis.xy, abs(tn.z) * (half)nAxis.z);
                nb += w * (axis == 0 ? tn.zyx : (axis == 1 ? tn.xzy : tn.xyz));
            }
            void CKTriplanar(float3 positionWS, inout float3 n, inout half3 albedo, inout half occlusion, inout half roughness, inout half metallic)
            {
                float3 p = positionWS / max(_MetersPerTile, 1e-4);
                float3 w = pow(abs(n), _TriplanarSharpness);
                w /= (w.x + w.y + w.z);
                w *= step(0.02, w);
                w /= (w.x + w.y + w.z);
                float3 s = step(0, n) * 2 - 1;
                float3 dx = ddx(p), dy = ddy(p);
                half3 a = 0, orm = 0; float3 nb = 0;
                float2 offA = 0, offB = 0; half t = 0;
                #if defined(_CK_DETILE)
                    CKDetileParams(positionWS, offA, offB, t);
                #endif
                [branch] if (w.x > 0) CKSampleAxis(float2(p.z * s.x, p.y), float2(dx.z * s.x, dx.y), float2(dy.z * s.x, dy.y), w.x, s.x, float3(n.z, n.y, n.x), 0, offA, offB, t, a, orm, nb);
                [branch] if (w.y > 0) CKSampleAxis(float2(p.x * s.y, p.z), float2(dx.x * s.y, dx.z), float2(dy.x * s.y, dy.z), w.y, s.y, float3(n.x, n.z, n.y), 1, offA, offB, t, a, orm, nb);
                [branch] if (w.z > 0) CKSampleAxis(float2(-p.x * s.z, p.y), float2(-dx.x * s.z, dx.y), float2(-dy.x * s.z, dy.y), w.z, -s.z, float3(n.x, n.y, n.z), 2, offA, offB, t, a, orm, nb);
                albedo *= a;
                occlusion = lerp(1, orm.r, _OcclusionStrength); roughness = orm.g; metallic = orm.b;
                n = normalize(nb);
            }
            #endif
            #if defined(_CK_MACRO)
            half3 CKMacro(float3 positionWS)
            {
                float3 p = positionWS / max(_MacroScale, 1e-3);
                float a = CKValueNoise3(p) * 2 - 1;
                float b = CKValueNoise3(p * 2.61 + float3(17.3, 5.1, 9.7)) * 2 - 1;
                float h = CKValueNoise3(p * 0.73 + float3(41.7, 13.9, 3.3)) * 2 - 1;
                float l = 1 + _MacroStrength * (0.68 * a + 0.32 * b);
                return half3(l + _MacroHue * h, l, l - _MacroHue * h);
            }
            #endif
            half4 Frag(Varyings i) : SV_Target
            {
                float3 n = normalize(i.normalWS);
                half3 tint = lerp(half3(1,1,1), (half3)i.color.rgb, _VertexColorStrength);
                half3 albedo = _BaseColor.rgb * tint;
                half roughness = _Roughness, metallic = _Metallic, occlusion = 1;
                #if defined(_CK_TRIPLANAR)
                    CKTriplanar(i.positionWS, n, albedo, occlusion, roughness, metallic);
                #elif defined(_CK_TILING)
                    float2 uv = i.uv / max(_MetersPerTile, 1e-4);
                    #if defined(_CK_DETILE)
                    // Run 02c: de-tiling on UV-mapped surfaces too (same world regions and offsets as triplanar).
                    float2 dtA, dtB; half dtT; CKDetileParams(i.positionWS, dtA, dtB, dtT);
                    float2 dgx = ddx(uv), dgy = ddy(uv);
                    albedo *= lerp(SAMPLE_TEXTURE2D_GRAD(_BaseMap, sampler_BaseMap, uv + dtA, dgx, dgy), SAMPLE_TEXTURE2D_GRAD(_BaseMap, sampler_BaseMap, uv + dtB, dgx, dgy), dtT).rgb;
                    half3 orm = lerp(SAMPLE_TEXTURE2D_GRAD(_OrmMap, sampler_OrmMap, uv + dtA, dgx, dgy), SAMPLE_TEXTURE2D_GRAD(_OrmMap, sampler_OrmMap, uv + dtB, dgx, dgy), dtT).rgb;
                    occlusion = lerp(1, orm.r, _OcclusionStrength); roughness = orm.g; metallic = orm.b;
                    half3 nts = UnpackNormalScale(lerp(SAMPLE_TEXTURE2D_GRAD(_BumpMap, sampler_BumpMap, uv + dtA, dgx, dgy), SAMPLE_TEXTURE2D_GRAD(_BumpMap, sampler_BumpMap, uv + dtB, dgx, dgy), dtT), _NormalStrength);
                    #else
                    albedo *= SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv).rgb;
                    half3 orm = SAMPLE_TEXTURE2D(_OrmMap, sampler_OrmMap, uv).rgb;
                    occlusion = lerp(1, orm.r, _OcclusionStrength); roughness = orm.g; metallic = orm.b;
                    half3 nts = UnpackNormalScale(SAMPLE_TEXTURE2D(_BumpMap, sampler_BumpMap, uv), _NormalStrength);
                    #endif
                    float3 dp1 = ddx(i.positionWS), dp2 = ddy(i.positionWS); float2 du1 = ddx(uv), du2 = ddy(uv);
                    float3 p2 = cross(dp2, n), p1 = cross(n, dp1);
                    float3 t = p2 * du1.x + p1 * du2.x, b = p2 * du1.y + p1 * du2.y;
                    float s = rsqrt(max(max(dot(t,t), dot(b,b)), 1e-20));
                    n = normalize(nts.x * t * s + nts.y * b * s + nts.z * n);
                #endif
                #if defined(_CK_MACRO)
                    albedo *= CKMacro(i.positionWS);
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
