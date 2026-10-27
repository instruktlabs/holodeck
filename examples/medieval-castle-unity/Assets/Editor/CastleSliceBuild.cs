using System;
using LastCrossing.Playable;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

public static class CastleSliceBuild
{
    const string BundleRoot="Assets/CastleSliceBundle", Generated="Assets/CastleSliceGenerated";
    const string ScenePath=Generated+"/PlayableCastle.unity";
    [Serializable] public class Bundle { public int baseRevision; public string name; public Asset[] assets; public Placement[] placements; public Marker[] markers; public TerrainMesh terrain; public ReviewCamera[] reviewCameras; }
    [Serializable] public class Asset { public string id,file,sha256; }
    [Serializable] public class Placement { public string id,asset; public float[] position,rotation,scale; public Shape shape; public ColliderSpec collider; }
    [Serializable] public class Shape { public string type,color,surface; public float[] size,offset; }
    [Serializable] public class ColliderSpec { public string type; public float[] size,offset; public Box[] boxes; }
    [Serializable] public class Box { public float[] size,offset; public bool walkable; }
    [Serializable] public class Marker { public string name; public float[] position; public float yaw; }
    [Serializable] public class TerrainMesh { public float[] positions,normals; public int[] indices; public string appearanceContract,legacyBaseColor; public CastleTerrainAppearance.Appearance appearance; }
    [Serializable] public class ReviewCamera { public string name; public float[] position,target; }
    [Serializable] class Receipt { public string scene,bundleSha256,soldierPrefab,controller,soldierPrefabSha256,soldierLod0Sha256,soldierLod1Sha256,soldierLod2Sha256,scope; public int baseRevision,placements,assets,colliders,markers; public bool gateCapsuleClear,defenseLineClear; }
    static Vector3 V(float[] p)=>new Vector3(p[0],p[1],p[2]);
    static Vector3 Point(float[] p)=>new Vector3(-p[0],p[1],p[2]);
    static string Arg(string name,string fallback){var a=Environment.GetCommandLineArgs();int i=Array.IndexOf(a,name);return i>=0&&i+1<a.Length?a[i+1]:fallback;}
    static string Hash(string path){using var h=SHA256.Create();return BitConverter.ToString(h.ComputeHash(File.ReadAllBytes(path))).Replace("-","").ToLowerInvariant();}
    static Material Material(string id,Color color){string p=Generated+"/"+id+".mat";var m=AssetDatabase.LoadAssetAtPath<Material>(p);if(m==null){m=new Material(Shader.Find("Universal Render Pipeline/Lit"));AssetDatabase.CreateAsset(m,p);}m.SetColor("_BaseColor",color);m.SetFloat("_Smoothness",.12f);return m;}
    static void AddBox(GameObject obj,float[] size,float[] offset){var c=obj.AddComponent<BoxCollider>();c.size=V(size);c.center=offset==null?Vector3.zero:Point(offset);}
    public static void CreateScene()
    {
        if(GraphicsSettings.currentRenderPipeline==null||PlayerSettings.colorSpace!=ColorSpace.Linear)throw new Exception("Existing Linear URP project required");
        Directory.CreateDirectory(Generated);Directory.CreateDirectory("Evidence");
        string bundleFile=BundleRoot+"/slice.json";var b=JsonUtility.FromJson<Bundle>(File.ReadAllText(bundleFile));
        if(b.placements.Select(p=>p.id).Distinct().Count()!=b.placements.Length)throw new Exception("Duplicate slice placement IDs");
        foreach(var a in b.assets){string p=BundleRoot+"/"+a.file;if(Hash(p)!=a.sha256)throw new Exception("Slice source hash mismatch: "+a.id);AssetDatabase.ImportAsset(p,ImportAssetOptions.ForceUpdate);if(AssetDatabase.LoadAssetAtPath<GameObject>(p)==null)throw new Exception("Missing imported model "+p);}
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var architecture=new GameObject("SiegeSlice_Architecture");
        foreach(var p in b.placements)
        {
            var go=new GameObject(p.id);go.transform.SetParent(architecture.transform);go.transform.position=Point(p.position);go.transform.rotation=Quaternion.Euler(p.rotation[0]*Mathf.Rad2Deg,-p.rotation[1]*Mathf.Rad2Deg,-p.rotation[2]*Mathf.Rad2Deg);go.transform.localScale=V(p.scale);
            if(!string.IsNullOrEmpty(p.asset)){var a=b.assets.Single(x=>x.id==p.asset);var model=(GameObject)PrefabUtility.InstantiatePrefab(AssetDatabase.LoadAssetAtPath<GameObject>(BundleRoot+"/"+a.file));model.transform.SetParent(go.transform,false);foreach(var c in model.GetComponentsInChildren<Collider>())UnityEngine.Object.DestroyImmediate(c);}
            else if(p.shape!=null){if(p.shape.type!="box")throw new Exception("Unmapped procedural shape: "+p.shape.type);var model=GameObject.CreatePrimitive(PrimitiveType.Cube);model.name="Visible masonry";model.transform.SetParent(go.transform,false);model.transform.localScale=V(p.shape.size);model.transform.localPosition=p.shape.offset==null?Vector3.zero:Point(p.shape.offset);UnityEngine.Object.DestroyImmediate(model.GetComponent<Collider>());ColorUtility.TryParseHtmlString(p.shape.color,out var color);model.GetComponent<Renderer>().sharedMaterial=Material("Stone-"+p.shape.color.TrimStart('#'),color);}
            if(p.collider==null||string.IsNullOrEmpty(p.collider.type))throw new Exception("Missing collider declaration "+p.id);
            if(p.collider.type!="none"){if(p.collider.type=="box")AddBox(go,p.collider.size,p.collider.offset);else if(p.collider.type=="compound")foreach(var box in p.collider.boxes)AddBox(go,box.size,box.offset);else throw new Exception("Unsupported collider "+p.id);}
        }
        var terrain=new Mesh{name="Shared Holodeck terrain",indexFormat=IndexFormat.UInt32};var positions=new Vector3[b.terrain.positions.Length/3];for(int i=0;i<positions.Length;i++)positions[i]=new Vector3(-b.terrain.positions[i*3],b.terrain.positions[i*3+1],b.terrain.positions[i*3+2]);var indices=(int[])b.terrain.indices.Clone();for(int i=0;i<indices.Length;i+=3){int t=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=t;}terrain.vertices=positions;terrain.triangles=indices;terrain.RecalculateNormals();terrain.RecalculateBounds();
        var terrainMaterial=CastleTerrainAppearance.Apply(b.terrain,terrain,Generated);
        string terrainPath=Generated+"/Terrain.asset";var oldMesh=AssetDatabase.LoadAssetAtPath<Mesh>(terrainPath);if(oldMesh!=null){EditorUtility.CopySerialized(terrain,oldMesh);UnityEngine.Object.DestroyImmediate(terrain);terrain=oldMesh;}else AssetDatabase.CreateAsset(terrain,terrainPath);
        var land=new GameObject("SiegeSlice_GorgeTerrain");land.AddComponent<MeshFilter>().sharedMesh=terrain;land.AddComponent<MeshRenderer>().sharedMaterial=terrainMaterial;land.AddComponent<MeshCollider>().sharedMesh=terrain;
        foreach(var marker in b.markers){var g=new GameObject(marker.name);g.transform.position=V(marker.position);g.transform.rotation=Quaternion.Euler(0,marker.yaw,0);}
        foreach(var review in b.reviewCameras){var g=new GameObject("SiegeSlice_Review"+review.name);g.transform.position=V(review.position);g.transform.LookAt(V(review.target));}
        var sun=new GameObject("SiegeSlice_Sun").AddComponent<Light>();sun.type=LightType.Directional;sun.color=new Color(1,.93f,.81f);sun.intensity=1.1f;sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(48,-35,0);
        RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.37f,.40f,.43f);RenderSettings.fog=true;RenderSettings.fogColor=new Color(.67f,.72f,.73f);RenderSettings.fogMode=FogMode.Linear;RenderSettings.fogStartDistance=100;RenderSettings.fogEndDistance=250;
        string soldier=Arg("--slice-soldier-prefab","Assets/SoldierProductionGenerated/Garrison-a1a7f8c75fbc.prefab"),controller=Arg("--slice-soldier-controller","Assets/SoldierProductionGenerated/Garrison-a1a7f8c75fbc.controller");
        var game=new GameObject("SiegeSlice_Game").AddComponent<CastleSiegeGame>();game.soldierPrefab=AssetDatabase.LoadAssetAtPath<GameObject>(soldier);game.soldierController=AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(controller);if(game.soldierPrefab==null||game.soldierController==null)throw new Exception("Playable soldier prefab/controller missing");
        EditorSceneManager.SaveScene(scene,ScenePath);AssetDatabase.SaveAssets();Physics.SyncTransforms();
        bool gateClear=!Physics.CheckCapsule(new Vector3(-60,.3f,-34),new Vector3(-60,1.5f,-34),.28f,~0,QueryTriggerInteraction.Ignore);
        Vector3 muzzle=GameObject.Find("SiegeSlice_Defense").transform.position,target=new Vector3(-60,1,-50);bool lineClear=!Physics.Raycast(muzzle,(target-muzzle).normalized,(target-muzzle).magnitude,~0,QueryTriggerInteraction.Ignore);
        var receipt=new Receipt{scene=ScenePath,bundleSha256=Hash(bundleFile),soldierPrefab=soldier,controller=controller,soldierPrefabSha256=Hash(soldier),soldierLod0Sha256=Hash("Assets/SoldierCandidates/Garrison-LOD0.glb"),soldierLod1Sha256=Hash("Assets/SoldierCandidates/Garrison-LOD1.glb"),soldierLod2Sha256=Hash("Assets/SoldierCandidates/Garrison-LOD2.glb"),baseRevision=b.baseRevision,placements=b.placements.Length,assets=b.assets.Length,colliders=UnityEngine.Object.FindObjectsByType<Collider>(FindObjectsSortMode.None).Length,markers=b.markers.Length,gateCapsuleClear=gateClear,defenseLineClear=lineClear,scope="Scene authored and static capsule/line checks. Gameplay smoke must prove CharacterController ascent, defense, wave outcome and restart."};File.WriteAllText("Evidence/castle-slice-scene.json",JsonUtility.ToJson(receipt,true));
        if(!gateClear)throw new Exception("Gate capsule clearance failed");if(!lineClear)throw new Exception("Defense muzzle line blocked");
        Debug.Log("CASTLE_SLICE_SCENE_READY");
    }
    public static void ValidateOnly(){CreateScene();}
    public static void QualifyAndBuildWindows()
    {
        CastleSliceRigCheck.Run();
        PlayerSettings.productName="The Last Crossing";PlayerSettings.defaultScreenWidth=1280;PlayerSettings.defaultScreenHeight=720;PlayerSettings.fullScreenMode=FullScreenMode.Windowed;
        CreateScene();Directory.CreateDirectory("Builds/CastleSlice");var pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;int oldCascades=pipeline.shadowCascadeCount;float oldDistance=pipeline.shadowDistance;
        try{pipeline.shadowCascadeCount=4;pipeline.shadowDistance=50;EditorUtility.SetDirty(pipeline);AssetDatabase.SaveAssets();var r=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{ScenePath},locationPathName="Builds/CastleSlice/LastCrossing.exe",target=BuildTarget.StandaloneWindows64,options=BuildOptions.None});if(r.summary.result!=UnityEditor.Build.Reporting.BuildResult.Succeeded)throw new Exception("Castle slice build failed");File.WriteAllText("Evidence/castle-slice-build.json","{\"status\":\"built\",\"scope\":\"Runtime play smoke pending\",\"cascades\":4,\"shadowDistance\":50,\"bytes\":"+r.summary.totalSize+"}");}
        finally{pipeline.shadowCascadeCount=oldCascades;pipeline.shadowDistance=oldDistance;EditorUtility.SetDirty(pipeline);AssetDatabase.SaveAssets();File.Copy(AssetDatabase.GetAssetPath(pipeline),"Evidence/castle-slice-pipeline-final.asset",true);}
    }
}




