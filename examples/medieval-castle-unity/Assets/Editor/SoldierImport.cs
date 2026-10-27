using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

public static class SoldierImport
{
    [Serializable] class Palette { public Entry[] materials; }
    [Serializable] class Entry { public string name; public float[] baseColor; public float metallic,roughness; }
    public static void ImportAndBuild()
    {
        const string modelPath="Assets/Soldier/Garrison.fbx";
        AssetDatabase.Refresh();
        var importer=AssetImporter.GetAtPath(modelPath) as ModelImporter;
        if(importer==null)throw new Exception("No FBX importer");
        importer.animationType=ModelImporterAnimationType.Generic;
        importer.avatarSetup=ModelImporterAvatarSetup.CreateFromThisModel;
        importer.importAnimation=true;importer.optimizeGameObjects=false;importer.isReadable=true;
        importer.importNormals=ModelImporterNormals.Import;importer.importBlendShapes=false;
        importer.skinWeights=ModelImporterSkinWeights.Custom;importer.maxBonesPerVertex=4;importer.minBoneWeight=.0001f;
        importer.SaveAndReimport();
        var clips=importer.defaultClipAnimations;
        if(clips.Length<3)throw new Exception("Expected Idle/Walk/Aim, got "+clips.Length);
        foreach(var c in clips){c.loopTime=true;c.loopPose=true;c.keepOriginalPositionY=true;c.keepOriginalPositionXZ=true;c.keepOriginalOrientation=true;}
        importer.clipAnimations=clips;
        var palette=JsonUtility.FromJson<Palette>(File.ReadAllText("Assets/Soldier/material-manifest.json"));
        Directory.CreateDirectory("Assets/Soldier/Materials");AssetDatabase.Refresh();
        var shader=Shader.Find("Universal Render Pipeline/Lit");if(shader==null)throw new Exception("URP Lit missing");
        foreach(var p in palette.materials){
            var safe=string.Concat(p.name.Select(c=>char.IsLetterOrDigit(c)||c=='_'||c=='-'?c:'_'));
            var path="Assets/Soldier/Materials/"+safe+".mat";
            var m=AssetDatabase.LoadAssetAtPath<Material>(path);if(m==null){m=new Material(shader);AssetDatabase.CreateAsset(m,path);}
            var linear=new Color(p.baseColor[0],p.baseColor[1],p.baseColor[2],p.baseColor[3]);
            m.SetColor("_BaseColor",linear.gamma);m.SetFloat("_Metallic",p.metallic);m.SetFloat("_Smoothness",1-p.roughness);
            importer.AddRemap(new AssetImporter.SourceAssetIdentifier(typeof(Material),p.name),m);
        }
        importer.SaveAndReimport();AssetDatabase.SaveAssets();
        var model=AssetDatabase.LoadAssetAtPath<GameObject>(modelPath);
        var renderers=model.GetComponentsInChildren<SkinnedMeshRenderer>(true);
        if(renderers.Length!=1)throw new Exception("Expected consolidated skinned renderer, got "+renderers.Length);
        if(renderers.Any(r=>r.sharedMaterials.Any(m=>m==null||m.shader!=shader)))throw new Exception("Unqualified FBX material remained");
        var mesh=renderers[0].sharedMesh;
        if(mesh.boneWeights.Any(w=>Mathf.Abs(w.weight0+w.weight1+w.weight2+w.weight3-1)>.001f))throw new Exception("Unnormalized imported weights");
        Directory.CreateDirectory("Evidence");
        File.WriteAllText("Evidence/soldier-import.txt","Generic; one skinned renderer; "+renderers[0].bones.Length+" bones; "+mesh.vertexCount+" vertices; "+renderers[0].sharedMaterials.Length+" material slots; normalized weights. Clips: "+string.Join(",",clips.Select(c=>c.name))+". FBX materials explicitly remapped from Blender linear palette to URP Lit. Not Humanoid qualified.");
        QualitySettings.skinWeights=SkinWeights.FourBones;
        SoldierCrowdBuild.Build();
    }
}
