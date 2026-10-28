using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

// Castle material look-dev: verifies the exact Kiln GLBs, configures the shared tiling maps, builds
// CastleKit materials from castlekit-remap.json, lays out variants A/B/C (tower + 3 wall bays each)
// under the castle scene's sun/ambient/fog, and builds a Linux player whose LookDevCapture component
// renders the matched views. Variant A keeps the glTFast-created materials; B and C are remapped by
// Kiln material name and fail closed on any unknown name.
public static class LookDevBuild
{
    const string Root = "Assets/LookDev", ScenePath = Root + "/LookDev.unity", MaterialDir = Root + "/Materials";
    const string Player = "Builds/LookDevLinux/LookDev.x86_64";
    static readonly string[] Variants = { "A", "B", "C" };
    [Serializable] class Inputs { public string store; public Model[] models; }
    [Serializable] class Model { public string variant, module, path, sha256, assetId, revisionId, programRef; }
    [Serializable] class Remap { public string scope; public Entry[] entries; }
    [Serializable] class Entry { public string variant, kilnMaterial, baseColor, library, revisionId; public float roughness, metallic, metersPerTile; }
    [Serializable] class TextureReceipt { public string path, sha256, importerType, graphicsFormat; public bool sRGB; public int width, height, mipmaps, maxSize; public string wrap, filter; public int aniso; }
    [Serializable] class MaterialReceipt { public string variant, kilnMaterial, asset, shader, library, revisionId; public float metersPerTile; public string[] textures; }
    [Serializable] class ImporterMaterials { public string glb; public int importerCreatedMaterials; public string[] names; }
    [Serializable] class Receipt
    {
        public string scene, player, scope, editor; public long playerBytes; public string result;
        public Model[] models; public MaterialReceipt[] materials; public TextureReceipt[] textures; public ImporterMaterials[] importerMaterials;
        public int pipelineCascadesBefore, pipelineCascadesDuringBuild, pipelineCascadesAfter; public float shadowDistanceBefore, shadowDistanceDuringBuild, shadowDistanceAfter;
        public string[] remappedRendererCheck;
    }

    static string Hash(string p) { using var h = SHA256.Create(); return BitConverter.ToString(h.ComputeHash(File.ReadAllBytes(p))).Replace("-", "").ToLowerInvariant(); }
    static Color Srgb(string hex) { if (!ColorUtility.TryParseHtmlString(hex, out var c)) throw new Exception("Bad colour " + hex); return c; }

