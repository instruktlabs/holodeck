using System;
using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

// Explicit bridge subset: shared palette/height/slope, baked in linear space.
// No claim of Holodeck procedural texture, wet-band, or lighting pixel parity.
public static class CastleTerrainAppearance
{
    public const string Contract = "holodeck-heightfield-appearance-v1";
    [Serializable] public class Appearance
    {
        public string sandColor, wetSandColor, grassColor, rockColor;
        public float grassStart, grassEnd, rockSlope, textureScale;
        public Layer[] layers;
    }
    [Serializable] public class Layer { public string id; }
    [Serializable] public class Proof
    {
        public string contract, shader, colorSpace, scope;
        public int vertices, distinctPaletteResults, authoredLayerCount;
        public float grassStart, grassEnd, rockSlopeRadians, textureScale;
        public string[] sourceColors, limitations;
        public bool fixturePassed;
    }
    struct Palette { public Color soil, wet, grass, rock; }
    static Color Parse(string value)
    {
        if (value == null || value.Length != 7 || value[0] != '#' || !ColorUtility.TryParseHtmlString(value, out var c))
            throw new Exception("Terrain appearance requires explicit #rrggbb palette colors");
        return c.linear;
    }
    static bool Finite(float f) => !float.IsNaN(f) && !float.IsInfinity(f);
    static Palette Validate(Appearance a)
    {
        if (a == null || !Finite(a.grassStart) || !Finite(a.grassEnd) || a.grassStart >= a.grassEnd ||
            !Finite(a.rockSlope) || a.rockSlope < 0 || a.rockSlope > Mathf.PI / 2 || !Finite(a.textureScale) || a.textureScale <= 0)
            throw new Exception("Invalid/missing versioned terrain appearance thresholds");
        return new Palette { soil = Parse(a.sandColor), wet = Parse(a.wetSandColor), grass = Parse(a.grassColor), rock = Parse(a.rockColor) };
    }
    static float Smooth(float start, float end, float value)
    {
        float t = Mathf.Clamp01((value - start) / (end - start));
        return t * t * (3 - 2 * t);
    }
    static Color Evaluate(Appearance a, Palette p, float height, float normalY)
    {
        float threshold = Mathf.Cos(a.rockSlope);
        float rock = 1 - Smooth(threshold - .12f, threshold + .04f, Mathf.Clamp01(normalY));
        // Same base blend as landscape.jsx, with broad-noise centered and no water object.
        float grass = Smooth(a.grassStart, a.grassEnd, height) * (1 - rock);
        return Color.Lerp(Color.Lerp(p.soil, p.grass, grass), p.rock, rock);
    }
    static void Near(Color actual, Color expected, string label)
    {
        if (Mathf.Max(Mathf.Abs(actual.r - expected.r), Mathf.Abs(actual.g - expected.g), Mathf.Abs(actual.b - expected.b)) > 1e-5f)
            throw new Exception("Terrain palette fixture failed: " + label);
    }
    public static void RunFixture()
    {
        var a = new Appearance { sandColor = "#858576", wetSandColor = "#555f59", grassColor = "#66764a", rockColor = "#777a77", grassStart = -1, grassEnd = 5, rockSlope = .42f, textureScale = 1 };
        var p = Validate(a);
        Near(Evaluate(a, p, -2, 1), Parse("#858576"), "flat soil below -1m");
        Near(Evaluate(a, p, 6, 1), Parse("#66764a"), "flat grass above 5m");
        Near(Evaluate(a, p, 6, 0), Parse("#777a77"), "vertical rock overrides grass");
        Near(Evaluate(a, p, 2, 1), Color.Lerp(p.soil, p.grass, .5f), "height midpoint");
        // At the authored slope angle the asymmetric -.12/+.04 cosine transition has rock weight .15625.
        Near(Evaluate(a, p, -2, Mathf.Cos(.42f)), Color.Lerp(p.soil, p.rock, .15625f), "radian threshold semantics");
        Debug.Log("CASTLE_TERRAIN_PALETTE_FIXTURE_PASSED");
    }
    [Serializable] class ImportProof { public string unity, status, shader; public string[] messages; public int vertices; public string limitation; }
    // Isolated import fixture: never reads/writes the canonical slice bundle or playable scene.
    public static void RunImportFixture()
    {
        const string directory = "Assets/CastleTerrainFixtureGenerated";
        var proof = new ImportProof { unity = Application.unityVersion, status = "started", limitation = "Editor import/compiler diagnostics and palette numerics only; no GPU frame or player shader-variant qualification" };
        Directory.CreateDirectory("Evidence"); Directory.CreateDirectory(directory);
        try
        {
            RunFixture();
            AssetDatabase.ImportAsset("Assets/Shaders/TerrainVertexPalette.shader", ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            var a = new Appearance { sandColor = "#858576", wetSandColor = "#555f59", grassColor = "#66764a", rockColor = "#777a77", grassStart = -1, grassEnd = 5, rockSlope = .42f, textureScale = 1 };
            var points = new[] { new Vector3(0,-2,0),new Vector3(0,-2,2),new Vector3(2,-2,0),new Vector3(2,-2,2),
                new Vector3(4,6,0),new Vector3(4,6,2),new Vector3(6,6,0),new Vector3(6,6,2),
                new Vector3(8,0,0),new Vector3(8,2,0),new Vector3(8,0,2),new Vector3(8,2,2) };
            var normalData = new float[36]; for (int i = 0; i < 12; i++) { if (i < 8) normalData[i*3+1] = 1; else normalData[i*3] = -1; }
            var mesh = new Mesh { name = "SoilGrassRockFixture" }; mesh.vertices = points;
            mesh.triangles = new[] {0,1,2,2,1,3,4,5,6,6,5,7,8,9,10,10,9,11}; mesh.RecalculateNormals(); mesh.RecalculateBounds();
            var material = Apply(new CastleSliceBuild.TerrainMesh { appearanceContract = Contract, appearance = a, normals = normalData }, mesh, directory);
            var colors = mesh.colors;
            for (int i = 0; i < 12; i++) Near(colors[i], Parse(i < 4 ? a.sandColor : i < 8 ? a.grassColor : a.rockColor), "baked fixture vertex " + i);
            string meshPath = directory + "/PaletteFixture.asset"; var existing = AssetDatabase.LoadAssetAtPath<Mesh>(meshPath);
            if (existing == null) AssetDatabase.CreateAsset(mesh, meshPath); else { EditorUtility.CopySerialized(mesh, existing); UnityEngine.Object.DestroyImmediate(mesh); mesh = existing; }
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var obj = new GameObject("Terrain palette fixture only"); obj.AddComponent<MeshFilter>().sharedMesh = mesh; obj.AddComponent<MeshRenderer>().sharedMaterial = material;
            var light = new GameObject("Fixture sun").AddComponent<Light>(); light.type = LightType.Directional; light.shadows = LightShadows.Soft; light.transform.rotation = Quaternion.Euler(45,-30,0);
            var camera = new GameObject("Fixture camera").AddComponent<Camera>(); camera.transform.position = new Vector3(13,9,-12); camera.transform.LookAt(new Vector3(4,2,1)); camera.nearClipPlane = .1f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat; RenderSettings.ambientLight = new Color(.3f,.3f,.3f);
            EditorSceneManager.SaveScene(scene, directory + "/PaletteFixture.unity"); AssetDatabase.SaveAssets();
            var messages = ShaderUtil.GetShaderMessages(material.shader); proof.messages = new string[messages.Length];
            for (int i = 0; i < messages.Length; i++) { proof.messages[i] = messages[i].severity + ": " + messages[i].message; if (messages[i].severity.ToString() == "Error") throw new Exception("Terrain shader import error: " + messages[i].message); }
            proof.shader = material.shader.name; proof.vertices = mesh.vertexCount; proof.status = "passed-editor-import-and-palette-fixture";
            Debug.Log("CASTLE_TERRAIN_IMPORT_FIXTURE_PASSED " + Application.unityVersion);
        }
        catch (Exception e) { proof.status = "failed: " + e.Message; throw; }
        finally { File.WriteAllText("Evidence/castle-terrain-import-fixture.json", JsonUtility.ToJson(proof, true)); }
    }
    public static Material Apply(CastleSliceBuild.TerrainMesh record, Mesh mesh, string outputDirectory)
    {
        if (record.appearanceContract == "legacy-flat-ground-v0")
        {
            // Explicit opt-in legacy contract, never silently infer or hardcode green.
            Color c = Parse(record.legacyBaseColor);
            var legacy = new Color[mesh.vertexCount]; for (int i = 0; i < legacy.Length; i++) legacy[i] = c;
            mesh.colors = legacy;
            Debug.LogWarning("Legacy terrain v0: uniform explicit palette, no appearance parity");
            return GetMaterial(outputDirectory);
        }
        if (record.appearanceContract != Contract) throw new Exception("Missing/unsupported terrain appearance contract; export v1 appearance+normals or explicitly declare legacy-flat-ground-v0 with legacyBaseColor");
        var a = record.appearance; var palette = Validate(a);
        if (record.normals == null || record.normals.Length != mesh.vertexCount * 3) throw new Exception("Terrain appearance v1 requires shared source normals");
        RunFixture();
        var positions = mesh.vertices; var normals = new Vector3[positions.Length]; var colors = new Color[positions.Length];
        var distinct = new System.Collections.Generic.HashSet<Color>();
        for (int i = 0; i < positions.Length; i++)
        {
            var n = new Vector3(-record.normals[i * 3], record.normals[i * 3 + 1], record.normals[i * 3 + 2]);
            if (!Finite(n.x) || !Finite(n.y) || !Finite(n.z) || n.sqrMagnitude < .5f || !Finite(positions[i].y)) throw new Exception("Invalid terrain normal/height at vertex " + i);
            normals[i] = n.normalized; colors[i] = Evaluate(a, palette, positions[i].y, normals[i].y); distinct.Add(colors[i]);
        }
        mesh.normals = normals; mesh.colors = colors;
        var material = GetMaterial(outputDirectory);
        var proof = new Proof { contract = Contract, shader = material.shader.name, colorSpace = "sRGB source hex -> linear Float32 mesh COLOR once", vertices = colors.Length, distinctPaletteResults = distinct.Count,
            grassStart = a.grassStart, grassEnd = a.grassEnd, rockSlopeRadians = a.rockSlope, textureScale = a.textureScale, authoredLayerCount = a.layers == null ? 0 : a.layers.Length,
            sourceColors = new[] { a.sandColor, a.wetSandColor, a.grassColor, a.rockColor }, fixturePassed = true,
            scope = "Baked palette/height/source-normal slope subset; compilation and GPU appearance are separate gates",
            limitations = new[] { "No procedural grain, broad patch noise, detail normals, sand ripples, or textureScale effect", "Authored texture layers are retained in source JSON but not rendered by this subset", "No live water field exported: wet color retained but wet mask disabled (static river box is not an ocean)", "Diffuse main directional light, SH ambient, shadows and fog only; no additional lights, PBR specular, wet roughness, lightmap or decal parity", "Vertex sampling interpolates palette across terrain triangles; Holodeck evaluates blends per fragment" } };
        Directory.CreateDirectory("Evidence"); File.WriteAllText("Evidence/castle-terrain-appearance.json", JsonUtility.ToJson(proof, true));
        return material;
    }
    static Material GetMaterial(string directory)
    {
        var shader = Shader.Find("LastCrossing/TerrainVertexPalette");
        if (shader == null) throw new Exception("Terrain vertex palette shader missing; refusing uniform fallback");
        string path = directory + "/TerrainPalette.mat"; var material = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (material == null) { material = new Material(shader); AssetDatabase.CreateAsset(material, path); }
        else if (material.shader != shader) material.shader = shader;
        EditorUtility.SetDirty(material); return material;
    }
}
