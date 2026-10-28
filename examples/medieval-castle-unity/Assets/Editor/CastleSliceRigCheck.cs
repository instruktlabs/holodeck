using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;

// Requalifies the existing derivative without regenerating its prefab/controller.
public static class CastleSliceRigCheck
{
    [Serializable] class ClipResult { public string name; public float before, after, maxVertexDeltaMeters; }
    [Serializable] class MeshResult { public string name; public int vertices, bones, materials; public bool vertexColors; }
    [Serializable] class Result { public string unity, prefab; public int uniqueBones, animators, lods; public ClipResult[] clips; public MeshResult[] meshes; public string limitation; }

    public static void Run()
    {
        const string path = "Assets/SoldierProductionGenerated/Garrison-a1a7f8c75fbc.prefab";
        var source = AssetDatabase.LoadAssetAtPath<GameObject>(path);
        if (source == null) throw new Exception("Soldier migration check: prefab missing");
        var instance = UnityEngine.Object.Instantiate(source);
        try
        {
            var animators = instance.GetComponentsInChildren<Animator>(true);
            var skins = instance.GetComponentsInChildren<SkinnedMeshRenderer>(true);
            var lod = instance.GetComponentInChildren<LODGroup>(true);
            int bones = skins.SelectMany(s => s.bones).Distinct().Count();
            if (animators.Length != 1 || bones != 22 || lod == null || lod.lodCount != 3)
                throw new Exception($"Soldier migration contract: {animators.Length} animators, {bones} bones, {lod?.lodCount} LODs");
            if (skins.Any(s => s.sharedMesh == null || s.sharedMaterials.Length != 2 || s.bones.Any(b => b == null)))
                throw new Exception("Soldier migration check: broken mesh, palette or bone binding");
            var animator = animators[0];
            animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
            var clips = new[] { "Walk", "Idle", "LookAround" }.Select(name =>
            {
                var clip = animator.runtimeAnimatorController.animationClips.Single(c => c.name == name || c.name.EndsWith("|" + name));
                animator.Rebind(); animator.Play(name, 0, 0); animator.Update(0);
                float before = animator.GetCurrentAnimatorStateInfo(0).normalizedTime;
                Vector3[][] initial = skins.Select(Sample).ToArray();
                animator.Update(clip.length * .25f);
                float after = animator.GetCurrentAnimatorStateInfo(0).normalizedTime, delta = 0;
                for (int i = 0; i < skins.Length; i++)
                {
                    var moved = Sample(skins[i]);
                    if (initial[i].Length != moved.Length) throw new Exception("Skinned vertex count changed");
                    for (int j = 0; j < moved.Length; j++) delta = Mathf.Max(delta, Vector3.Distance(initial[i][j], moved[j]));
                }
                if (after <= before || delta < .00001f) throw new Exception("No actual skinned motion: " + name);
                return new ClipResult { name = name, before = before, after = after, maxVertexDeltaMeters = delta };
            }).ToArray();
            var result = new Result {
                unity = Application.unityVersion, prefab = path, uniqueBones = bones,
                animators = animators.Length, lods = lod.lodCount, clips = clips,
                meshes = skins.Select(s => new MeshResult { name = s.name, vertices = s.sharedMesh.vertexCount,
                    bones = s.bones.Length, materials = s.sharedMaterials.Length,
                    vertexColors = s.sharedMesh.HasVertexAttribute(VertexAttribute.Color) }).ToArray(),
                limitation = "Editor import and weighted motion only; player rendering, visual pose quality and crowd cost require separate evidence."
            };
            Directory.CreateDirectory("Evidence");
            File.WriteAllText("Evidence/castle-slice-rig.json", JsonUtility.ToJson(result, true));
            Debug.Log("CASTLE_SLICE_RIG_VERIFIED " + Application.unityVersion);
        }
        finally { UnityEngine.Object.DestroyImmediate(instance); }
    }

    static Vector3[] Sample(SkinnedMeshRenderer skin)
    {
        var mesh = new Mesh();
        try { skin.BakeMesh(mesh); return mesh.vertices; }
        finally { UnityEngine.Object.DestroyImmediate(mesh); }
    }
}