    public static void BuildLinux()
    {
        if (GraphicsSettings.currentRenderPipeline == null || PlayerSettings.colorSpace != ColorSpace.Linear) throw new Exception("Existing Linear URP project required");
        Directory.CreateDirectory("Evidence"); Directory.CreateDirectory(MaterialDir);
        var receipt = new Receipt { scene = ScenePath, player = Player, editor = Application.unityVersion, scope = "Look-dev scene + Linux development player; captures and counters come from the player run, not this Editor" };
        var inputs = JsonUtility.FromJson<Inputs>(File.ReadAllText(Root + "/lookdev-inputs.json"));
        foreach (var m in inputs.models) { if (Hash(m.path) != m.sha256) throw new Exception("Look-dev GLB hash mismatch " + m.path); AssetDatabase.ImportAsset(m.path, ImportAssetOptions.ForceUpdate); }
        receipt.models = inputs.models;
        receipt.textures = ConfigureTextures();
        var remap = JsonUtility.FromJson<Remap>(File.ReadAllText(Root + "/castlekit-remap.json"));
        var shader = Shader.Find("LastCrossing/CastleKit");
        if (shader == null || ShaderUtil.ShaderHasError(shader)) throw new Exception("CastleKit shader missing or has compile errors");
        var materials = new Dictionary<string, Material>(); var matReceipts = new List<MaterialReceipt>();
        foreach (var e in remap.entries) { var m = MakeMaterial(shader, e, out var mr); materials[e.variant + "/" + e.kilnMaterial] = m; matReceipts.Add(mr); }
        receipt.materials = matReceipts.ToArray();
        receipt.importerMaterials = inputs.models.Select(m => { var mats = AssetDatabase.LoadAllAssetsAtPath(m.path).OfType<Material>().ToArray(); return new ImporterMaterials { glb = m.path, importerCreatedMaterials = mats.Length, names = mats.Select(x => x.name + " [" + x.shader.name + "]").ToArray() }; }).ToArray();

        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        // Castle scene lighting (CastleSliceBuild.CreateScene): sun, flat ambient, linear fog.
        var sun = new GameObject("SiegeSlice_Sun").AddComponent<Light>(); sun.type = LightType.Directional; sun.color = new Color(1, .93f, .81f); sun.intensity = 1.1f; sun.shadows = LightShadows.Soft; sun.transform.rotation = Quaternion.Euler(48, -35, 0);
        RenderSettings.ambientMode = AmbientMode.Flat; RenderSettings.ambientLight = new Color(.37f, .40f, .43f); RenderSettings.fog = true; RenderSettings.fogColor = new Color(.67f, .72f, .73f); RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogStartDistance = 100; RenderSettings.fogEndDistance = 250;
        var ground = GameObject.CreatePrimitive(PrimitiveType.Plane); ground.name = "LookDev_Ground"; UnityEngine.Object.DestroyImmediate(ground.GetComponent<Collider>());
        ground.transform.position = new Vector3(0, 0, 36); ground.transform.localScale = new Vector3(20, 1, 14);
        ground.GetComponent<Renderer>().sharedMaterial = GroundMaterial();
        var roots = new List<GameObject>(); var checks = new List<string>();
        for (int v = 0; v < Variants.Length; v++)
        {
            string variant = Variants[v];
            var root = new GameObject("Variant_" + variant); root.transform.position = new Vector3(0, 0, v * 30);
            Place(inputs, variant, "tower-base-b4", root, new Vector3(0, 0, 0));
            for (int b = 0; b < 3; b++) Place(inputs, variant, "west-curtain-bay-4000", root, new Vector3(0, 0, 5.25f + 4 * b));
            if (variant != "A") checks.Add(RemapVariant(root, variant, materials));
            roots.Add(root);
        }
        receipt.remappedRendererCheck = checks.ToArray();
        // Castle gameplay camera: FOV 68, near 0.08, far 400, default URP camera data (no post-processing).
        var cam = new GameObject("LookDev camera").AddComponent<Camera>(); cam.tag = "MainCamera"; cam.nearClipPlane = .08f; cam.farClipPlane = 400; cam.fieldOfView = 68;
        var capture = new GameObject("LookDev capture").AddComponent<LookDevCapture>();
        capture.view = cam; capture.sun = sun; capture.variants = roots.ToArray(); capture.variantNames = Variants.ToArray();
        capture.buildIdentity = Guid.NewGuid().ToString("N");
        // Unity frame (glTFast mirrors Kiln X): the curtain's outer face is +X, the walk runs +Z, bay joints at z=3.25+4k.
        capture.views = new[]
        {
            new LookDevCapture.ViewDef { name = "front34-20m", position = new Vector3(14.13f, 5f, -6.13f), target = new Vector3(0, 4.2f, 8f) },
            new LookDevCapture.ViewDef { name = "eye-along-wall-1.7m", position = new Vector3(4.0f, 1.7f, 17.5f), target = new Vector3(1.4f, 3.0f, 2.0f) },
            new LookDevCapture.ViewDef { name = "detail-3m", position = new Vector3(4.35f, 1.7f, 8.2f), target = new Vector3(1.4f, 1.2f, 7.6f) },
        };
        capture.overview = new LookDevCapture.ViewDef { name = "overview-all", position = new Vector3(48, 10, 36), target = new Vector3(0, 4, 36) };
        EditorSceneManager.SaveScene(scene, ScenePath); AssetDatabase.SaveAssets();

        var pipeline = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
        receipt.pipelineCascadesBefore = pipeline.shadowCascadeCount; receipt.shadowDistanceBefore = pipeline.shadowDistance;
        try
        {
            // Castle build policy (CastleSliceBuild.QualifyAndBuildWindows): build with 4 cascades / 50 m so the
            // cascade variants survive normal stripping; restored in finally and verified by the outer runner.
            pipeline.shadowCascadeCount = 4; pipeline.shadowDistance = 50; EditorUtility.SetDirty(pipeline); AssetDatabase.SaveAssets();
            receipt.pipelineCascadesDuringBuild = pipeline.shadowCascadeCount; receipt.shadowDistanceDuringBuild = pipeline.shadowDistance;
            Directory.CreateDirectory(Path.GetDirectoryName(Player));
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { ScenePath }, locationPathName = Player, target = BuildTarget.StandaloneLinux64, options = BuildOptions.Development });
            receipt.result = r.summary.result.ToString(); receipt.playerBytes = (long)r.summary.totalSize;
            if (r.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded) throw new Exception("Look-dev Linux build failed: " + r.summary.result);
        }
        finally
        {
            pipeline.shadowCascadeCount = receipt.pipelineCascadesBefore; pipeline.shadowDistance = receipt.shadowDistanceBefore; EditorUtility.SetDirty(pipeline); AssetDatabase.SaveAssets();
            receipt.pipelineCascadesAfter = pipeline.shadowCascadeCount; receipt.shadowDistanceAfter = pipeline.shadowDistance;
            File.WriteAllText("Evidence/lookdev-build.json", JsonUtility.ToJson(receipt, true));
        }
        Debug.Log("LOOKDEV_BUILD_READY " + Player);
    }

    static void Place(Inputs inputs, string variant, string module, GameObject root, Vector3 local)
    {
        var m = inputs.models.Single(x => x.variant == variant && x.module == module);
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(m.path); if (asset == null) throw new Exception("Missing imported model " + m.path);
        var go = (GameObject)PrefabUtility.InstantiatePrefab(asset); PrefabUtility.UnpackPrefabInstance(go, PrefabUnpackMode.Completely, InteractionMode.AutomatedAction);
        go.name = variant + "_" + module + "_" + root.transform.childCount; go.transform.SetParent(root.transform, false); go.transform.localPosition = local;
        foreach (var c in go.GetComponentsInChildren<Collider>()) UnityEngine.Object.DestroyImmediate(c);
    }

    static string RemapVariant(GameObject root, string variant, Dictionary<string, Material> materials)
    {
        int slots = 0;
        foreach (var r in root.GetComponentsInChildren<Renderer>(true))
        {
            var mats = r.sharedMaterials;
            for (int i = 0; i < mats.Length; i++)
            {
                string name = mats[i] == null ? "<null>" : mats[i].name;
                if (!materials.TryGetValue(variant + "/" + name, out var m)) throw new Exception("No CastleKit remap for Kiln material '" + name + "' in variant " + variant + " (" + r.name + ")");
                mats[i] = m; slots++;
            }
            r.sharedMaterials = mats;
        }
        var unique = root.GetComponentsInChildren<Renderer>(true).SelectMany(r => r.sharedMaterials).Distinct().ToArray();
        if (unique.Any(m => m.shader.name != "LastCrossing/CastleKit")) throw new Exception("Variant " + variant + " still references a non-CastleKit material");
        return variant + ": " + slots + " slots -> " + unique.Length + " shared CastleKit materials (" + string.Join(", ", unique.Select(m => m.name)) + ")";
    }

    static Material MakeMaterial(Shader shader, Entry e, out MaterialReceipt mr)
    {
        string path = MaterialDir + "/CK_" + e.variant + "_" + e.kilnMaterial + ".mat";
        var m = AssetDatabase.LoadAssetAtPath<Material>(path); if (m == null) { m = new Material(shader); AssetDatabase.CreateAsset(m, path); }
        m.shader = shader; m.SetColor("_BaseColor", Srgb(e.baseColor)); m.SetFloat("_Roughness", e.roughness); m.SetFloat("_Metallic", e.metallic); m.SetFloat("_VertexColorStrength", 1);
        var tex = new List<string>();
        if (!string.IsNullOrEmpty(e.library))
        {
            string Tex(string slot) => Root + "/Textures/" + e.library + "_" + slot + ".png";
            var albedo = AssetDatabase.LoadAssetAtPath<Texture2D>(Tex("albedo")); var normal = AssetDatabase.LoadAssetAtPath<Texture2D>(Tex("normal")); var orm = AssetDatabase.LoadAssetAtPath<Texture2D>(Tex("orm"));
            if (albedo == null || normal == null || orm == null) throw new Exception("Missing tiling maps for " + e.library);
            m.SetTexture("_BaseMap", albedo); m.SetTexture("_BumpMap", normal); m.SetTexture("_OrmMap", orm); m.SetFloat("_MetersPerTile", e.metersPerTile); m.SetFloat("_NormalStrength", 1); m.SetFloat("_OcclusionStrength", 1);
            m.SetFloat("_Tiling", 1); m.EnableKeyword("_CK_TILING"); tex.AddRange(new[] { Tex("albedo"), Tex("normal"), Tex("orm") });
        }
        else { m.SetFloat("_Tiling", 0); m.DisableKeyword("_CK_TILING"); m.SetTexture("_BaseMap", null); m.SetTexture("_BumpMap", null); m.SetTexture("_OrmMap", null); }
        m.enableInstancing = false; EditorUtility.SetDirty(m);
        mr = new MaterialReceipt { variant = e.variant, kilnMaterial = e.kilnMaterial, asset = path, shader = shader.name, library = e.library, revisionId = e.revisionId, metersPerTile = e.metersPerTile, textures = tex.ToArray() };
        return m;
    }

    static Material GroundMaterial()
    {
        string path = MaterialDir + "/LookDevGround.mat"; var m = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (m == null) { m = new Material(Shader.Find("Universal Render Pipeline/Lit")); AssetDatabase.CreateAsset(m, path); }
        m.SetColor("_BaseColor", new Color(.42f, .40f, .33f)); m.SetFloat("_Smoothness", .1f); EditorUtility.SetDirty(m); return m;
    }

    static TextureReceipt[] ConfigureTextures()
    {
        var list = new List<TextureReceipt>();
        foreach (var file in Directory.GetFiles(Root + "/Textures", "*.png").OrderBy(f => f))
        {
            string p = file.Replace('\\', '/'); var ti = (TextureImporter)AssetImporter.GetAtPath(p);
            bool normal = p.EndsWith("_normal.png"), albedo = p.EndsWith("_albedo.png");
            ti.textureType = normal ? TextureImporterType.NormalMap : TextureImporterType.Default; ti.sRGBTexture = albedo;
            ti.mipmapEnabled = true; ti.wrapMode = TextureWrapMode.Repeat; ti.filterMode = FilterMode.Trilinear; ti.anisoLevel = 4; ti.maxTextureSize = 1024;
            ti.textureCompression = TextureImporterCompression.Compressed; ti.SaveAndReimport();
            var t = AssetDatabase.LoadAssetAtPath<Texture2D>(p);
            list.Add(new TextureReceipt { path = p, sha256 = Hash(p), importerType = ti.textureType.ToString(), sRGB = ti.sRGBTexture, graphicsFormat = t.graphicsFormat.ToString(), width = t.width, height = t.height, mipmaps = t.mipmapCount, maxSize = ti.maxTextureSize, wrap = ti.wrapMode.ToString(), filter = ti.filterMode.ToString(), aniso = ti.anisoLevel });
        }
        return list.ToArray();
    }
}
