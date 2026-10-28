using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using Unity.Profiling;
using UnityEngine;
using UnityEngine.Profiling;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

// Castle material look-dev capture. Runs inside a player with a real graphics device: shows one
// variant at a time, waits for completed camera callbacks, samples the Unity render counters
// (ProfilerRecorder) with shadows on, then reads the RenderTexture back outside the sample window.
public sealed class LookDevCapture : MonoBehaviour
{
    [Serializable] public class ViewDef { public string name; public Vector3 position, target; }
    public Camera view;
    public Light sun;
    public GameObject[] variants;
    public string[] variantNames;
    public ViewDef[] views;
    public ViewDef overview;
    public int sampleFrames = 90, settleCallbacks = 3;
    public string buildIdentity;

    static readonly string[] CounterNames = { "SetPass Calls Count", "Draw Calls Count", "Batches Count", "Triangles Count", "Vertices Count", "Shadow Casters Count", "Used Textures Count", "Used Textures Bytes" };
    [Serializable] class Counter { public string name; public bool valid; public int samples; public double p50, min, max; }
    [Serializable] class ViewResult { public string variant, view, image, sha256; public long callbacksBeforeSample, callbacksDuringSample, callbacksBeforeReadback; public Counter[] counters; public double cpuFrameMsP50 = -1, gpuFrameMsP50 = -1; public Vector3 cameraPosition, cameraTarget; }
    [Serializable] class TextureInfo { public string name, material, graphicsFormat; public int width, height, mipmaps; public long runtimeBytes; }
    [Serializable] class VariantStatic { public string variant; public int renderers, materialSlots, uniqueMaterials, uniqueMeshes; public long triangles, vertices; public string[] materials, shaders; public TextureInfo[] textures; public long textureRuntimeBytes; }
    [Serializable] class Identity { public string unity, gpu, graphicsApi, graphicsDriver, cpu, os, colorSpace, buildIdentity, scope; public bool development, profilerSupported; public int width, height, vramMiB, ramMiB; public int shadowCascades, mainLightShadowResolution; public float shadowDistance, pipelineDepthBias, pipelineNormalBias, sunIntensity, sunShadowStrength; public string sunShadows, sunShadowsEffective; public bool softShadowsSupported, sunUsesPipelineSettings; public Vector3 sunEuler; public string ambient, fog; public float fov, near, far; public bool hdr, postProcessing; }
    [Serializable] class Result { public Identity identity; public VariantStatic[] variants; public List<ViewResult> views = new List<ViewResult>(); public string status; }

    RenderTexture target; long callbacks; string folder; double deadline; bool finished;
    readonly List<ProfilerRecorder> recorders = new List<ProfilerRecorder>();
    UniversalRenderPipelineAsset temporary; RenderPipelineAsset previousDefault, previousQuality;
    readonly Result result = new Result();

    static string Arg(string name, string fallback) { var a = Environment.GetCommandLineArgs(); int i = Array.IndexOf(a, name); return i >= 0 && i + 1 < a.Length ? a[i + 1] : fallback; }
    static string Sha(byte[] b) { using var h = SHA256.Create(); return BitConverter.ToString(h.ComputeHash(b)).Replace("-", "").ToLowerInvariant(); }
    void Log(string m) { Debug.Log("LOOKDEV " + m); File.AppendAllText(Path.Combine(folder, "progress.log"), DateTime.UtcNow.ToString("o") + " " + m + "\n"); }
    void OnRendered(ScriptableRenderContext c, Camera cam) { if (cam == view) callbacks++; }
    void Update() { if (!finished && deadline > 0 && Time.realtimeSinceStartupAsDouble > deadline) { finished = true; Log("error wall timeout"); Application.Quit(2); } }

