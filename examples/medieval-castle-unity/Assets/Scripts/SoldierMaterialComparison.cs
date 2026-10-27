using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

// Diagnostic only: qualified for the opaque, scalar-PBR e5855 baseline, not COLOR_0 palettes.
public static class SoldierMaterialComparison
{
    [Serializable] public class Mapping
    {
        public string originalName, originalShader, replacementShader, textureName;
        public bool castsShadows;
        public Color storedBaseColor;
        public float metallic, roughness, smoothness;
        public Vector4 textureST;
    }
    [Serializable] public class Receipt
    {
        public string mode;
        public List<Mapping> mappings = new List<Mapping>();
    }
    static readonly Dictionary<string, Material> Converted = new Dictionary<string, Material>();
    static readonly Dictionary<string, Mapping> Records = new Dictionary<string, Mapping>();

    public static Receipt Apply(GameObject root, string mode, Shader litShader = null)
    {
        if (mode != "original" && mode != "urp-lit" && mode != "urp-lit-no-torso-caster" && mode != "urp-lit-no-mail-caster") throw new ArgumentException("Unknown material comparison mode: " + mode);
        var receipt = new Receipt { mode = mode };
        if (mode == "original") return receipt;
        if (litShader == null) litShader = Shader.Find("Universal Render Pipeline/Lit");
        if (litShader == null || !litShader.isSupported) throw new InvalidOperationException("URP/Lit must be explicitly included in this comparison build.");
        foreach (var renderer in root.GetComponentsInChildren<Renderer>(true))
        {
            Mesh mesh = renderer is SkinnedMeshRenderer skin ? skin.sharedMesh : renderer.GetComponent<MeshFilter>()?.sharedMesh;
            if (mesh != null && mesh.HasVertexAttribute(VertexAttribute.Color))
                throw new InvalidOperationException("URP/Lit comparison does not preserve COLOR_0. Use the original e5855 baseline only.");
            var materials = renderer.sharedMaterials;
            for (int i = 0; i < materials.Length; i++)
            {
                var source = materials[i];
                if (source == null) throw new InvalidOperationException("Null source material.");
                string key = source.GetEntityId() + ":" + mode;
                if (!Converted.TryGetValue(key, out var target))
                {
                    target = Convert(source, litShader, out var mapping);
                    Converted.Add(key, target);
                    Records.Add(key, mapping);
                }
                if ((mode == "urp-lit-no-torso-caster" && source.name == "Material_0") || (mode == "urp-lit-no-mail-caster" && source.name == "Material_2"))
                    target.SetShaderPassEnabled("ShadowCaster", false);
                Records[key].castsShadows = target.GetShaderPassEnabled("ShadowCaster");
                materials[i] = target;
                if (!receipt.mappings.Contains(Records[key])) receipt.mappings.Add(Records[key]);
            }
            renderer.sharedMaterials = materials;
        }
        return receipt;
    }

    static Material Convert(Material source, Shader shader, out Mapping record)
    {
        if (source.shader.name != "Shader Graphs/glTF-pbrMetallicRoughness")
            throw new InvalidOperationException("Unexpected source shader: " + source.shader.name);
        foreach (string property in new[] { "baseColorFactor", "metallicFactor", "roughnessFactor", "baseColorTexture" })
            if (!source.HasProperty(property)) throw new InvalidOperationException("Missing imported property: " + property);
        if (source.renderQueue >= 2450 || source.IsKeywordEnabled("_ALPHATEST_ON") || source.IsKeywordEnabled("_SURFACE_TYPE_TRANSPARENT"))
            throw new InvalidOperationException("Only opaque baseline materials are supported.");
        var color = source.GetColor("baseColorFactor");
        float metallic = source.GetFloat("metallicFactor"), roughness = source.GetFloat("roughnessFactor");
        if (color.a < .999f || metallic < 0 || metallic > 1 || roughness < 0 || roughness > 1)
            throw new InvalidOperationException("Unexpected baseline PBR factors.");
        var texture = source.GetTexture("baseColorTexture");
        var st = source.HasProperty("baseColorTexture_ST") ? source.GetVector("baseColorTexture_ST") : new Vector4(1, 1, 0, 0);
        if (texture != null && ((source.HasProperty("baseColorTexture_Rotation") && source.GetVector("baseColorTexture_Rotation").sqrMagnitude > 1e-10f)
            || (source.HasProperty("baseColorTexture_texCoord") && Mathf.Abs(source.GetFloat("baseColorTexture_texCoord")) > .001f)))
            throw new InvalidOperationException("Rotated or non-UV0 texture requires a separate equivalent shader.");
        var target = new Material(shader) { name = source.name + "_DiagnosticUrpLit", renderQueue = 2000 };
        // glTFast 6.20 ShaderGraphMaterialGenerator:442 stores baseColorLinear.gamma.
        // Both properties are ordinary Color properties. Copy stored values; do not gamma-convert again.
        target.SetColor("_BaseColor", color);
        target.SetFloat("_WorkflowMode", 1); // metallic workflow
        target.SetFloat("_Metallic", metallic);
        target.SetFloat("_Smoothness", 1 - roughness);
        target.SetFloat("_SmoothnessTextureChannel", 0);
        target.SetTexture("_BaseMap", texture);
        target.SetTextureScale("_BaseMap", new Vector2(st.x, st.y));
        target.SetTextureOffset("_BaseMap", new Vector2(st.z, st.w));
        target.SetFloat("_Surface", 0);
        target.SetFloat("_AlphaClip", 0);
        target.SetFloat("_Cull", (float)CullMode.Back);
        target.SetFloat("_ZWrite", 1);
        target.SetFloat("_SrcBlend", (float)BlendMode.One);
        target.SetFloat("_DstBlend", (float)BlendMode.Zero);
        target.SetFloat("_ReceiveShadows", 1);
        target.SetOverrideTag("RenderType", "Opaque");
        target.SetShaderPassEnabled("ShadowCaster", true);
        record = new Mapping { originalName = source.name, originalShader = source.shader.name,
            replacementShader = shader.name, storedBaseColor = color, metallic = metallic,
            roughness = roughness, smoothness = 1 - roughness, textureName = texture == null ? null : texture.name, textureST = st };
        return target;
    }
}


