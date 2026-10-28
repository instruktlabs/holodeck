using System;
using System.IO;
using System.Linq;
using System.Collections.Generic;
using System.Security.Cryptography;
using UnityEditor;
using UnityEngine;

public static class SoldierLodImport
{
    [Serializable] public class Level {public int level;public string source,sha256;public int renderers,vertices,materials;public long triangles;public float transition;}
    public static Level[] Attach(GameObject canonical)
    {
        string paths=SoldierProductionImport.Argument("--lod-glbs","");if(paths=="")return new Level[0];
        string[] files=paths.Split(','),hashes=SoldierProductionImport.Argument("--lod-shas","").Split(',');if(files.Length!=2||hashes.Length!=2)throw new Exception("Two explicit LOD paths and hashes required");
        var original=canonical.GetComponentsInChildren<SkinnedMeshRenderer>(true);var levels=new List<LOD>{new LOD(.35f,original)};var receipts=new List<Level>();
        for(int i=0;i<2;i++){
            string path=files[i];if(!path.StartsWith("Assets/")||!File.Exists(path))throw new Exception("LOD must be under Assets");string hash;using(var h=SHA256.Create())hash=BitConverter.ToString(h.ComputeHash(File.ReadAllBytes(path))).Replace("-","").ToLowerInvariant();if(hash!=hashes[i].ToLowerInvariant())throw new Exception("LOD hash mismatch");
            AssetDatabase.ImportAsset(path,ImportAssetOptions.ForceUpdate);var model=AssetDatabase.LoadAssetAtPath<GameObject>(path);var temp=UnityEngine.Object.Instantiate(model);
            try{
                var added=new List<Renderer>();foreach(var skin in temp.GetComponentsInChildren<SkinnedMeshRenderer>(true)){
                    var remapped=skin.bones.Select(b=>{string bp=AnimationUtility.CalculateTransformPath(b,temp.transform);var target=canonical.transform.Find(bp);if(target==null)throw new Exception("Missing canonical bone "+bp);return target;}).ToArray();
                    var reference=original.FirstOrDefault(s=>s.bones.Length==remapped.Length);if(reference==null)throw new Exception("No matching canonical skeleton");
                    var bind=skin.sharedMesh.bindposes;var referenceBind=reference.sharedMesh.bindposes;if(bind.Length!=referenceBind.Length)throw new Exception("Bind pose count mismatch");for(int n=0;n<bind.Length;n++){if(remapped[n]!=reference.bones[n])throw new Exception("Joint ordering differs");for(int q=0;q<16;q++)if(Mathf.Abs(bind[n][q]-referenceBind[n][q])>1e-5f)throw new Exception("Bind pose differs");}
                    var go=new GameObject("LOD"+(i+1)+"_"+skin.name);go.transform.SetParent(canonical.transform,false);go.transform.position=skin.transform.position;go.transform.rotation=skin.transform.rotation;go.transform.localScale=skin.transform.lossyScale;
                    var targetSkin=go.AddComponent<SkinnedMeshRenderer>();targetSkin.sharedMesh=skin.sharedMesh;targetSkin.sharedMaterials=skin.sharedMaterials;targetSkin.bones=remapped;targetSkin.rootBone=skin.rootBone==null?null:canonical.transform.Find(AnimationUtility.CalculateTransformPath(skin.rootBone,temp.transform));targetSkin.localBounds=skin.localBounds;targetSkin.updateWhenOffscreen=true;added.Add(targetSkin);
                }
                if(added.Count==0)throw new Exception("LOD has no skinned renderers");float transition=i==0?.12f:.005f;levels.Add(new LOD(transition,added.ToArray()));receipts.Add(new Level{level=i+1,source=path,sha256=hash,renderers=added.Count,vertices=added.Cast<SkinnedMeshRenderer>().Sum(s=>s.sharedMesh.vertexCount),materials=added.Sum(r=>r.sharedMaterials.Length),triangles=added.Cast<SkinnedMeshRenderer>().Sum(s=>Enumerable.Range(0,s.sharedMesh.subMeshCount).Sum(n=>(long)s.sharedMesh.GetIndexCount(n)/3)),transition=transition});
            }finally{UnityEngine.Object.DestroyImmediate(temp);}
        }
        var group=canonical.AddComponent<LODGroup>();group.fadeMode=LODFadeMode.None;group.animateCrossFading=false;group.SetLODs(levels.ToArray());group.RecalculateBounds();group.ForceLOD(0);
        if(canonical.GetComponentsInChildren<Animator>(true).Length!=1)throw new Exception("LOD prefab must retain exactly one Animator");return receipts.ToArray();
    }
}