    IEnumerator Start()
    {
        folder = Path.GetFullPath(Arg("--output", Path.Combine(Application.dataPath, "../LookDevOutput")));
        Directory.CreateDirectory(folder);
        deadline = Time.realtimeSinceStartupAsDouble + 600;
        Application.runInBackground = true; QualitySettings.vSyncCount = 0; Application.targetFrameRate = 30;
        Screen.SetResolution(1280, 720, FullScreenMode.Windowed);
        // Same runtime shadow policy as CastleSiegeGame: a temporary pipeline copy with 4 cascades / 50 m.
        var pipeline = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
        if (pipeline == null) { Log("error URP pipeline missing"); Application.Quit(3); yield break; }
        previousDefault = GraphicsSettings.defaultRenderPipeline; previousQuality = QualitySettings.renderPipeline;
        temporary = Instantiate(pipeline); temporary.shadowCascadeCount = 4; temporary.shadowDistance = 50;
        GraphicsSettings.defaultRenderPipeline = temporary; QualitySettings.renderPipeline = temporary;
        target = new RenderTexture(1280, 720, 24, RenderTextureFormat.ARGB32) { name = "LookDevTarget", antiAliasing = 1 }; target.Create();
        view.targetTexture = target; view.aspect = 1280f / 720f; view.enabled = true;
        RenderPipelineManager.endCameraRendering += OnRendered;
        foreach (var n in CounterNames) { try { recorders.Add(ProfilerRecorder.StartNew(ProfilerCategory.Render, n, 1)); } catch { recorders.Add(default); } }
        result.identity = Describe(temporary);
        result.variants = variants.Select((v, i) => Static(variantNames[i], v)).ToArray();
        Log("start " + JsonUtility.ToJson(result.identity));
        yield return null;
        for (int v = 0; v <= variants.Length; v++)
        {
            string name = v < variants.Length ? variantNames[v] : "baseline-ground-only";
            for (int k = 0; k < variants.Length; k++) variants[k].SetActive(k == v);
            Vector3 origin = v < variants.Length ? variants[v].transform.position : variants[0].transform.position;
            foreach (var def in views) { yield return Measure(name, def, origin); if (finished) yield break; }
        }
        foreach (var g in variants) g.SetActive(true);
        yield return Measure("all", overview, Vector3.zero);
        if (finished) yield break;
        result.status = "complete";
        File.WriteAllText(Path.Combine(folder, "results.json"), JsonUtility.ToJson(result, true));
        Log("complete");
        finished = true;
        GraphicsSettings.defaultRenderPipeline = previousDefault; QualitySettings.renderPipeline = previousQuality;
        Application.Quit(0);
    }

    IEnumerator Measure(string variant, ViewDef def, Vector3 origin)
    {
        view.transform.position = origin + def.position; view.transform.LookAt(origin + def.target);
        long start = callbacks; float wait = Time.realtimeSinceStartup + 15; int frames = 0;
        while ((callbacks - start < settleCallbacks || frames < 10) && Time.realtimeSinceStartup < wait) { frames++; yield return null; }
        if (callbacks - start < settleCallbacks) { finished = true; Log("error no camera callbacks " + variant + "/" + def.name); Application.Quit(4); yield break; }
        var r = new ViewResult { variant = variant, view = def.name, callbacksBeforeSample = callbacks - start, cameraPosition = view.transform.position, cameraTarget = origin + def.target };
        var values = CounterNames.Select(_ => new List<double>()).ToArray(); var cpu = new List<double>(); var gpu = new List<double>(); var timing = new FrameTiming[1];
        long sampleStart = callbacks;
        for (int f = 0; f < sampleFrames; f++)
        {
            FrameTimingManager.CaptureFrameTimings(); yield return null;
            for (int i = 0; i < recorders.Count; i++) if (recorders[i].Valid && recorders[i].Count > 0) values[i].Add(recorders[i].LastValue);
            if (FrameTimingManager.GetLatestTimings(1, timing) > 0) { if (timing[0].cpuFrameTime > 0) cpu.Add(timing[0].cpuFrameTime); if (timing[0].gpuFrameTime > 0) gpu.Add(timing[0].gpuFrameTime); }
        }
        r.callbacksDuringSample = callbacks - sampleStart;
        r.counters = CounterNames.Select((n, i) => Summ(n, recorders[i].Valid, values[i])).ToArray();
        if (cpu.Count > 0) r.cpuFrameMsP50 = Median(cpu); if (gpu.Count > 0) r.gpuFrameMsP50 = Median(gpu);
        r.callbacksBeforeReadback = callbacks - start;
        // Readback and encoding happen after the sample window.
        var old = RenderTexture.active; RenderTexture.active = target;
        var image = new Texture2D(1280, 720, TextureFormat.RGB24, false); image.ReadPixels(new Rect(0, 0, 1280, 720), 0, 0); image.Apply(); RenderTexture.active = old;
        var png = image.EncodeToPNG(); Destroy(image);
        r.image = variant + "-" + def.name + ".png"; r.sha256 = Sha(png); File.WriteAllBytes(Path.Combine(folder, r.image), png);
        result.views.Add(r);
        Log("view " + variant + "/" + def.name + " callbacks=" + r.callbacksBeforeReadback + " setpass=" + r.counters[0].p50 + " draws=" + r.counters[1].p50 + " batches=" + r.counters[2].p50);
    }

