using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public static class SiegeBridge
{
    public static void RunChecks()
    {
        VerifyReimport(); VerifyRejectedHash(); ValidateScene();
        Debug.Log("SIEGE_CHECKS_PASSED");
    }
    [Serializable] public class Bundle { public int revision; public Asset[] assets; public Placement[] placements; }
    [Serializable] public class Asset { public string id, file, sha256; }
    [Serializable] public class Placement { public string id, asset; public float[] position, rotation, scale; public ColliderSpec collider; }
    [Serializable] public class ColliderSpec { public Box[] boxes; }
    [Serializable] public class Box { public float[] size, offset; }
    static string Root => "Assets/Generated";
    static Vector3 V(float[] v) => new Vector3(v[0],v[1],v[2]);
    // glTFast's standard import reflects X. Apply that same basis to placements and colliders once.
    static Vector3 Point(float[] v) => new Vector3(-v[0],v[1],v[2]);
    static Bundle Read() => JsonUtility.FromJson<Bundle>(File.ReadAllText("Assets/SiegeBundle/bundle.json"));
    public static void ValidateBundle()
    {
        var b=Read();
        if(b.assets==null || b.placements==null || b.assets.Select(x=>x.id).Distinct().Count()!=b.assets.Length || b.placements.Select(x=>x.id).Distinct().Count()!=b.placements.Length) throw new Exception("Missing or duplicate IDs");
        foreach(var a in b.assets) {
            var p="Assets/SiegeBundle/"+a.id+".glb";
            using var hash=SHA256.Create();
            var actual="sha256:"+BitConverter.ToString(hash.ComputeHash(File.ReadAllBytes(p))).Replace("-","").ToLowerInvariant();
            if(actual!=a.sha256) throw new Exception("Hash mismatch: "+a.id);
            if(AssetDatabase.LoadAssetAtPath<GameObject>(p)==null) throw new Exception("GLB has not imported: "+p);
        }
        foreach(var p in b.placements) {
            if(!b.assets.Any(a=>a.id==p.asset)) throw new Exception("Unknown asset "+p.asset);
            foreach(var v in new[]{p.position,p.rotation,p.scale}) if(v==null||v.Length!=3||v.Any(x=>float.IsNaN(x)||float.IsInfinity(x))) throw new Exception("Invalid transform "+p.id);
            if(p.scale.Any(x=>x<=0)) throw new Exception("Unsupported scale "+p.id);
        }
    }
    public static void ImportBundle()
    {
        ValidateBundle();var b=Read();Directory.CreateDirectory(Root);
        // glTF PBR uses linear factors; qualify the project in linear lighting.
        PlayerSettings.colorSpace=ColorSpace.Linear;
        var renderer=AssetDatabase.LoadAssetAtPath<UniversalRendererData>(Root+"/Renderer.asset");
        if(renderer==null){renderer=ScriptableObject.CreateInstance<UniversalRendererData>();AssetDatabase.CreateAsset(renderer,Root+"/Renderer.asset");}
        var rp=AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(Root+"/Pipeline.asset");
        if(rp==null){rp=ScriptableObject.CreateInstance<UniversalRenderPipelineAsset>();var so=new SerializedObject(rp);var list=so.FindProperty("m_RendererDataList");list.arraySize=1;list.GetArrayElementAtIndex(0).objectReferenceValue=renderer;so.ApplyModifiedPropertiesWithoutUndo();AssetDatabase.CreateAsset(rp,Root+"/Pipeline.asset");}
        GraphicsSettings.defaultRenderPipeline=rp;QualitySettings.renderPipeline=rp;
        AssetDatabase.SaveAssets();
        foreach(var a in b.assets) AssetDatabase.ImportAsset("Assets/SiegeBundle/"+a.id+".glb",ImportAssetOptions.ForceUpdate);
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        foreach(var p in b.placements){
            var wrapper=new GameObject(p.id);wrapper.transform.position=Point(p.position);
            wrapper.transform.rotation=Quaternion.Euler(p.rotation[0]*Mathf.Rad2Deg,-p.rotation[1]*Mathf.Rad2Deg,-p.rotation[2]*Mathf.Rad2Deg);wrapper.transform.localScale=V(p.scale);
            var model=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>("Assets/SiegeBundle/"+p.asset+".glb"));model.transform.SetParent(wrapper.transform,false);
            if(p.collider?.boxes!=null)foreach(var box in p.collider.boxes){var c=wrapper.AddComponent<BoxCollider>();c.center=Point(box.offset);c.size=V(box.size);}
        }
        var light=new GameObject("Sun").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1;light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(40,-35,0);
        RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.25f,.27f,.3f);
        var camera=new GameObject("Review Camera").AddComponent<Camera>();camera.tag="MainCamera";camera.transform.position=new Vector3(-87,22,-67);camera.transform.LookAt(new Vector3(-60,2,-39));camera.farClipPlane=400;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.58f,.68f,.77f);camera.gameObject.AddComponent<AudioListener>();camera.gameObject.AddComponent<SiegePreview>();
        PlayerSettings.companyName="Independent Examples";PlayerSettings.productName="The Last Crossing - Blockout";PlayerSettings.runInBackground=true;
        EditorSceneManager.SaveScene(scene,Root+"/Blockout.unity");
        EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene(Root+"/Blockout.unity",true)};AssetDatabase.SaveAssets();
        Directory.CreateDirectory("Evidence");File.WriteAllText("Evidence/import.json",JsonUtility.ToJson(new Receipt{revision=b.revision,placements=b.placements.Length,assets=b.assets.Length,scene=Root+"/Blockout.unity"},true));
        Debug.Log("SIEGE_IMPORT_OK revision="+b.revision+" placements="+b.placements.Length);
    }
    [Serializable] class Receipt { public int revision,placements,assets; public string scene; }
    public static void VerifyReimport()
    {
        ImportBundle();var before=AssetDatabase.AssetPathToGUID(Root+"/Blockout.unity");ImportBundle();
        if(before!=AssetDatabase.AssetPathToGUID(Root+"/Blockout.unity"))throw new Exception("Scene GUID changed");
        if(UnityEngine.SceneManagement.SceneManager.GetActiveScene().GetRootGameObjects().Count(x=>x.name.StartsWith("siege-"))!=Read().placements.Length)throw new Exception("Placement count mismatch");
        File.WriteAllText("Evidence/reimport.txt","PASS: unchanged bundle twice; scene GUID stable; no duplicate placement roots. Gameplay override preservation and changed/deleted bundle cases not yet implemented.");
    }
    public static void BuildWindows()
    {
        Directory.CreateDirectory("Builds/Windows");
        var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{Root+"/Blockout.unity"},locationPathName="Builds/Windows/LastCrossing.exe",target=BuildTarget.StandaloneWindows64,options=BuildOptions.Development});
        if(report.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Build failed: "+report.summary.result);
        File.WriteAllText("Evidence/build.txt","Succeeded: "+report.summary.totalSize+" bytes; "+Application.unityVersion);
    }
    public static void QualifyAndBuild()
    {
        RunChecks(); SiegeMaterialAudit.Run(); BuildWindows();
    }
    public static void ValidateScene()
    {
        Physics.SyncTransforms();
        foreach(float z in new[]{-68f,-56f,-44f,-34f,-25f,-15f})
            if(!Physics.Raycast(new Vector3(-60,2,z),Vector3.down,out var h,3)||Mathf.Abs(h.point.y)>.02f)throw new Exception("Missing floor at "+z);
        if(Physics.Raycast(new Vector3(-60,1.72f,-70),Vector3.forward,58))throw new Exception("Center route blocked");
        if(!Physics.Raycast(new Vector3(-60,0.6f,-60),Vector3.right,5))throw new Exception("Bridge rail missing");
        File.WriteAllText("Evidence/collision.txt","PASS: six floor supports at y=0, clear bridge-gate-court center ray, rail blocks lateral ray. These probes do not certify controller traversal.");
    }
    public static void VerifyRejectedHash()
    {
        const string p="Assets/SiegeBundle/bundle.json";var original=File.ReadAllText(p);var b=Read();b.assets[0].sha256="sha256:invalid";bool rejected=false;
        try{File.WriteAllText(p,JsonUtility.ToJson(b));try{ValidateBundle();}catch(Exception e){rejected=e.Message.StartsWith("Hash mismatch:");}}
        finally{File.WriteAllText(p,original);}
        if(!rejected)throw new Exception("Corrupt bundle was not rejected");
        File.WriteAllText("Evidence/hash-rejection.txt","PASS: corrupt asset hash rejected before scene replacement; original manifest restored.");
    }
    public static void CaptureReview()
    {
        EditorSceneManager.OpenScene(Root+"/Blockout.unity",OpenSceneMode.Single);
        var c=Camera.main;var rt=new RenderTexture(1280,720,24);c.targetTexture=rt;c.Render();RenderTexture.active=rt;
        var texture=new Texture2D(1280,720,TextureFormat.RGB24,false);texture.ReadPixels(new Rect(0,0,1280,720),0,0);texture.Apply();Directory.CreateDirectory("Evidence");File.WriteAllBytes("Evidence/unity-editor.png",texture.EncodeToPNG());
        c.targetTexture=null;RenderTexture.active=null;UnityEngine.Object.DestroyImmediate(texture);UnityEngine.Object.DestroyImmediate(rt);
    }
}
