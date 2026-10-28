using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using UnityEditor;
using UnityEditor.Animations;
using UnityEngine;
using UnityEngine.Rendering;

// Explicit opt-in fixture audit. Leaves FBX path, world and production assets unchanged.
public static class SoldierGltfImport
{
    const string Root="Assets/SoldierGltfSmoke";
    [Serializable] class MeshRow {public string name;public int vertices,submeshes,colorVertices,bones;public long triangles;public bool readable;}
    [Serializable] class MaterialRow {public string name,shader;public string[] keywords,textures;public Color baseColor;}
    [Serializable] class ClipRow {public string name,root;public int curves,unresolved;public float seconds,bakedVertexMaxDeltaMeters,normalizedTimeBefore,normalizedTimeAfter;public bool legacy,animatorAdvanced;}
    [Serializable] class AssetRow {public string path;public int renderers,skinnedRenderers,animators;public MeshRow[] meshes;public MaterialRow[] materials;public ClipRow[] clips;}
    [Serializable] class Report {public string status="in-progress",scope="REJECTED TOOLING FIXTURES; Linux headless Editor import/deformation only; no visual or player performance acceptance",unity;public AssetRow[] assets;public string error;}
    public static void Run()
    {
        var report=new Report{unity=Application.unityVersion};Directory.CreateDirectory("Evidence");
        var rows=new List<AssetRow>();
        try {rows.Add(Audit(Root+"/Garrison-rigged.glb",true));rows.Add(Audit(Root+"/art-shell.glb",false));report.status="passed-import-and-editor-deformation";}
        catch(Exception e){report.status="failed";report.error=e.ToString();throw;}
        finally{report.assets=rows.ToArray();File.WriteAllText("Evidence/soldier-gltf-smoke.json",JsonUtility.ToJson(report,true));}
        Debug.Log("SOLDIER_GLTF_SMOKE_PASSED");
    }
    static AssetRow Audit(string path,bool animated)
    {
        AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceUpdate);
        var importer=AssetImporter.GetAtPath(path);if(importer==null)throw new Exception("Missing GLB importer: "+path);
        var so=new SerializedObject(importer);var method=so.FindProperty("importSettings.animationMethod");
        if(method!=null){method.intValue=(int)GLTFast.AnimationMethod.Mecanim;so.ApplyModifiedPropertiesWithoutUndo();importer.SaveAndReimport();}
        var prefab=AssetDatabase.LoadAssetAtPath<GameObject>(path);if(prefab==null)throw new Exception("No imported prefab: "+path);
        var obj=UnityEngine.Object.Instantiate(prefab);obj.name="REJECTED_TOOLING_FIXTURE";
        try {
            var renderers=obj.GetComponentsInChildren<Renderer>(true);var row=new AssetRow{path=path,renderers=renderers.Length,skinnedRenderers=renderers.OfType<SkinnedMeshRenderer>().Count(),animators=obj.GetComponentsInChildren<Animator>(true).Length};
            row.meshes=renderers.Select(r=>{var skin=r as SkinnedMeshRenderer;var m=skin!=null?skin.sharedMesh:r.GetComponent<MeshFilter>()?.sharedMesh;if(m==null)return null;var colors=new List<Color>();if(m.isReadable)m.GetColors(colors);return new MeshRow{name=m.name,vertices=m.vertexCount,submeshes=m.subMeshCount,colorVertices=colors.Count,bones=skin==null?0:skin.bones.Length,readable=m.isReadable,triangles=Enumerable.Range(0,m.subMeshCount).Sum(i=>(long)m.GetIndexCount(i)/3)};}).Where(r=>r!=null).ToArray();
            row.materials=renderers.SelectMany(r=>r.sharedMaterials).Where(m=>m!=null).Distinct().Select(m=>new MaterialRow{name=m.name,shader=m.shader.name,keywords=m.shaderKeywords,baseColor=m.HasProperty("_BaseColor")?m.GetColor("_BaseColor"):m.HasProperty("baseColorFactor")?m.GetColor("baseColorFactor"):Color.white,textures=m.GetTexturePropertyNames().Where(n=>m.GetTexture(n)!=null).Select(n=>n+":"+m.GetTexture(n).name+":"+m.GetTexture(n).width+"x"+m.GetTexture(n).height).ToArray()}).ToArray();
            var clips=AssetDatabase.LoadAllAssetsAtPath(path).OfType<AnimationClip>().Where(c=>!c.name.StartsWith("__preview__")).ToArray();var results=new List<ClipRow>();
            if(animated && clips.Length==0)throw new Exception("No animation clips imported");
            foreach(var clip in clips){
                var bindings=AnimationUtility.GetCurveBindings(clip);var roots=obj.GetComponentsInChildren<Transform>(true);
                var target=roots.OrderByDescending(t=>bindings.Count(b=>string.IsNullOrEmpty(b.path)||t.Find(b.path)!=null)).ThenBy(t=>AnimationUtility.CalculateTransformPath(t,obj.transform).Length).First();
                int unresolved=bindings.Count(b=>!string.IsNullOrEmpty(b.path)&&target.Find(b.path)==null);if(unresolved>0)throw new Exception(clip.name+": unresolved clip bindings="+unresolved);if(clip.legacy)throw new Exception("Unexpected Legacy clip: "+clip.name);
                var skin=target.GetComponentsInChildren<SkinnedMeshRenderer>(true).FirstOrDefault(s=>s.bones.Length>0);if(skin==null)throw new Exception("No weighted mesh under resolved animation root");
                string cp=Root+"/Smoke-"+clip.GetEntityId()+".controller";var controller=AnimatorController.CreateAnimatorControllerAtPath(cp);var state=controller.layers[0].stateMachine.AddState("Fixture");state.motion=clip;controller.layers[0].stateMachine.defaultState=state;
                var a=target.GetComponent<Animator>()??target.gameObject.AddComponent<Animator>();a.runtimeAnimatorController=controller;a.applyRootMotion=false;a.cullingMode=AnimatorCullingMode.AlwaysAnimate;a.Rebind();a.Play("Fixture",0,0);a.Update(0);
                var first=new Mesh();var second=new Mesh();skin.BakeMesh(first);float before=a.GetCurrentAnimatorStateInfo(0).normalizedTime;a.Update(Mathf.Max(.01f,clip.length*.25f));skin.BakeMesh(second);float after=a.GetCurrentAnimatorStateInfo(0).normalizedTime;
                var va=first.vertices;var vb=second.vertices;float delta=0;for(int i=0;i<Math.Min(va.Length,vb.Length);i++)delta=Mathf.Max(delta,Vector3.Distance(va[i],vb[i]));
                results.Add(new ClipRow{name=clip.name,root=AnimationUtility.CalculateTransformPath(target,obj.transform),curves=bindings.Length,unresolved=unresolved,seconds=clip.length,legacy=clip.legacy,bakedVertexMaxDeltaMeters=delta,normalizedTimeBefore=before,normalizedTimeAfter=after,animatorAdvanced=after>before});
                UnityEngine.Object.DestroyImmediate(first);UnityEngine.Object.DestroyImmediate(second);a.runtimeAnimatorController=null;AssetDatabase.DeleteAsset(cp);
            }
            row.clips=results.ToArray();
            // Idle can intentionally be still. At least one clip must move the actual weighted surface.
            if(animated && !row.clips.Any(c=>c.animatorAdvanced&&c.bakedVertexMaxDeltaMeters>.0001f))throw new Exception("Animator/weighted-vertex deformation proof failed");
            if(!animated && (!row.meshes.Any(m=>m.colorVertices>0)||!row.materials.Any(m=>m.textures.Length>0)))throw new Exception("Static material fixture lost COLOR_0 or texture references");
            return row;
        } finally {UnityEngine.Object.DestroyImmediate(obj);}
    }
}