    static double Median(List<double> v) { v.Sort(); return v[v.Count / 2]; }
    static Counter Summ(string n, bool valid, List<double> v) { var c = new Counter { name = n, valid = valid, samples = v.Count, p50 = -1, min = -1, max = -1 }; if (v.Count > 0) { v.Sort(); c.p50 = v[v.Count / 2]; c.min = v[0]; c.max = v[v.Count - 1]; } return c; }

    VariantStatic Static(string name, GameObject root)
    {
        var renderers = root.GetComponentsInChildren<Renderer>(true);
        var mats = renderers.SelectMany(r => r.sharedMaterials).Where(m => m != null).Distinct().ToArray();
        var meshes = renderers.OfType<MeshRenderer>().Select(r => r.GetComponent<MeshFilter>().sharedMesh).Where(m => m != null).ToArray();
        var tex = new List<TextureInfo>(); var seen = new HashSet<Texture>();
        foreach (var m in mats) foreach (int id in m.GetTexturePropertyNameIDs()) { var t = m.GetTexture(id); if (t == null || !seen.Add(t)) continue; tex.Add(new TextureInfo { name = t.name, material = m.name, graphicsFormat = t.graphicsFormat.ToString(), width = t.width, height = t.height, mipmaps = t.mipmapCount, runtimeBytes = Profiler.GetRuntimeMemorySizeLong(t) }); }
        return new VariantStatic
        {
            variant = name, renderers = renderers.Length, materialSlots = renderers.Sum(r => r.sharedMaterials.Length), uniqueMaterials = mats.Length,
            uniqueMeshes = meshes.Distinct().Count(), triangles = meshes.Sum(m => Enumerable.Range(0, m.subMeshCount).Sum(s => (long)m.GetIndexCount(s) / 3)), vertices = meshes.Sum(m => (long)m.vertexCount),
            materials = mats.Select(m => m.name).ToArray(), shaders = mats.Select(m => m.shader.name).Distinct().ToArray(), textures = tex.ToArray(), textureRuntimeBytes = tex.Sum(t => t.runtimeBytes)
        };
    }

    Identity Describe(UniversalRenderPipelineAsset p)
    {
        var data = sun.GetComponent<UniversalAdditionalLightData>();
        bool pipelineBias = data != null && data.usePipelineSettings;
        var cam = view.GetComponent<UniversalAdditionalCameraData>();
        return new Identity
        {
            unity = Application.unityVersion, gpu = SystemInfo.graphicsDeviceName, graphicsApi = SystemInfo.graphicsDeviceType.ToString(), graphicsDriver = SystemInfo.graphicsDeviceVersion,
            cpu = SystemInfo.processorType, os = SystemInfo.operatingSystem, colorSpace = QualitySettings.activeColorSpace.ToString(), buildIdentity = buildIdentity,
            scope = "Linux player render counters and captures; not Windows D3D performance", development = Debug.isDebugBuild, profilerSupported = Profiler.supported,
            width = 1280, height = 720, vramMiB = SystemInfo.graphicsMemorySize, ramMiB = SystemInfo.systemMemorySize,
            shadowCascades = p.shadowCascadeCount, shadowDistance = p.shadowDistance, mainLightShadowResolution = p.mainLightShadowmapResolution, pipelineDepthBias = p.shadowDepthBias, pipelineNormalBias = p.shadowNormalBias,
            softShadowsSupported = p.supportsSoftShadows, sunShadows = sun.shadows.ToString(), sunShadowsEffective = sun.shadows == LightShadows.None ? "None" : (sun.shadows == LightShadows.Soft && p.supportsSoftShadows ? "Soft" : "Hard"),
            sunUsesPipelineSettings = pipelineBias, sunIntensity = sun.intensity, sunShadowStrength = sun.shadowStrength, sunEuler = sun.transform.eulerAngles,
            ambient = RenderSettings.ambientMode + " " + RenderSettings.ambientLight, fog = RenderSettings.fog + " " + RenderSettings.fogMode + " " + RenderSettings.fogStartDistance + "-" + RenderSettings.fogEndDistance,
            fov = view.fieldOfView, near = view.nearClipPlane, far = view.farClipPlane, hdr = view.allowHDR, postProcessing = cam != null && cam.renderPostProcessing
        };
    }
}
