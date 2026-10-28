using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;

public static class SoldierProductionImport
{
    const string Output="Assets/SoldierProductionGenerated";
    [Serializable] class ClipProof {public string state,clip,root;public int curves,unresolved;public float normalizedBefore,normalizedAfter,maxVertexDeltaMeters;}
    [Serializable] class MeshProof {public string name;public int vertices,colorVertices,bones,submeshes;public long triangles;}
    [Serializable] class MaterialProof {public string name,shader;public string[] textures;}
    [Serializable] class Receipt {public string source,sha256,prefab,controller,animatorRootPath,unity,status="prepared-direct-glb";public MeshProof[] meshes;public MaterialProof[] materials;public ClipProof[] clips;public SoldierLodImport.Level[] lods;}
    public static string Argument(string name,string fallback){var args=Environment.GetCommandLineArgs();var i=Array.IndexOf(args,name);return i>=0&&i+1<args.Length?args[i+1]:fallback;}
    public static void CompileOnly(){Debug.Log("SOLDIER_PRODUCTION_HARNESS_COMPILED");}
    public static void ImportOnly(){Prepare();}
    public static void ImportAndBuild(){var r=Prepare();SoldierCrowdBuild.BuildConfigured(AssetDatabase.LoadAssetAtPath<GameObject>(r.prefab),AssetDatabase.LoadAssetAtPath<RuntimeAnimatorController>(r.controller),r.clips.Select(c=>c.state).ToArray(),r.source,r.sha256,r.animatorRootPath);}
    static Receipt Prepare()
    {
        string path=Argument("--soldier-glb","Assets/SoldierProduction/Garrison.glb");
        if(!path.StartsWith("Assets/",StringComparison.Ordinal)||!path.EndsWith(".glb",StringComparison.OrdinalIgnoreCase)||!File.Exists(path))throw new Exception("Explicit production GLB required under Assets: "+path);
        string sha;using(var h=SHA256.Create())sha=BitConverter.ToString(h.ComputeHash(File.ReadAllBytes(path))).Replace("-","").ToLowerInvariant();
        string expected=Argument("--expected-sha","");if(string.IsNullOrWhiteSpace(expected))throw new Exception("Production import requires explicit --expected-sha");if(!string.Equals(expected,sha,StringComparison.OrdinalIgnoreCase))throw new Exception("Production GLB SHA256 mismatch");
        AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceUpdate);var importer=AssetImporter.GetAtPath(path);var serialized=new SerializedObject(importer);var mode=serialized.FindProperty("importSettings.animationMethod");if(mode==null)throw new Exception("Expected glTFast animationMethod setting");mode.intValue=(int)GLTFast.AnimationMethod.Mecanim;serialized.ApplyModifiedPropertiesWithoutUndo();importer.SaveAndReimport();
        var source=AssetDatabase.LoadAssetAtPath<GameObject>(path);if(source==null)throw new Exception("GLB prefab missing");var obj=UnityEngine.Object.Instantiate(source);obj.name="GarrisonProduction";
        try {
            string[] states=Argument("--expected-clips","Walk,Idle,LookAround").Split(',').Select(s=>s.Trim()).ToArray();var all=AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().Where(c=>!c.name.StartsWith("__preview__")).ToArray();
            var clips=states.Select(s=>{var match=all.Where(c=>c.name.Equals(s,StringComparison.OrdinalIgnoreCase)||c.name.EndsWith("|"+s,StringComparison.OrdinalIgnoreCase)).ToArray();if(match.Length!=1)throw new Exception("Need exactly one clip "+s);return match[0];}).ToArray();
            if(clips.Any(c=>c.legacy||c.length<=0))throw new Exception("Expected non-Legacy clips with duration");
            var bindings=clips.SelectMany(AnimationUtility.GetCurveBindings).ToArray();if(bindings.Length==0)throw new Exception("No animation curves");
            var target=obj.GetComponentsInChildren<Transform>(true).OrderByDescending(t=>bindings.Count(b=>string.IsNullOrEmpty(b.path)||t.Find(b.path)!=null)).ThenBy(t=>AnimationUtility.CalculateTransformPath(t,obj.transform).Length).First();
            if(bindings.Any(b=>!string.IsNullOrEmpty(b.path)&&target.Find(b.path)==null))throw new Exception("No common root resolves all expected animation bindings");
            var rootPath=AnimationUtility.CalculateTransformPath(target,obj.transform);Directory.CreateDirectory(Output);AssetDatabase.Refresh();string cp=Output+"/Garrison-"+sha.Substring(0,12)+".controller";
            var controller=AssetDatabase.LoadAssetAtPath<AnimatorController>(cp);if(controller==null)controller=AnimatorController.CreateAnimatorControllerAtPath(cp);var sm=controller.layers[0].stateMachine;foreach(var st in sm.states)sm.RemoveState(st.state);
            for(int i=0;i<clips.Length;i++){var settings=AnimationUtility.GetAnimationClipSettings(clips[i]);if(!settings.loopTime)throw new Exception("Imported clip is not looping: "+clips[i].name);var st=sm.AddState(states[i]);st.motion=clips[i];if(i==0)sm.defaultState=st;}
            foreach(var existing in obj.GetComponentsInChildren<Animator>(true))if(existing.transform!=target)UnityEngine.Object.DestroyImmediate(existing);
            var animator=target.GetComponent<Animator>()??target.gameObject.AddComponent<Animator>();animator.runtimeAnimatorController=controller;animator.applyRootMotion=false;animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;
            var lods=SoldierLodImport.Attach(obj);
            var skins=target.GetComponentsInChildren<SkinnedMeshRenderer>(true).Where(s=>s.bones.Length>0).ToArray();if(skins.Length==0)throw new Exception("No weighted skinned mesh under animation root");var proofs=new List<ClipProof>();
            for(int i=0;i<clips.Length;i++){
                animator.Rebind();animator.Play(states[i],0,0);animator.Update(0);float before=animator.GetCurrentAnimatorStateInfo(0).normalizedTime;var snapshots=new List<Vector3[]>();
                foreach(var skin in skins){var m=new Mesh();skin.BakeMesh(m);snapshots.Add(m.vertices);UnityEngine.Object.DestroyImmediate(m);}
                animator.Update(clips[i].length*.25f);float after=animator.GetCurrentAnimatorStateInfo(0).normalizedTime;float delta=0;
                for(int n=0;n<skins.Length;n++){var m=new Mesh();skins[n].BakeMesh(m);var vertices=m.vertices;if(vertices.Length!=snapshots[n].Length)throw new Exception("BakeMesh vertex count changed");for(int v=0;v<vertices.Length;v++)delta=Mathf.Max(delta,Vector3.Distance(vertices[v],snapshots[n][v]));UnityEngine.Object.DestroyImmediate(m);}
                var proof=new ClipProof{state=states[i],clip=clips[i].name,root=rootPath,curves=AnimationUtility.GetCurveBindings(clips[i]).Length,unresolved=0,normalizedBefore=before,normalizedAfter=after,maxVertexDeltaMeters=delta};proofs.Add(proof);
                if(after<=before||delta<.00001f)throw new Exception("No actual weighted animation movement in "+states[i]+"; delta="+delta);
            }
            animator.Rebind();animator.Play(states[0],0,0);animator.Update(0);
            string pp=Output+"/Garrison-"+sha.Substring(0,12)+".prefab";PrefabUtility.SaveAsPrefabAsset(obj,pp);AssetDatabase.SaveAssets();
            var renderers=obj.GetComponentsInChildren<Renderer>(true);
            var receipt=new Receipt{source=path,sha256=sha,prefab=pp,controller=cp,animatorRootPath=rootPath,unity=Application.unityVersion,lods=lods,clips=proofs.ToArray(),meshes=renderers.Select(r=>{var s=r as SkinnedMeshRenderer;var m=s!=null?s.sharedMesh:r.GetComponent<MeshFilter>()?.sharedMesh;if(m==null)return null;var colors=new List<Color>();if(m.isReadable)m.GetColors(colors);return new MeshProof{name=m.name,vertices=m.vertexCount,colorVertices=colors.Count,bones=s==null?0:s.bones.Length,submeshes=m.subMeshCount,triangles=Enumerable.Range(0,m.subMeshCount).Sum(i=>(long)m.GetIndexCount(i)/3)};}).Where(m=>m!=null).ToArray(),materials=renderers.SelectMany(r=>r.sharedMaterials).Where(m=>m!=null).Distinct().Select(m=>new MaterialProof{name=m.name,shader=m.shader.name,textures=m.GetTexturePropertyNames().Where(n=>m.GetTexture(n)!=null).Select(n=>n+":"+m.GetTexture(n).name+":"+m.GetTexture(n).width+"x"+m.GetTexture(n).height).ToArray()}).ToArray()};
            Directory.CreateDirectory("Evidence");File.WriteAllText("Evidence/soldier-production-import.json",JsonUtility.ToJson(receipt,true));Debug.Log("SOLDIER_PRODUCTION_IMPORTED "+sha);return receipt;
        } finally {UnityEngine.Object.DestroyImmediate(obj);}
    }
}


