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
    // Explicit pre-contract regression path. Never inferred from a missing contract.
    public const string LegacyContract = "legacy-flat-ground-v0";
    // legacyMaterial values: vertex-palette (default) bakes the uniform colour through
    // TerrainVertexPalette; urp-lit-ground keeps the committed URP Lit Ground.mat
    // unmodified for r10 pixel parity and only verifies it matches the declared colour.
    public const string LegacyVertexPalette = "vertex-palette", LegacyUrpLitGround = "urp-lit-ground";
    [Serializable] public class Appearance
    {
        public string sandColor, wetSandColor, grassColor, rockColor;
        public float grassStart, grassEnd, rockSlope, textureScale;
        public Layer[] layers;
    }
    [Serializable] public class Layer { public string id; }
    // Written by castle-world build-slice.mjs exportTerrainContract (holodeck #31).
    [Serializable] public class Source
    {
        public int worldRevision, vertices, triangles;
        public string revisionFile, revisionSha256, terrainRecordSha256, paletteSource, normalsSource;
        public string[] defaultedKeys;
    }
    [Serializable] public class Unsupported { public string id, detail; }
    // What the scene receipt records about the terrain path actually taken.
    public class Result
    {
        public string contract, paletteSource, colorSource, materialPath, materialMode, revisionSha256, terrainRecordSha256;
        public int sourceRevision = -1;
        public string[] sourceColors, unsupported;
    }
    [Serializable] public class Proof
    {
        public string contract, shader, colorSpace, scope, paletteSource, sourceRevisionSha256;
        public int vertices, distinctPaletteResults, authoredLayerCount, sourceRevision;
        public string[] unsupported;
        public float grassStart, grassEnd, rockSlopeRadians, textureScale;
        public string[] sourceColors, limitations;
        public bool fixturePassed;
    }
    struct Palette { public Color soil, wet, grass, rock; }
    static Color ParseSrgb(string value)
    {
        if (value == null || value.Length != 7 || value[0] != '#' || !ColorUtility.TryParseHtmlString(value, out var c))
            throw new Exception("Terrain appearance requires explicit #rrggbb palette colors");
        return c;
    }
    static Color Parse(string value) => ParseSrgb(value).linear;
    static bool Sha(string value) { if (value == null || value.Length != 64) return false; foreach (char ch in value) if (!((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f'))) return false; return true; }
    // Bundle-level provenance gate, applied by CastleSliceBuild before Apply. The
    // in-memory fixtures call Apply directly and do not claim world provenance.
    public static void RequireProvenance(CastleSliceBuild.TerrainMesh record)
    {
        if (record == null || record.positions == null || record.positions.Length == 0) throw new Exception("Bundle has no terrain record");
        if (record.appearanceContract == Contract)
        {
            var s = record.source;
            if (s == null || s.worldRevision < 0 || !Sha(s.revisionSha256) || !Sha(s.terrainRecordSha256) || string.IsNullOrEmpty(s.paletteSource))
                throw new Exception("Terrain v1 bundle lacks source world revision, revision/terrain SHA-256 or palette source; re-export with build-slice.mjs");
            // Holodeck always renders grain/broad-noise detail the subset omits, so an
            // honest export lists at least one unsupported feature; empty means unlisted.
            if (record.unsupported == null || record.unsupported.Length == 0)
                throw new Exception("Terrain v1 bundle must list unsupported Holodeck terrain features explicitly");
        }
        else if (record.appearanceContract == LegacyContract)
        {
            ParseSrgb(record.legacyBaseColor);
            if (string.IsNullOrEmpty(record.legacyBaseColorSource)) throw new Exception("legacy-flat-ground-v0 requires legacyBaseColorSource (where the colour actually came from)");
        }
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
    static void Throws(Action action, string label)
    {
        try { action(); } catch (Exception) { return; }
        throw new Exception("Terrain contract fixture accepted an invalid record: " + label);
    }
    // Contract-gate fixture (no bundle file): v1 provenance and the explicit legacy
    // contract. Writes only the fixture directory and its material.
    public static void RunContractFixture()
    {
        const string directory = "Assets/CastleTerrainFixtureGenerated";
        Directory.CreateDirectory(directory);
        float[] quad = { 0,0,0, 0,0,1, 1,0,0 };
        var source = new Source { worldRevision = 10, revisionSha256 = new string('a', 64), terrainRecordSha256 = new string('b', 64), paletteSource = "fixture" };
        var gaps = new[] { new Unsupported { id = "broad-noise-grass-offset" } };
        Throws(() => Apply(new CastleSliceBuild.TerrainMesh { positions = quad }, new Mesh(), directory), "missing contract");
        Throws(() => RequireProvenance(new CastleSliceBuild.TerrainMesh { positions = quad, appearanceContract = Contract, unsupported = gaps }), "v1 without source");
        Throws(() => RequireProvenance(new CastleSliceBuild.TerrainMesh { positions = quad, appearanceContract = Contract, source = source }), "v1 without unsupported list");
        RequireProvenance(new CastleSliceBuild.TerrainMesh { positions = quad, appearanceContract = Contract, source = source, unsupported = gaps });
        Throws(() => RequireProvenance(new CastleSliceBuild.TerrainMesh { positions = quad, appearanceContract = LegacyContract, legacyBaseColorSource = "fixture" }), "legacy without colour");
        Throws(() => RequireProvenance(new CastleSliceBuild.TerrainMesh { positions = quad, appearanceContract = LegacyContract, legacyBaseColor = "#616e4a" }), "legacy without colour source");
        Throws(() => RequireProvenance(new CastleSliceBuild.TerrainMesh { positions = quad, appearanceContract = LegacyContract, legacyBaseColor = "616e4a", legacyBaseColorSource = "fixture" }), "legacy malformed colour");
        var legacy = new CastleSliceBuild.TerrainMesh { positions = quad, appearanceContract = LegacyContract, legacyBaseColor = "#616e4a", legacyBaseColorSource = "fixture constant" };
        RequireProvenance(legacy);
        var mesh = new Mesh { name = "LegacyContractFixture", vertices = new[] { Vector3.zero, Vector3.forward, Vector3.right }, triangles = new[] { 0, 1, 2 } };
        Apply(legacy, mesh, directory, out var result);
        foreach (var c in mesh.colors) Near(c, Parse("#616e4a"), "legacy uniform colour");
        if (result.contract != LegacyContract || result.materialMode != LegacyVertexPalette || result.colorSource != "fixture constant") throw new Exception("Legacy fixture result not recorded");
        legacy.legacyMaterial = "invented"; Throws(() => Apply(legacy, mesh, directory), "unknown legacyMaterial");
        UnityEngine.Object.DestroyImmediate(mesh);
        Debug.Log("CASTLE_TERRAIN_CONTRACT_FIXTURE_PASSED");
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
    [Serializable] class LegacyProof { public string contract, legacyBaseColor, legacyBaseColorSource, materialMode, material, shader, scope; public float[] materialBaseColor; public float materialSmoothness; public int vertices; public string[] limitations; }
    public static Material Apply(CastleSliceBuild.TerrainMesh record, Mesh mesh, string outputDirectory) => Apply(record, mesh, outputDirectory, out _);
    public static Material Apply(CastleSliceBuild.TerrainMesh record, Mesh mesh, string outputDirectory, out Result result)
    {
        result = new Result { contract = record.appearanceContract };
        if (record.appearanceContract == LegacyContract)
        {
            // Explicit opt-in legacy contract: colour and its recorded source are both required.
            Color srgb = ParseSrgb(record.legacyBaseColor), c = srgb.linear;
            if (string.IsNullOrEmpty(record.legacyBaseColorSource)) throw new Exception("legacy-flat-ground-v0 requires legacyBaseColorSource");
            string mode = string.IsNullOrEmpty(record.legacyMaterial) ? LegacyVertexPalette : record.legacyMaterial;
            Material legacyMat;
            var legacyProof = new LegacyProof { contract = LegacyContract, legacyBaseColor = record.legacyBaseColor, legacyBaseColorSource = record.legacyBaseColorSource, materialMode = mode, vertices = mesh.vertexCount,
                scope = "Explicit pre-contract regression terrain; uniform colour, Unity-recalculated normals" };
            if (mode == LegacyUrpLitGround)
            {
                // Keep the committed URP Lit Ground.mat (and its GUID) untouched. Its stored
                // colour may be the exact pre-contract constant; the hex must be its nearest 8-bit value.
                string path = outputDirectory + "/Ground.mat"; legacyMat = AssetDatabase.LoadAssetAtPath<Material>(path);
                if (legacyMat == null || legacyMat.shader == null || legacyMat.shader.name != "Universal Render Pipeline/Lit")
                    throw new Exception("urp-lit-ground requires the committed URP Lit " + path + "; refusing to recreate it");
                Color stored = legacyMat.GetColor("_BaseColor");
                if (Mathf.Max(Mathf.Abs(stored.r - srgb.r), Mathf.Abs(stored.g - srgb.g), Mathf.Abs(stored.b - srgb.b)) > .5f / 255 + 1e-5f)
                    throw new Exception("Ground.mat _BaseColor " + stored + " does not match legacyBaseColor " + record.legacyBaseColor);
                legacyProof.materialBaseColor = new[] { stored.r, stored.g, stored.b, stored.a }; legacyProof.materialSmoothness = legacyMat.GetFloat("_Smoothness");
                legacyProof.limitations = new[] { "Pre-contract URP Lit material, not Holodeck height/slope appearance", "Pixel parity with the retained r10 player still requires a new native smoke for this bundle identity" };
            }
            else if (mode == LegacyVertexPalette)
            {
                var legacy = new Color[mesh.vertexCount]; for (int i = 0; i < legacy.Length; i++) legacy[i] = c;
                mesh.colors = legacy; legacyMat = GetMaterial(outputDirectory);
                legacyProof.limitations = new[] { "Uniform explicit colour through the diffuse vertex shader; no r10 URP Lit pixel parity", "No Holodeck height/slope appearance" };
            }
            else throw new Exception("Unsupported legacyMaterial '" + mode + "'; use " + LegacyVertexPalette + " or " + LegacyUrpLitGround);
            legacyProof.material = AssetDatabase.GetAssetPath(legacyMat); legacyProof.shader = legacyMat.shader.name;
            Debug.LogWarning("Legacy terrain v0 (" + mode + "): explicit uniform colour " + record.legacyBaseColor + " from " + record.legacyBaseColorSource + "; no appearance parity");
            Directory.CreateDirectory("Evidence"); File.WriteAllText("Evidence/castle-terrain-appearance.json", JsonUtility.ToJson(legacyProof, true));
            result.paletteSource = "legacy-flat-ground-v0 explicit colour"; result.colorSource = record.legacyBaseColorSource; result.materialMode = mode; result.materialPath = legacyProof.material;
            result.sourceColors = new[] { record.legacyBaseColor }; result.unsupported = new[] { "holodeck-heightfield-appearance" };
            return legacyMat;
        }
        if (record.appearanceContract != Contract) throw new Exception("Missing/unsupported terrain appearance contract; export v1 appearance+normals or explicitly declare legacy-flat-ground-v0 with legacyBaseColor and legacyBaseColorSource");
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
        var unsupported = record.unsupported == null ? new string[0] : Array.ConvertAll(record.unsupported, u => u.id);
        var proof = new Proof { contract = Contract, shader = material.shader.name, paletteSource = record.source?.paletteSource, sourceRevision = record.source == null ? -1 : record.source.worldRevision, sourceRevisionSha256 = record.source?.revisionSha256, unsupported = unsupported, colorSpace = "sRGB source hex -> linear Float32 mesh COLOR once", vertices = colors.Length, distinctPaletteResults = distinct.Count,
            grassStart = a.grassStart, grassEnd = a.grassEnd, rockSlopeRadians = a.rockSlope, textureScale = a.textureScale, authoredLayerCount = a.layers == null ? 0 : a.layers.Length,
            sourceColors = new[] { a.sandColor, a.wetSandColor, a.grassColor, a.rockColor }, fixturePassed = true,
            scope = "Baked palette/height/source-normal slope subset; compilation and GPU appearance are separate gates",
            limitations = new[] { "No procedural grain, broad patch noise, detail normals, sand ripples, or textureScale effect", "Authored texture layers are retained in source JSON but not rendered by this subset", "No live water field exported: wet color retained but wet mask disabled (static river box is not an ocean)", "Diffuse main directional light, SH ambient, shadows and fog only; no additional lights, PBR specular, wet roughness, lightmap or decal parity", "Vertex sampling interpolates palette across terrain triangles; Holodeck evaluates blends per fragment" } };
        Directory.CreateDirectory("Evidence"); File.WriteAllText("Evidence/castle-terrain-appearance.json", JsonUtility.ToJson(proof, true));
        result.paletteSource = record.source?.paletteSource; result.colorSource = record.source?.paletteSource; result.materialMode = "vertex-palette"; result.materialPath = AssetDatabase.GetAssetPath(material);
        result.sourceRevision = proof.sourceRevision; result.revisionSha256 = record.source?.revisionSha256; result.terrainRecordSha256 = record.source?.terrainRecordSha256;
        result.sourceColors = proof.sourceColors; result.unsupported = unsupported;
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
