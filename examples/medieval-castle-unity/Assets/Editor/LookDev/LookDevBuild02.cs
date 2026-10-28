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

// Castle material look-dev, run 02 (2026-10-27). Builds LookDev02.unity and a Linux development player
// from Run02/run02-scene.json, Run02/run02-materials.json and Run02/run02-inputs.json.
// Run 01 is only read: LookDev.unity, the CK_C_* materials and the run-01 texture importers are not
// modified (variant C references the CK_C_* assets as they are). This script creates CK_D_* (run-02
// maps), CK_Dalb_* (run-02 albedo only, for the rendered-mean check), CK_F_* (flat Kiln factor),
// CK_ID_* (unlit material ids) and CK_R_* (CK_C copies on the run-01 reference shader), and configures
// texture importers under Textures/run02 only. Lighting, camera and shadow policy are run 01's.
public static class LookDevBuild02
{
    const string Root = "Assets/LookDev", Run = Root + "/Run02", ScenePath = Root + "/LookDev02.unity", MaterialDir = Root + "/Materials";
    const string Player = "Builds/LookDev02Linux/LookDev02.x86_64";

    [Serializable] class Inputs { public Model[] models; }
    [Serializable] class Model { public string key, path, sha256, source; }
    [Serializable] class MatDef
    {
        public string variant, kilnMaterial, asset, existing, shader, mode, maps, note;
        public float[] baseColorLinear;
        public float metersPerTile = 1, sharpness = 8, macroScale = 17, macroStrength = 0.05f, macroHue = 0.012f;
        public float roughness = 0.95f, metallic, normalStrength = 1, occlusionStrength = 1, vertexColorStrength = 1, detileScale = 9;
        public bool macro, detile;
    }
    [Serializable] class MatTable { public MatDef[] materials; public string[] groundIds; }
    [Serializable] class Placement { public string model; public float[] position; public float yawUnityDeg; }
    [Serializable] class PlaneDef { public float[] position, size; }
    [Serializable] public class ViewJson { public string name, note; public float[] position, target; public float distanceM, orthoSize; public bool orthographic; public string[] variants; }
    [Serializable] class Group { public string name; public string[] variants; public Placement[] placements; public PlaneDef[] planes; public bool terrain; public ViewJson[] views; }
    [Serializable] class SceneJson { public string schema; public int[] resolution; public Group[] groups; }
    [Serializable] class TerrainMeta { public float holodeckXmin, holodeckZmin, spacing; public int cols, rows; public string bytesSha256; }
    [Serializable] class TextureReceipt { public string path, sha256, importerType, graphicsFormat; public bool sRGB; public int width, height, mipmaps, maxSize; public string wrap, filter; public int aniso; }
    [Serializable] class MaterialReceipt { public string variant, kilnMaterial, asset, shader, mode, maps; public string[] keywords; public float metersPerTile, sharpness; public bool macro; }
    [Serializable] class Receipt
    {
        public string scene, player, editor, scope, result; public long playerBytes;
        public Model[] models; public TextureReceipt[] textures; public MaterialReceipt[] materials; public string[] remapChecks;
        public int pipelineCascadesBefore, pipelineCascadesAfter; public float shadowDistanceBefore, shadowDistanceAfter;
        public string terrainMesh; public int terrainVertices, terrainTriangles;
    }

    static string Hash(string p) { using var h = SHA256.Create(); return BitConverter.ToString(h.ComputeHash(File.ReadAllBytes(p))).Replace("-", "").ToLowerInvariant(); }
    static Vector3 V(float[] a) => new Vector3(a[0], a[1], a[2]);

