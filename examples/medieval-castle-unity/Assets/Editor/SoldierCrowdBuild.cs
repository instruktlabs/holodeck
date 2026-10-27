using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Animations;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;

public static class SoldierCrowdBuild
{
    const string ModelPath="Assets/Soldier/Garrison.fbx";
    const string Output="Assets/SoldierCrowdGenerated";
    [MenuItem("Siege/Build Soldier Crowd Benchmark")]
    public static void Build()
    {
        if(PlayerSettings.colorSpace!=ColorSpace.Linear)throw new Exception("Crowd benchmark requires existing project Linear color space.");
        if(GraphicsSettings.currentRenderPipeline==null)throw new Exception("Existing URP pipeline is not configured.");
        AssetDatabase.ImportAsset(ModelPath,ImportAssetOptions.ForceUpdate);
        var model=AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath);
        if(model==null)throw new Exception("Missing "+ModelPath);
        var importer=AssetImporter.GetAtPath(ModelPath) as ModelImporter;
        if(importer==null||importer.animationType!=ModelImporterAnimationType.Generic)throw new Exception("Garrison must be imported as Generic rig before building.");
        var clips=AssetDatabase.LoadAllAssetsAtPath(ModelPath).OfType<AnimationClip>().Where(c=>!c.name.StartsWith("__preview__")&&c.length>0).OrderBy(c=>c.name.IndexOf("Walk",StringComparison.OrdinalIgnoreCase)>=0?0:1).ThenBy(c=>c.name).ToArray();
        if(clips.Length==0)throw new Exception("No imported animation clips with duration.");
        if(clips.Any(c=>!c.isLooping))throw new Exception("Benchmark clips must be imported with Loop Time enabled: "+string.Join(",",clips.Where(c=>!c.isLooping).Select(c=>c.name)));
        if(!model.GetComponentsInChildren<SkinnedMeshRenderer>(true).Any(s=>s.sharedMesh!=null&&s.bones.Length>0))throw new Exception("FBX has no skinned mesh/bones.");
        Directory.CreateDirectory(Output);AssetDatabase.Refresh();
        string controllerPath=Output+"/Crowd.controller";
        // Only these generated benchmark assets are replaced on rebuild.
        if(AssetDatabase.LoadAssetAtPath<AnimatorController>(controllerPath)!=null)AssetDatabase.DeleteAsset(controllerPath);
        var controller=AnimatorController.CreateAnimatorControllerAtPath(controllerPath);
        var machine=controller.layers[0].stateMachine;
        foreach(var clip in clips){var state=machine.AddState(clip.name);state.motion=clip;if(machine.defaultState==null)machine.defaultState=state;}
        machine.defaultState=machine.states[0].state;
        string sha;using(var hash=System.Security.Cryptography.SHA256.Create())sha=BitConverter.ToString(hash.ComputeHash(File.ReadAllBytes(ModelPath))).Replace("-","").ToLowerInvariant();
        BuildConfigured(model,controller,clips.Select(c=>c.name).ToArray(),ModelPath,sha,"");
    }
    public static void BuildConfigured(GameObject model,RuntimeAnimatorController controller,string[] states,string modelPath,string sourceSha,string animatorRootPath)
    {
        if(PlayerSettings.colorSpace!=ColorSpace.Linear || GraphicsSettings.currentRenderPipeline==null)throw new Exception("Existing Linear URP configuration required");
        Directory.CreateDirectory(Output);
        string buildIdentity=Guid.NewGuid().ToString("N");
        bool linux=SoldierProductionImport.Argument("--player-target","windows")=="linux";string buildFolder=linux?"Builds/SoldierCrowdLinux":"Builds/SoldierCrowd";string executable=linux?"SoldierCrowd.x86_64":"SoldierCrowd.exe";
        var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var cameraObject=new GameObject("Crowd camera");var camera=cameraObject.AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.17f,.21f,.27f);camera.nearClipPlane=.1f;camera.farClipPlane=300;camera.allowHDR=true;
        var sun=new GameObject("Sun").AddComponent<Light>();sun.type=LightType.Directional;sun.intensity=1;sun.shadows=LightShadows.Soft;sun.transform.rotation=Quaternion.Euler(45,120,0);
        RenderSettings.ambientMode=AmbientMode.Flat;RenderSettings.ambientLight=new Color(.25f,.25f,.25f);
        var ground=GameObject.CreatePrimitive(PrimitiveType.Cube);ground.name="Benchmark ground";ground.transform.position=new Vector3(0,-.15f,0);ground.transform.localScale=new Vector3(100,.3f,100);
        var shader=Shader.Find("Universal Render Pipeline/Lit");if(shader==null)throw new Exception("URP Lit shader unavailable");
        string materialPath=Output+"/Ground.mat";var material=AssetDatabase.LoadAssetAtPath<Material>(materialPath);if(material==null){material=new Material(shader);AssetDatabase.CreateAsset(material,materialPath);}material.SetColor("_BaseColor",new Color(.24f,.27f,.22f));material.SetFloat("_Smoothness",.1f);ground.GetComponent<Renderer>().sharedMaterial=material;
        var benchmark=new GameObject("Soldier Crowd Benchmark").AddComponent<SoldierCrowdBenchmark>();benchmark.lodSourceHashes=SoldierProductionImport.Argument("--lod-shas","").Split(new[]{','},StringSplitOptions.RemoveEmptyEntries);benchmark.comparisonLitShader=shader;benchmark.defaultRenderMode="normal";benchmark.defaultForcedLod=-1;benchmark.defaultSkinUpdateWhenOffscreen=false;benchmark.fixtureShadowCascades=int.Parse(SoldierProductionImport.Argument("--build-cascades","4"));benchmark.fixtureShadowDistance=50;benchmark.soldierPrefab=model;benchmark.controller=controller;benchmark.stateNames=states;benchmark.view=camera;benchmark.animatorRootPath=animatorRootPath;benchmark.sourcePath=modelPath;benchmark.sourceSha256=sourceSha;benchmark.buildIdentity=buildIdentity;benchmark.shadowVariantsIncluded=false;
        string scenePath=Output+"/Crowd.unity";EditorSceneManager.SaveScene(scene,scenePath);AssetDatabase.SaveAssets();
        Directory.CreateDirectory(buildFolder);
        File.WriteAllText(buildFolder+"/build-input.json",JsonUtility.ToJson(new BuildInput{model=modelPath,sourceSha256=sourceSha,animatorRootPath=animatorRootPath,buildIdentity=buildIdentity,clips=states,clipLengths=states.Select(n=>((AnimationClip)((AnimatorController)controller).layers[0].stateMachine.states.First(s=>s.state.name==n).state.motion).length).ToArray(),unity=Application.unityVersion,colorSpace=PlayerSettings.colorSpace.ToString()},true));
        bool oldTiming=PlayerSettings.enableFrameTimingStats;
        var pipeline=GraphicsSettings.currentRenderPipeline as UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset;int oldCascades=pipeline.shadowCascadeCount;int buildCascades=int.Parse(SoldierProductionImport.Argument("--build-cascades","4"));if(buildCascades!=0&&buildCascades!=1&&buildCascades!=2&&buildCascades!=4)throw new Exception("Build cascades must be0,1,2,4");
        string pipelinePath=AssetDatabase.GetAssetPath(pipeline);File.Copy(pipelinePath,buildFolder+"/pipeline-before-build.txt",true);
        try{
            PlayerSettings.enableFrameTimingStats=true;
            if(buildCascades!=0){pipeline.shadowCascadeCount=buildCascades;EditorUtility.SetDirty(pipeline);AssetDatabase.SaveAssets();}
            File.WriteAllText(buildFolder+"/shadow-build-policy.json",JsonUtility.ToJson(new ShadowBuildPolicy{pipeline=pipelinePath,originalCascades=oldCascades,buildCascades=pipeline.shadowCascadeCount,distance=pipeline.shadowDistance,normalShaderStripping=true},true));
            var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{scenePath},locationPathName=buildFolder+"/"+executable,target=linux?BuildTarget.StandaloneLinux64:BuildTarget.StandaloneWindows64,options=BuildOptions.None});
            if(report.summary.result!=BuildResult.Succeeded)throw new Exception("Crowd build failed: "+report.summary.result);
        } finally {PlayerSettings.enableFrameTimingStats=oldTiming;pipeline.shadowCascadeCount=oldCascades;EditorUtility.SetDirty(pipeline);AssetDatabase.SaveAssets();}
        Debug.Log("SOLDIER_CROWD_BUILD_READY: Builds/SoldierCrowd/SoldierCrowd.exe --counts 1 --seconds 8 --output <evidence-directory>");
    }
    [Serializable] class ShadowBuildPolicy {public string pipeline;public int originalCascades,buildCascades;public float distance;public bool normalShaderStripping;}
    [Serializable] class BuildInput {public string model,unity,colorSpace,sourceSha256,animatorRootPath,buildIdentity;public string[] clips;public float[] clipLengths;}
}