    public static void BuildLinux()
    {
        if (GraphicsSettings.currentRenderPipeline == null || PlayerSettings.colorSpace != ColorSpace.Linear) throw new Exception("Existing Linear URP project required");
        Directory.CreateDirectory("Evidence");
        var receipt = new Receipt { scene = ScenePath, player = Player, editor = Application.unityVersion, scope = "Look-dev run 02 scene + Linux development player; captures and counters come from the player run" };
        var inputs = JsonUtility.FromJson<Inputs>(File.ReadAllText(Run + "/run02-inputs.json"));
        foreach (var m in inputs.models) { if (Hash(m.path) != m.sha256) throw new Exception("Look-dev GLB hash mismatch " + m.path); AssetDatabase.ImportAsset(m.path, ImportAssetOptions.ForceUpdate); }
        receipt.models = inputs.models;
        receipt.textures = ConfigureTextures();
        var table = JsonUtility.FromJson<MatTable>(File.ReadAllText(Run + "/run02-materials.json"));
        var mats = new Dictionary<string, Material>(); var mrs = new List<MaterialReceipt>();
        foreach (var d in table.materials) { mats[d.variant + "/" + d.kilnMaterial] = MakeMaterial(d, out var mr); mrs.Add(mr); }
        receipt.materials = mrs.ToArray();
        AssetDatabase.SaveAssets();

        var sceneJson = JsonUtility.FromJson<SceneJson>(File.ReadAllText(Run + "/run02-scene.json"));
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        // Run 01 lighting (= CastleSliceBuild.CreateScene): sun, flat ambient, linear fog.
        var sun = new GameObject("SiegeSlice_Sun").AddComponent<Light>(); sun.type = LightType.Directional; sun.color = new Color(1, .93f, .81f); sun.intensity = 1.1f; sun.shadows = LightShadows.Soft; sun.transform.rotation = Quaternion.Euler(48, -35, 0);
        RenderSettings.ambientMode = AmbientMode.Flat; RenderSettings.ambientLight = new Color(.37f, .40f, .43f); RenderSettings.fog = true; RenderSettings.fogColor = new Color(.67f, .72f, .73f); RenderSettings.fogMode = FogMode.Linear; RenderSettings.fogStartDistance = 100; RenderSettings.fogEndDistance = 250;
        var ground = AssetDatabase.LoadAssetAtPath<Material>(MaterialDir + "/LookDevGround.mat"); if (ground == null) throw new Exception("Run-01 LookDevGround.mat missing");
        var terrainMesh = BuildTerrainMesh(receipt);
        var models = inputs.models.ToDictionary(m => m.key, m => m);

        var groups = new List<LookDevCapture02.GroupDef>(); var checks = new List<string>();
        foreach (var g in sceneJson.groups)
        {
            var gd = new LookDevCapture02.GroupDef { name = g.name, width = sceneJson.resolution[0], height = sceneJson.resolution[1], sampleFrames = 60 };
            var roots = new List<GameObject>(); var names = new List<string>();
            foreach (var variant in new[] { "C", "D", "F", "Dalb", "ID" })
            {
                var root = new GameObject(g.name + "_" + variant);
                foreach (var p in g.placements) Place(models[p.model].path, root, V(p.position), p.yawUnityDeg);
                foreach (var pl in g.planes)
                {
                    var go = GameObject.CreatePrimitive(PrimitiveType.Plane); go.name = "Ground"; UnityEngine.Object.DestroyImmediate(go.GetComponent<Collider>());
                    go.transform.SetParent(root.transform, false); go.transform.position = V(pl.position); go.transform.localScale = new Vector3(pl.size[0] / 10f, 1, pl.size[1] / 10f);
                    go.GetComponent<Renderer>().sharedMaterial = variant == "ID" ? mats["ID/ground"] : ground;
                }
                if (g.terrain)
                {
                    var t = new GameObject("GorgeTerrain"); t.transform.SetParent(root.transform, false);
                    t.AddComponent<MeshFilter>().sharedMesh = terrainMesh; var r = t.AddComponent<MeshRenderer>(); r.sharedMaterial = mats[variant + "/terrain-rock"]; r.shadowCastingMode = ShadowCastingMode.On;
                }
                checks.Add(Remap(root, variant, mats));
                root.SetActive(false); roots.Add(root); names.Add(variant);
            }
            gd.roots = roots.ToArray(); gd.variantNames = names.ToArray();
            gd.views = g.views.Select(v => new LookDevCapture02.ViewDef { name = v.name, position = V(v.position), target = V(v.target), orthographic = v.orthographic, orthoSize = v.orthoSize, variants = v.variants }).ToArray();
            groups.Add(gd);
        }

        // Regression group: run 01's C subject, ground and views at run 01's world positions (origin z = 60),
        // rendered with the CK_C assets (current shader, new keywords off), CK_R (run-01 reference shader)
        // and CK_D (run-02 materials on the run-01 subject, for cost against run 01).
        {
            var gd = new LookDevCapture02.GroupDef { name = "regression-run01", width = 1280, height = 720, sampleFrames = 90 };
            var roots = new List<GameObject>(); var names = new List<string>(); var origin = new Vector3(0, 0, 60);
            foreach (var variant in new[] { "C", "R", "D" })
            {
                var root = new GameObject("regression_" + variant);
                var g0 = GameObject.CreatePrimitive(PrimitiveType.Plane); g0.name = "LookDev_Ground"; UnityEngine.Object.DestroyImmediate(g0.GetComponent<Collider>());
                g0.transform.SetParent(root.transform, false); g0.transform.position = new Vector3(0, 0, 36); g0.transform.localScale = new Vector3(20, 1, 14); g0.GetComponent<Renderer>().sharedMaterial = ground;
                Place(models["run01-tower-base-b4"].path, root, origin, 0);
                for (int b = 0; b < 3; b++) Place(models["run01-west-curtain-bay-4000"].path, root, origin + new Vector3(0, 0, 5.25f + 4 * b), 0);
                checks.Add(Remap(root, variant, mats));
                root.SetActive(false); roots.Add(root); names.Add(variant);
            }
            gd.roots = roots.ToArray(); gd.variantNames = names.ToArray();
            string[] all = { "C", "R", "D" };
            gd.views = new[]
            {
                new LookDevCapture02.ViewDef { name = "front34-20m", position = origin + new Vector3(14.13f, 5f, -6.13f), target = origin + new Vector3(0, 4.2f, 8f), variants = all },
                new LookDevCapture02.ViewDef { name = "eye-along-wall-1.7m", position = origin + new Vector3(4.0f, 1.7f, 17.5f), target = origin + new Vector3(1.4f, 3.0f, 2.0f), variants = all },
                new LookDevCapture02.ViewDef { name = "detail-3m", position = origin + new Vector3(4.35f, 1.7f, 8.2f), target = origin + new Vector3(1.4f, 1.2f, 7.6f), variants = all },
            };
            groups.Insert(0, gd);
        }
        receipt.remapChecks = checks.ToArray();

        // Run 01 camera: FOV 68, near 0.08, far 400, default URP camera data (no post-processing).
        var cam = new GameObject("LookDev camera").AddComponent<Camera>(); cam.tag = "MainCamera"; cam.nearClipPlane = .08f; cam.farClipPlane = 400; cam.fieldOfView = 68;
        var capture = new GameObject("LookDev capture").AddComponent<LookDevCapture02>();
        capture.view = cam; capture.sun = sun; capture.groups = groups.ToArray(); capture.buildIdentity = Guid.NewGuid().ToString("N");
        EditorSceneManager.SaveScene(scene, ScenePath); AssetDatabase.SaveAssets();

        var pipeline = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
        receipt.pipelineCascadesBefore = pipeline.shadowCascadeCount; receipt.shadowDistanceBefore = pipeline.shadowDistance;
        try
        {
            // Run 01 build policy: 4 cascades / 50 m during the build so the cascade variants survive stripping.
            pipeline.shadowCascadeCount = 4; pipeline.shadowDistance = 50; EditorUtility.SetDirty(pipeline); AssetDatabase.SaveAssets();
            Directory.CreateDirectory(Path.GetDirectoryName(Player));
            var r = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] { ScenePath }, locationPathName = Player, target = BuildTarget.StandaloneLinux64, options = BuildOptions.Development });
            receipt.result = r.summary.result.ToString(); receipt.playerBytes = (long)r.summary.totalSize;
            if (r.summary.result != UnityEditor.Build.Reporting.BuildResult.Succeeded) throw new Exception("Look-dev 02 Linux build failed: " + r.summary.result);
        }
        finally
        {
            pipeline.shadowCascadeCount = receipt.pipelineCascadesBefore; pipeline.shadowDistance = receipt.shadowDistanceBefore; EditorUtility.SetDirty(pipeline); AssetDatabase.SaveAssets();
            receipt.pipelineCascadesAfter = pipeline.shadowCascadeCount; receipt.shadowDistanceAfter = pipeline.shadowDistance;
            File.WriteAllText("Evidence/lookdev02-build.json", JsonUtility.ToJson(receipt, true));
        }
        Debug.Log("LOOKDEV02_BUILD_READY " + Player);
    }

    static void Place(string path, GameObject root, Vector3 position, float yaw)
    {
        var asset = AssetDatabase.LoadAssetAtPath<GameObject>(path); if (asset == null) throw new Exception("Missing imported model " + path);
        var go = (GameObject)PrefabUtility.InstantiatePrefab(asset); PrefabUtility.UnpackPrefabInstance(go, PrefabUnpackMode.Completely, InteractionMode.AutomatedAction);
        go.name = Path.GetFileNameWithoutExtension(path) + "_" + root.transform.childCount; go.transform.SetParent(root.transform, false);
        go.transform.position = position; go.transform.rotation = Quaternion.Euler(0, yaw, 0);
        foreach (var c in go.GetComponentsInChildren<Collider>()) UnityEngine.Object.DestroyImmediate(c);
    }

    static string Remap(GameObject root, string variant, Dictionary<string, Material> materials)
    {
        int slots = 0;
        foreach (var r in root.GetComponentsInChildren<Renderer>(true))
        {
            if (r.gameObject.name == "Ground" || r.gameObject.name == "LookDev_Ground" || r.gameObject.name == "GorgeTerrain") continue;
            var ms = r.sharedMaterials;
            for (int i = 0; i < ms.Length; i++)
            {
                string name = ms[i] == null ? "<null>" : ms[i].name;
                if (!materials.TryGetValue(variant + "/" + name, out var m)) throw new Exception("No run-02 remap for Kiln material '" + name + "' in variant " + variant + " (" + r.name + ")");
                ms[i] = m; slots++;
            }
            r.sharedMaterials = ms;
        }
        var unique = root.GetComponentsInChildren<Renderer>(true).SelectMany(r => r.sharedMaterials).Distinct().ToArray();
        return root.name + ": " + slots + " remapped slots -> " + unique.Length + " materials (" + string.Join(", ", unique.Select(m => m.name + " [" + m.shader.name + "]")) + ")";
    }

    static Material MakeMaterial(MatDef d, out MaterialReceipt mr)
    {
        Material m;
        if (!string.IsNullOrEmpty(d.existing))
        {
            // Variant C: the run-01 asset itself, read only (never dirtied or saved here).
            m = AssetDatabase.LoadAssetAtPath<Material>(Root + "/" + d.existing); if (m == null) throw new Exception("Missing run-01 material " + d.existing);
            mr = new MaterialReceipt { variant = d.variant, kilnMaterial = d.kilnMaterial, asset = Root + "/" + d.existing, shader = m.shader.name, mode = "existing", keywords = m.shaderKeywords };
            return m;
        }
        var shader = Shader.Find(d.shader); if (shader == null || ShaderUtil.ShaderHasError(shader)) throw new Exception("Shader missing or has compile errors: " + d.shader);
        string path = MaterialDir + "/" + d.asset + ".mat";
        m = AssetDatabase.LoadAssetAtPath<Material>(path); if (m == null) { m = new Material(shader); AssetDatabase.CreateAsset(m, path); }
        m.shader = shader; m.shaderKeywords = new string[0];
        var c = d.baseColorLinear != null && d.baseColorLinear.Length == 3 ? new Color(d.baseColorLinear[0], d.baseColorLinear[1], d.baseColorLinear[2], 1) : Color.white;
        if (d.mode == "unlit") { m.SetColor("_BaseColor", c.gamma); }
        else if (d.mode == "reference")
        {
            // CK_C copy on the run-01 reference shader: copy every run-01 property, then swap the shader.
            var src = AssetDatabase.LoadAssetAtPath<Material>(Root + "/" + d.maps); if (src == null) throw new Exception("Missing reference source " + d.maps);
            m.CopyPropertiesFromMaterial(src); m.shader = shader; m.shaderKeywords = src.shaderKeywords;
        }
        else
        {
            // Shader colour properties take sRGB-authored colours; .gamma of the linear factor round-trips exactly.
            m.SetColor("_BaseColor", c.gamma); m.SetFloat("_Roughness", d.roughness); m.SetFloat("_Metallic", d.metallic); m.SetFloat("_VertexColorStrength", d.vertexColorStrength);
            m.SetFloat("_NormalStrength", d.normalStrength); m.SetFloat("_OcclusionStrength", d.occlusionStrength); m.SetFloat("_MetersPerTile", d.metersPerTile);
            m.SetFloat("_TriplanarSharpness", d.sharpness); m.SetFloat("_MacroScale", d.macroScale); m.SetFloat("_MacroStrength", d.macroStrength); m.SetFloat("_MacroHue", d.macroHue);
            bool maps = d.mode == "tiling" || d.mode == "triplanar";
            if (maps)
            {
                string Tex(string slot) => Root + "/" + d.maps + "_" + slot + ".png";
                var albedo = AssetDatabase.LoadAssetAtPath<Texture2D>(Tex("albedo")); var normal = AssetDatabase.LoadAssetAtPath<Texture2D>(Tex("normal")); var orm = AssetDatabase.LoadAssetAtPath<Texture2D>(Tex("orm"));
                if (albedo == null || normal == null || orm == null) throw new Exception("Missing maps for " + d.maps);
                m.SetTexture("_BaseMap", albedo); m.SetTexture("_BumpMap", normal); m.SetTexture("_OrmMap", orm);
            }
            else { m.SetTexture("_BaseMap", null); m.SetTexture("_BumpMap", null); m.SetTexture("_OrmMap", null); }
            m.SetFloat("_Tiling", d.mode == "tiling" ? 1 : 0); m.SetFloat("_Triplanar", d.mode == "triplanar" ? 1 : 0); m.SetFloat("_Macro", d.macro ? 1 : 0);
            if (d.mode == "tiling") m.EnableKeyword("_CK_TILING"); else m.DisableKeyword("_CK_TILING");
            if (d.mode == "triplanar") m.EnableKeyword("_CK_TRIPLANAR"); else m.DisableKeyword("_CK_TRIPLANAR");
            if (d.macro) m.EnableKeyword("_CK_MACRO"); else m.DisableKeyword("_CK_MACRO");
            m.SetFloat("_Detile", d.detile && d.mode == "triplanar" ? 1 : 0); m.SetFloat("_DetileScale", d.detileScale);
            if (d.detile && d.mode == "triplanar") m.EnableKeyword("_CK_DETILE"); else m.DisableKeyword("_CK_DETILE");
        }
        m.enableInstancing = false; EditorUtility.SetDirty(m);
        mr = new MaterialReceipt { variant = d.variant, kilnMaterial = d.kilnMaterial, asset = path, shader = shader.name, mode = d.mode, maps = d.maps, keywords = m.shaderKeywords, metersPerTile = d.metersPerTile, sharpness = d.sharpness, macro = d.macro };
        return m;
    }

    static Mesh BuildTerrainMesh(Receipt receipt)
    {
        // B6 heightmap crop (Holodeck metres, float32 LE, rows south to north). Unity x = -Holodeck x.
        var meta = JsonUtility.FromJson<TerrainMeta>(File.ReadAllText(Run + "/gorge-height.json"));
        var bytes = File.ReadAllBytes(Run + "/gorge-height.bytes");
        if (Hash(Run + "/gorge-height.bytes") != meta.bytesSha256) throw new Exception("Terrain crop hash mismatch");
        int cols = meta.cols, rows = meta.rows; var verts = new Vector3[cols * rows]; var uv = new Vector2[verts.Length]; var col = new Color[verts.Length];
        for (int j = 0; j < rows; j++)
            for (int i = 0; i < cols; i++)
            {
                int k = j * cols + i; float x = meta.holodeckXmin + i * meta.spacing, z = meta.holodeckZmin + j * meta.spacing, y = BitConverter.ToSingle(bytes, k * 4);
                verts[k] = new Vector3(-x, y, z); uv[k] = new Vector2(x, z); col[k] = new Color(0.92f, 0.92f, 0.92f, 1);
            }
        var tris = new List<int>((cols - 1) * (rows - 1) * 6);
        for (int j = 0; j < rows - 1; j++)
            for (int i = 0; i < cols - 1; i++)
            {
                int a = j * cols + i, b = a + 1, c = a + cols, d = c + 1;
                tris.AddRange(new[] { a, c, b, b, c, d });
            }
        var mesh = new Mesh { name = "b6-gorge-crop", indexFormat = verts.Length > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
        mesh.vertices = verts; mesh.uv = uv; mesh.colors = col; mesh.SetTriangles(tris, 0); mesh.RecalculateNormals();
        if (mesh.normals.Average(n => n.y) < 0) { tris.Reverse(); mesh.SetTriangles(tris, 0); mesh.RecalculateNormals(); }
        mesh.RecalculateBounds();
        string path = Run + "/b6-gorge-crop.asset"; AssetDatabase.DeleteAsset(path); AssetDatabase.CreateAsset(mesh, path);
        receipt.terrainMesh = path; receipt.terrainVertices = verts.Length; receipt.terrainTriangles = tris.Count / 3;
        return mesh;
    }

    static TextureReceipt[] ConfigureTextures()
    {
        // Only the run-02 folder: run 01's importers in Textures/ are left as they are.
        var list = new List<TextureReceipt>();
        foreach (var file in Directory.GetFiles(Root + "/Textures/run02", "*.png").OrderBy(f => f, StringComparer.Ordinal))
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
