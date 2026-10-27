using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.Profiling;
using UnityEngine.Rendering;
using Unity.Profiling;
using UnityEngine.Rendering.Universal;
using System.Security.Cryptography;

public sealed class SoldierCrowdBenchmark : MonoBehaviour
{
    public GameObject soldierPrefab;
    public RuntimeAnimatorController controller;
    public string[] stateNames;
    public Camera view;
    public string defaultRenderMode="normal";public int defaultForcedLod=-1,fixtureShadowCascades=4;public bool defaultSkinUpdateWhenOffscreen=false;public float fixtureShadowDistance=50;
    RenderPipelineAsset previousDefaultPipeline,previousQualityPipeline;UniversalRenderPipelineAsset fixturePipeline;
    public Shader comparisonLitShader;public string[] lodSourceHashes;
    string materialMode="original",animationMode="mixed";int animationSeed=19373;int forcedLod=-1;bool skinUpdateWhenOffscreen=false;
    readonly List<UnitAnimation> animationAssignments=new List<UnitAnimation>();
    public string animatorRootPath="",sourcePath,sourceSha256,buildIdentity;
    public bool shadowVariantsIncluded;string shadowOverridePolicy="No runtime shadow overrides; effective asset policy recorded";
    string renderMode="manual";
    RenderTexture renderTarget; UniversalRenderPipeline.SingleCameraRequest renderRequest; long renderedFrames;
    readonly List<GameObject> units = new List<GameObject>();
    readonly List<ProfilerRecorder> recorders = new List<ProfilerRecorder>();
    readonly string[] counterNames = { "Draw Calls Count", "SetPass Calls Count", "Triangles Count", "Vertices Count" };
    string folder, log; double deadline; bool finished;
    [Serializable] class Event { public string kind, message; public int count; public double time; }
    [Serializable] class Metric { public int samples; public double p50, p95; }
    [Serializable] class AnimationProof { public string state; public int stateHash; public float normalizedTime; public string bone; public Quaternion localRotation; }
    [Serializable] class Result {
        public string kind = "result", scope = "render plus Animator; no navigation, combat or runtime IK";
        public int count, width, height, rendererCount, skinnedRendererCount, materialSlots;
        public string camera,sourceSha256,buildIdentity;public long renderedFrameCount;
        public long forcedLodTriangles=-1,forcedLodMaterialSlots=-1;public int forcedLodRenderers=-1;public long instantiatedTriangles, allocatedMemoryBytes, reservedMemoryBytes, managedBytes;
        public double elapsedSeconds; public float maxBoneRotationDeltaDegrees, bakedVertexMaxDeltaMeters; public bool shadows, animationAdvanced;
        public AnimationProof before, after;
        public Metric frameWallMs;
    }
    static string Arg(string name, string fallback) { var a=Environment.GetCommandLineArgs(); int i=Array.IndexOf(a,name); return i>=0 && i+1<a.Length ? a[i+1] : fallback; }
    void Emit(string kind,string message,int count=0) { Debug.Log("SOLDIER_BENCHMARK_STAGE "+kind+" count="+count+" realtime="+Time.realtimeSinceStartupAsDouble.ToString("F3",System.Globalization.CultureInfo.InvariantCulture)+" "+message); File.AppendAllText(log,JsonUtility.ToJson(new Event{kind=kind,message=message,count=count,time=Time.realtimeSinceStartupAsDouble})+"\n"); }
    static Metric Summarize(List<double> values) { if(values.Count==0)return null; values.Sort(); return new Metric{samples=values.Count,p50=values[(int)((values.Count-1)*.50)],p95=values[(int)Math.Ceiling((values.Count-1)*.95)]}; }
    static string JsonMetric(List<double> values) => values.Count==0 ? "null" : JsonUtility.ToJson(Summarize(values));
    AnimationProof Proof() { var a=UnitAnimator(units[0]); var s=a.GetCurrentAnimatorStateInfo(0); var skin=units[0].GetComponentInChildren<SkinnedMeshRenderer>(); var b=skin.bones.FirstOrDefault(t=>t!=null && (t.name.ToLowerInvariant().Contains("arm")||t.name.ToLowerInvariant().Contains("thigh"))) ?? skin.bones.First(t=>t!=null); return new AnimationProof{state=a.GetCurrentAnimatorClipInfo(0).FirstOrDefault().clip?.name,stateHash=s.fullPathHash,normalizedTime=s.normalizedTime,bone=b.name,localRotation=b.localRotation}; }
    void Update() { if(!finished && deadline>0 && Time.realtimeSinceStartupAsDouble>deadline) { Emit("error","Overall wall timeout reached"); finished=true; Application.Quit(2); } }
    IEnumerator Start()
    {
        folder=Path.GetFullPath(Arg("--output",Path.Combine(Application.dataPath,"../Evidence/SoldierCrowd-"+DateTime.UtcNow.ToString("yyyyMMdd-HHmmss"))));
        Directory.CreateDirectory(folder); log=Path.Combine(folder,"progress.jsonl");
        int[] counts; double seconds;
        try { counts=Arg("--counts","1,25,100,250,500").Split(',').Select(int.Parse).ToArray(); seconds=double.Parse(Arg("--seconds","8"),System.Globalization.CultureInfo.InvariantCulture); if(counts.Any(n=>n<1||n>500)||seconds<1||seconds>30)throw new Exception("Counts1..500, seconds1..30 required"); }
        catch(Exception e){Emit("error",e.Message);Application.Quit(2);yield break;}
        if(Arg("--shadow-distance","")!=""&&counts.Any(n=>n!=1)){Emit("error","Shadow distance diagnostic is restricted to count1");Application.Quit(2);yield break;}
        if(soldierPrefab==null||controller==null||stateNames==null||stateNames.Length==0){Emit("error","Missing imported rig/controller/clips");Application.Quit(2);yield break;}
        deadline=Time.realtimeSinceStartupAsDouble+counts.Length*(seconds+20)+30+(Arg("--preview-sequence","false").Equals("true",StringComparison.OrdinalIgnoreCase)?120:0)+(Arg("--crowd-preview","false")=="true"?120:0)+(Arg("--shadow-study","false").Equals("true",StringComparison.OrdinalIgnoreCase)?60:0);
        Application.runInBackground=true; QualitySettings.vSyncCount=0; Application.targetFrameRate=-1;
        skinUpdateWhenOffscreen=bool.Parse(Arg("--skin-update-offscreen",defaultSkinUpdateWhenOffscreen.ToString()));forcedLod=int.Parse(Arg("--force-lod",defaultForcedLod.ToString()));if(forcedLod< -1||forcedLod>2)throw new ArgumentException("Force LOD must be -1,0,1,2");
        materialMode=Arg("--material-mode","original");animationMode=Arg("--animation-mode","mixed");animationSeed=int.Parse(Arg("--animation-seed","19373"));if(animationMode!="mixed"&&animationMode!="all-walk"){Emit("error","Animation mode must be mixed or all-walk");Application.Quit(2);yield break;}
        renderMode=Arg("--render-mode",defaultRenderMode).ToLowerInvariant();if(renderMode!="manual"&&renderMode!="normal"){Emit("error","Render mode must be manual or normal");Application.Quit(2);yield break;}
        Screen.SetResolution(1280,720,FullScreenMode.Windowed); view.useOcclusionCulling=false;view.enabled=renderMode=="normal";
        renderTarget=new RenderTexture(1280,720,24,RenderTextureFormat.ARGB32,RenderTextureReadWrite.sRGB){name="SoldierBenchmarkTarget",antiAliasing=1};renderTarget.Create();view.targetTexture=renderTarget;view.aspect=1280f/720f;renderRequest=new UniversalRenderPipeline.SingleCameraRequest{destination=renderTarget};RenderPipelineManager.endCameraRendering+=OnCameraRendered;
        ConfigureFixturePipeline();ApplyShadowOverrides();
        var urp=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;var directional=UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).FirstOrDefault(l=>l.type==LightType.Directional);
        File.WriteAllText(Path.Combine(folder,"identity.json"),JsonUtility.ToJson(new Identity{sourcePath=sourcePath,sourceSha256=sourceSha256,buildIdentity=buildIdentity,unityBuildGuid=Application.buildGUID,unity=Application.unityVersion,gpu=SystemInfo.graphicsDeviceName,cpu=SystemInfo.processorType,graphicsApi=SystemInfo.graphicsDeviceType.ToString(),ramMiB=SystemInfo.systemMemorySize,vramMiB=SystemInfo.graphicsMemorySize,renderWidth=renderTarget.width,renderHeight=renderTarget.height,renderScale=urp==null?0:urp.renderScale,shadowDistance=urp==null?0:urp.shadowDistance,msaa=urp==null?0:urp.msaaSampleCount,renderTargetSamples=renderTarget.antiAliasing,renderTargetSrgb=renderTarget.sRGB,sunEuler=directional==null?Vector3.zero:directional.transform.eulerAngles,sunIntensity=directional==null?0:directional.intensity,sunColor=directional==null?Color.black:directional.color,ambientColor=RenderSettings.ambientLight,ambientMode=RenderSettings.ambientMode.ToString(),shadowSettings=GetShadowSettings(),shadowOverridePolicy=shadowOverridePolicy,allVariantsRetained=shadowVariantsIncluded,skinUpdateWhenOffscreen=skinUpdateWhenOffscreen,camera=view.name,animatorRootPath=animatorRootPath,colorSpace=QualitySettings.activeColorSpace.ToString(),development=Debug.isDebugBuild,renderMode=renderMode,materialMode=materialMode,animationMode=animationMode,animationSeed=animationSeed,forcedLod=forcedLod,lodSourceHashes=lodSourceHashes,cameraEnabled=view.enabled},true));
        Emit("start","Unity="+Application.unityVersion+" GPU="+SystemInfo.graphicsDeviceName+" CPU="+SystemInfo.processorType+" RAMMB="+SystemInfo.systemMemorySize+" color="+QualitySettings.activeColorSpace+" development="+Debug.isDebugBuild+" capped=false; Animator AlwaysAnimate; skinned updateWhenOffscreen="+skinUpdateWhenOffscreen+"; shadows=on; counters unavailable => null");
        for(int i=0;i<counterNames.Length;i++){try{recorders.Add(ProfilerRecorder.StartNew(ProfilerCategory.Render,counterNames[i],1));}catch{recorders.Add(default);}}
        yield return null;
        foreach(int count in counts)
        {
            Emit("spawn","Beginning stage",count);
            foreach(var u in units)Destroy(u);units.Clear();yield return null;
            PrepareAnimations(count);
            int columns=Mathf.CeilToInt(Mathf.Sqrt(count)); int rows=Mathf.CeilToInt((float)count/columns);
            for(int i=0;i<count;i++){
                var u=Instantiate(soldierPrefab,new Vector3((i%columns-(columns-1)*.5f)*2.2f,0,(i/columns-(rows-1)*.5f)*2.2f),Quaternion.identity); units.Add(u);var lodGroup=u.GetComponent<LODGroup>();if(lodGroup!=null)lodGroup.ForceLOD(forcedLod);else if(forcedLod>0)throw new InvalidOperationException("Forced lower LOD requires imported LODGroup");
                var materialReceipt=SoldierMaterialComparison.Apply(u,materialMode,comparisonLitShader);if(i==0)File.WriteAllText(Path.Combine(folder,"material-comparison.json"),JsonUtility.ToJson(materialReceipt,true));
                var a=UnitAnimator(u); a.runtimeAnimatorController=controller;a.applyRootMotion=false;a.cullingMode=AnimatorCullingMode.AlwaysAnimate;
                var assigned=animationAssignments[i];a.speed=assigned.speed;a.Play(assigned.state,0,assigned.phase); 
                foreach(var r in u.GetComponentsInChildren<SkinnedMeshRenderer>())r.updateWhenOffscreen=skinUpdateWhenOffscreen;
            }
            var renderers=units.SelectMany(u=>u.GetComponentsInChildren<Renderer>()).ToArray();
            if(!renderers.OfType<SkinnedMeshRenderer>().Any(s=>s.bones.Length>0)){Emit("error","No skinned mesh with bones",count);Application.Quit(2);yield break;}
            Bounds bounds=renderers[0].bounds;foreach(var r in renderers)bounds.Encapsulate(r.bounds);
            view.transform.position=bounds.center+(count==1?new Vector3(-4,1.2f,-2):new Vector3(-22,30,-22));view.transform.LookAt(bounds.center);view.orthographic=true;
            float size=1;for(int k=0;k<8;k++){var c=bounds.center+Vector3.Scale(bounds.extents,new Vector3((k&1)==0?-1:1,(k&2)==0?-1:1,(k&4)==0?-1:1));var p=view.transform.InverseTransformPoint(c);size=Mathf.Max(size,Mathf.Abs(p.y),Mathf.Abs(p.x)/view.aspect);}view.orthographicSize=size*1.15f;view.farClipPlane=300;
            // Bake only one unit outside warmup and timing to verify actual vertex deformation.
            var validationAnimator=UnitAnimator(units[0]); var validationSkin=units[0].GetComponentInChildren<SkinnedMeshRenderer>();
            var bakedA=new Mesh();var bakedB=new Mesh();validationAnimator.Play(stateNames[0],0,0);validationAnimator.Update(0);validationSkin.BakeMesh(bakedA);
            validationAnimator.Play(stateNames[0],0,.25f);validationAnimator.Update(0);validationSkin.BakeMesh(bakedB);
            var verticesA=bakedA.vertices;var verticesB=bakedB.vertices;float vertexDelta=0;for(int v=0;v<Math.Min(verticesA.Length,verticesB.Length);v++)vertexDelta=Mathf.Max(vertexDelta,Vector3.Distance(verticesA[v],verticesB[v]));
            Destroy(bakedA);Destroy(bakedB);validationAnimator.Play(stateNames[0],0,0);validationAnimator.Update(0);
            if(vertexDelta<.0001f){Emit("error","First clip has no measurable skinned vertex deformation between phase0 and.25",count);Application.Quit(2);yield break;}
            if(count==1){
                var savedPosition=view.transform.position;var savedRotation=view.transform.rotation;float savedSize=view.orthographicSize;
                foreach(string state in stateNames){for(int phase=0;phase<2;phase++){validationAnimator.speed=1;validationAnimator.Play(Animator.StringToHash(validationAnimator.GetLayerName(0)+"."+state),0,phase*.25f);validationAnimator.Update(0);validationAnimator.speed=0;yield return CaptureFrame("single-"+state+"-phase"+phase,count,null,phase*.25f,-1,-1,state);if(finished)yield break;}}
                string faceState=stateNames.FirstOrDefault(n=>n.Equals("Idle",StringComparison.OrdinalIgnoreCase))??stateNames[0];validationAnimator.speed=1;validationAnimator.Play(Animator.StringToHash(validationAnimator.GetLayerName(0)+"."+faceState),0,0);validationAnimator.Update(0);validationAnimator.speed=0;
                view.transform.position=bounds.center+new Vector3(-4,.1f,0);view.transform.LookAt(bounds.center);yield return CaptureFrame("single-front-Idle",count,null,0,-1,-1,faceState);if(finished)yield break;
                view.transform.position=bounds.center+new Vector3(4,.1f,0);view.transform.LookAt(bounds.center);yield return CaptureFrame("single-rear-Idle",count,null,0,-1,-1,faceState);if(finished)yield break;
                Vector3 headTarget=new Vector3(bounds.center.x,bounds.max.y-.20f,bounds.center.z);view.transform.position=headTarget+new Vector3(-1,.08f,-.35f);view.transform.LookAt(headTarget);view.orthographicSize=.34f;yield return CaptureFrame("single-face-quarter",count,null,0,-1,-1,faceState);if(finished)yield break;
                if(Arg("--shadow-study","false").Equals("true",StringComparison.OrdinalIgnoreCase)){yield return StudyShadows(validationAnimator,faceState,count,bounds,savedPosition,savedRotation,savedSize);if(finished)yield break;}
                view.transform.position=savedPosition;view.transform.rotation=savedRotation;view.orthographicSize=savedSize;
                if(Arg("--preview-sequence","false").Equals("true",StringComparison.OrdinalIgnoreCase)){
                    string walk=stateNames.FirstOrDefault(n=>n.Equals("Walk",StringComparison.OrdinalIgnoreCase)||n.EndsWith("|Walk",StringComparison.OrdinalIgnoreCase));
                    if(walk==null){Emit("error","Walk preview requested but no Walk state exists",count);finished=true;Application.Quit(2);yield break;}
                    var clip=controller.animationClips.FirstOrDefault(c=>c.name.Equals("Walk",StringComparison.OrdinalIgnoreCase)||c.name.EndsWith("|Walk",StringComparison.OrdinalIgnoreCase));
                    if(clip==null){Emit("error","Walk preview clip missing",count);finished=true;Application.Quit(2);yield break;}
                    Directory.CreateDirectory(Path.Combine(folder,"walk-preview"));const int previewFrames=60;var sequence=new PreviewSequence{clip=clip.name,state=walk,frames=previewFrames,clipSeconds=clip.length,framesPerSecond=previewFrames/clip.length,sourceSha256=sourceSha256,buildIdentity=buildIdentity,cameraPosition=view.transform.position,cameraRotation=view.transform.rotation,orthographicSize=view.orthographicSize};
                    Emit("preview-sequence-start","60 evenly spaced imported Walk poses; outside all timing intervals",count);
                    for(int frame=0;frame<previewFrames;frame++){float phase=(float)frame/previewFrames;validationAnimator.speed=1;validationAnimator.Play(Animator.StringToHash(validationAnimator.GetLayerName(0)+"."+walk),0,phase);validationAnimator.Update(0);validationAnimator.speed=0;yield return CaptureFrame("walk-preview/frame-"+frame.ToString("D4"),count,clip.name,phase,frame,-1,walk);if(finished)yield break;}
                    File.WriteAllText(Path.Combine(folder,"walk-preview/sequence.json"),JsonUtility.ToJson(sequence,true));Emit("preview-sequence-complete","60 RenderTexture readbacks saved; phase0 inclusive through59/60, loop endpoint excluded",count);
                }
                validationAnimator.speed=1;validationAnimator.Play(stateNames[0],0,0);validationAnimator.Update(0);
            }
            if(count==25&&Arg("--crowd-preview","false")=="true"){yield return CaptureCrowdSequence(count);if(finished)yield break;}
            for(int i=0;i<units.Count;i++){var a=UnitAnimator(units[i]);var assigned=animationAssignments[i];a.speed=assigned.speed;a.Play(Animator.StringToHash(a.GetLayerName(0)+"."+assigned.state),0,assigned.phase);a.Update(0);}
            WriteAnimationEvidence(count,"assigned");
            double warm=Time.realtimeSinceStartupAsDouble;while(Time.realtimeSinceStartupAsDouble-warm<3)yield return null;
            WriteAnimationEvidence(count,"before-sample");WriteLodEvidence(count);WriteVisibilityEvidence(count,"before-sample");
            Emit("sample","Warmup complete; sampling",count);
            var before=Proof();var wall=new List<double>(10000);var cpu=new List<double>(10000);var gpu=new List<double>(10000);var counters=counterNames.Select(_=>new List<double>(10000)).ToArray();var timing=new FrameTiming[1];ulong lastStamp=0;
            var proofBones=units[0].GetComponentInChildren<SkinnedMeshRenderer>().bones.Where(b=>b!=null).ToArray(); var initialRotations=proofBones.Select(b=>b.localRotation).ToArray(); float boneDelta=0;
            long renderedBefore=renderedFrames;double start=Time.realtimeSinceStartupAsDouble,previous=start;
            while(Time.realtimeSinceStartupAsDouble-start<seconds){
                FrameTimingManager.CaptureFrameTimings();yield return null;
                double now=Time.realtimeSinceStartupAsDouble;wall.Add((now-previous)*1000);previous=now;
                for(int b=0;b<proofBones.Length;b++)boneDelta=Mathf.Max(boneDelta,Quaternion.Angle(initialRotations[b],proofBones[b].localRotation));
                if(FrameTimingManager.GetLatestTimings(1,timing)>0 && timing[0].frameStartTimestamp!=lastStamp){lastStamp=timing[0].frameStartTimestamp;if(timing[0].cpuFrameTime>0)cpu.Add(timing[0].cpuFrameTime);if(timing[0].gpuFrameTime>0)gpu.Add(timing[0].gpuFrameTime);}
                for(int i=0;i<recorders.Count;i++)if(recorders[i].Valid&&recorders[i].Count>0)counters[i].Add(recorders[i].LastValue);
            }
            var after=Proof();var result=new Result{count=count,width=renderTarget.width,height=renderTarget.height,camera=view.name,sourceSha256=sourceSha256,buildIdentity=buildIdentity,renderedFrameCount=renderedFrames-renderedBefore,rendererCount=renderers.Length,skinnedRendererCount=renderers.OfType<SkinnedMeshRenderer>().Count(),materialSlots=renderers.Sum(r=>r.sharedMaterials.Length),instantiatedTriangles=renderers.Sum(r=>{Mesh m=r is SkinnedMeshRenderer s?s.sharedMesh:r.GetComponent<MeshFilter>()?.sharedMesh;return m==null?0L:Enumerable.Range(0,m.subMeshCount).Sum(n=>(long)m.GetIndexCount(n)/3);}),allocatedMemoryBytes=Profiler.GetTotalAllocatedMemoryLong(),reservedMemoryBytes=Profiler.GetTotalReservedMemoryLong(),managedBytes=GC.GetTotalMemory(false),elapsedSeconds=Time.realtimeSinceStartupAsDouble-start,shadows=true,maxBoneRotationDeltaDegrees=boneDelta,bakedVertexMaxDeltaMeters=vertexDelta,before=before,after=after,animationAdvanced=boneDelta>.01f && before.stateHash==after.stateHash && Mathf.Abs(after.normalizedTime-before.normalizedTime)>.001f,frameWallMs=Summarize(wall)};
            if(forcedLod>=0){var selected=units.SelectMany(u=>{var g=u.GetComponent<LODGroup>();return g==null?u.GetComponentsInChildren<Renderer>():g.GetLODs()[forcedLod].renderers;}).ToArray();result.forcedLodRenderers=selected.Length;result.forcedLodMaterialSlots=selected.Sum(r=>r.sharedMaterials.Length);result.forcedLodTriangles=selected.OfType<SkinnedMeshRenderer>().Sum(r=>Enumerable.Range(0,r.sharedMesh.subMeshCount).Sum(n=>(long)r.sharedMesh.GetIndexCount(n)/3));}
            string json=JsonUtility.ToJson(result);json=json.Substring(0,json.Length-1)+",\"cpuFrameTimingMs\":"+JsonMetric(cpu)+",\"gpuFrameTimingMs\":"+JsonMetric(gpu)+",\"renderCounters\":{"+string.Join(",",counterNames.Select((n,i)=>"\""+n+"\":"+JsonMetric(counters[i])))+"}}";
            File.AppendAllText(log,json+"\n");Emit("sample-complete","Timing interval finished",count);WriteAnimationEvidence(count,"after-sample");WriteVisibilityEvidence(count,"after-sample");
            if(!result.animationAdvanced||result.renderedFrameCount==0){Emit("error","Animator state failed advancement proof",count);Application.Quit(2);yield break;}
            if(count==1||count==100||count==500)yield return CaptureFrame("crowd-"+count,count,null,-1,-1,-1,animationAssignments[0].state);
        }
        Emit("complete","All requested stages finished");finished=true;yield return new WaitForSecondsRealtime(.5f);Application.Quit(0);
    }
    [Serializable] class VisibilityEvidence {public int count,unitsWithBoundsInCameraFrustum,observedVisibleRenderers,totalResidentRenderers;public string stage,scope="Frustum-bound inclusion and Renderer.isVisible observations; isVisible may include shadow passes, not proof of selected LOD draws";public bool updateWhenOffscreen;}
    void WriteVisibilityEvidence(int count,string stage){var planes=GeometryUtility.CalculateFrustumPlanes(view);var rs=units.SelectMany(u=>u.GetComponentsInChildren<Renderer>()).ToArray();int included=units.Count(u=>u.GetComponentsInChildren<Renderer>().Any(r=>GeometryUtility.TestPlanesAABB(planes,r.bounds)));File.WriteAllText(Path.Combine(folder,"visibility-"+count+"-"+stage+".json"),JsonUtility.ToJson(new VisibilityEvidence{count=count,stage=stage,updateWhenOffscreen=skinUpdateWhenOffscreen,unitsWithBoundsInCameraFrustum=included,observedVisibleRenderers=rs.Count(r=>r.isVisible),totalResidentRenderers=rs.Length},true));if(included!=count)throw new InvalidOperationException("Not all unit bounds are in camera frustum");}
    [Serializable] class CrowdSequence {public int frames=60,fps=30,count=25,seed;public string mode,sourceSha256,buildIdentity,scope="Actual imported Animator evaluation at deterministic 30 Hz; in-place animation only; captures outside timing";public UnitAnimation[] assignments;}
    IEnumerator CaptureCrowdSequence(int count){Directory.CreateDirectory(Path.Combine(folder,"crowd-preview"));Emit("crowd-preview-start","60 fixed-time frames at30fps; outside timing",count);for(int frame=0;frame<60;frame++){for(int i=0;i<units.Count;i++){var a=UnitAnimator(units[i]);var assigned=animationAssignments[i];var clip=controller.animationClips.First(c=>c.name==assigned.state||c.name.EndsWith("|"+assigned.state));float phase=assigned.phase+(frame/30f)*assigned.speed/clip.length;a.speed=1;a.Play(Animator.StringToHash(a.GetLayerName(0)+"."+assigned.state),0,phase);a.Update(0);a.speed=0;}yield return CaptureFrame("crowd-preview/frame-"+frame.ToString("D4"),count,null,-1,frame,-1,animationAssignments[0].state);if(finished)yield break;}File.WriteAllText(Path.Combine(folder,"crowd-preview/sequence.json"),JsonUtility.ToJson(new CrowdSequence{seed=animationSeed,mode=animationMode,sourceSha256=sourceSha256,buildIdentity=buildIdentity,assignments=animationAssignments.ToArray()},true));Emit("crowd-preview-complete","60 actual rendered frames saved",count);}
    [Serializable] class LodEvidence {public int count,forcedLod,animators,distinctBoneTransforms;public LodRow[] levels;public string scope="Configured renderer geometry; automatic visibility is not a GPU submission count. Use render counters for actual submissions.";}
    [Serializable] class LodRow {public int level,renderers,materialSlots;public long triangles;public float transition;}
    void WriteLodEvidence(int count){var g=units[0].GetComponent<LODGroup>();var levels=g==null?new[]{new LOD(0,units[0].GetComponentsInChildren<Renderer>())}:g.GetLODs();var rows=levels.Select((l,i)=>new LodRow{level=i,renderers=l.renderers.Length,materialSlots=l.renderers.Sum(r=>r.sharedMaterials.Length),triangles=l.renderers.OfType<SkinnedMeshRenderer>().Sum(r=>Enumerable.Range(0,r.sharedMesh.subMeshCount).Sum(n=>(long)r.sharedMesh.GetIndexCount(n)/3)),transition=l.screenRelativeTransitionHeight}).ToArray();File.WriteAllText(Path.Combine(folder,"lod-configuration-"+count+".json"),JsonUtility.ToJson(new LodEvidence{count=count,forcedLod=forcedLod,animators=units[0].GetComponentsInChildren<Animator>().Length,distinctBoneTransforms=units[0].GetComponentsInChildren<SkinnedMeshRenderer>().SelectMany(r=>r.bones).Distinct().Count(),levels=rows},true));}
    [Serializable] class UnitAnimation {public int unit;public string state;public float phase,speed;}
    [Serializable] class AnimationSample {public int unit,expectedStateHash,actualStateHash;public string expectedState,actualClip;public float initialPhase,normalizedTime,speed;public bool stateMatches;}
    [Serializable] class AnimationDistribution {public string mode,scope="In-place clips only; no navigation or locomotion";public int seed,count;public UnitAnimation[] assignments;}
    [Serializable] class AnimationSamples {public string stage;public int count;public AnimationSample[] samples;}
    static uint RandomStep(ref uint state){state^=state<<13;state^=state>>17;state^=state<<5;return state;}
    void PrepareAnimations(int count){
        animationAssignments.Clear();uint random=unchecked((uint)animationSeed)^0x9e3779b9u;if(random==0)random=1;
        string walk=stateNames.FirstOrDefault(n=>n.Equals("Walk",StringComparison.OrdinalIgnoreCase)||n.EndsWith("|Walk",StringComparison.OrdinalIgnoreCase));if(animationMode=="all-walk"&&walk==null)throw new InvalidOperationException("All-walk mode requires Walk clip");
        var shuffled=Enumerable.Range(0,count).Select(i=>animationMode=="all-walk"?walk:stateNames[i%stateNames.Length]).ToArray();
        for(int i=count-1;i>0;i--){int j=(int)(RandomStep(ref random)%(uint)(i+1));var t=shuffled[i];shuffled[i]=shuffled[j];shuffled[j]=t;}
        for(int i=0;i<count;i++){float phase=(RandomStep(ref random)&0xffffff)/16777216f;float speed=.92f+.16f*((RandomStep(ref random)&0xffffff)/16777216f);animationAssignments.Add(new UnitAnimation{unit=i,state=shuffled[i],phase=phase,speed=speed});}
        File.WriteAllText(Path.Combine(folder,"animation-distribution-"+count+".json"),JsonUtility.ToJson(new AnimationDistribution{mode=animationMode,seed=animationSeed,count=count,assignments=animationAssignments.ToArray()},true));
    }
    void WriteAnimationEvidence(int count,string stage){
        int samples=Math.Min(16,count);var rows=new List<AnimationSample>();for(int k=0;k<samples;k++){int i=samples==1?0:(int)((long)k*(count-1)/(samples-1));var a=UnitAnimator(units[i]);var info=a.GetCurrentAnimatorStateInfo(0);var clip=a.GetCurrentAnimatorClipInfo(0).FirstOrDefault().clip;var assigned=animationAssignments[i];int expected=Animator.StringToHash(a.GetLayerName(0)+"."+assigned.state);rows.Add(new AnimationSample{unit=i,expectedState=assigned.state,actualClip=clip==null?null:clip.name,expectedStateHash=expected,actualStateHash=info.fullPathHash,stateMatches=expected==info.fullPathHash,initialPhase=assigned.phase,normalizedTime=info.normalizedTime,speed=a.speed});}
        File.WriteAllText(Path.Combine(folder,"animation-samples-"+count+"-"+stage+".json"),JsonUtility.ToJson(new AnimationSamples{stage=stage,count=count,samples=rows.ToArray()},true));
        if(rows.Any(r=>!r.stateMatches))throw new InvalidOperationException("Runtime crowd animation assignment mismatch");
    }
    [Serializable] class Identity {public string sourcePath,sourceSha256,buildIdentity,unityBuildGuid,unity,gpu,cpu,graphicsApi,camera,animatorRootPath,colorSpace;public int ramMiB,vramMiB,renderWidth,renderHeight,msaa,renderTargetSamples;public float renderScale,shadowDistance,sunIntensity;public Vector3 sunEuler;public Color sunColor,ambientColor;public string ambientMode;public string shadowOverridePolicy;public bool allVariantsRetained,skinUpdateWhenOffscreen;public bool development,renderTargetSrgb;public ShadowSettings shadowSettings;public string fixturePolicy="Runtime clone uses serialized fixture cascades/distance; original pipeline asset is not modified";public string renderMode,materialMode,animationMode;public int animationSeed,forcedLod;public string[] lodSourceHashes;public bool cameraEnabled;}
    [Serializable] class CaptureProof {public string kind="capture",file,sha256,camera,clip,requestedState;public int actualShortNameHash,actualFullPathHash,expectedShortNameHash,expectedFullPathHash;public bool stateMatches,phaseMatches;public int count,width,height,minLuminance,maxLuminance,sequenceFrame;public float requestedPhase,actualNormalizedTime;public long renderedFrame;public int settledRenderCallbacks;public bool nonUniform;public ShadowSettings shadowSettings;}
    Animator UnitAnimator(GameObject unit){var target=string.IsNullOrEmpty(animatorRootPath)?unit.transform:unit.transform.Find(animatorRootPath);if(target==null||target.GetComponent<Animator>()==null)throw new InvalidOperationException("Serialized animation binding root missing: "+animatorRootPath);return target.GetComponent<Animator>();}
    void OnCameraRendered(ScriptableRenderContext context,Camera camera){if(camera==view)renderedFrames++;}
    void LateUpdate(){if(renderMode!="manual"||renderTarget==null||finished)return;try{RenderPipeline.SubmitRenderRequest(view,renderRequest);}catch(Exception e){Emit("error","Explicit camera render failed: "+e.Message);finished=true;Application.Quit(3);}}
    void OnGUI(){if(renderTarget!=null)GUI.DrawTexture(new Rect(0,0,Screen.width,Screen.height),renderTarget,ScaleMode.ScaleToFit,false);}
    [Serializable] class PreviewSequence {public string clip,state,sourceSha256,buildIdentity;public int frames;public float clipSeconds,framesPerSecond,orthographicSize;public Vector3 cameraPosition;public Quaternion cameraRotation;public string scope="Imported Unity Animator Walk; fixed full-body three-quarter camera; outside benchmark timing; phases [0,1)";}
    IEnumerator CaptureFrame(string name,int count,string clipName=null,float requestedPhase=-1,int sequenceFrame=-1,float actualNormalizedTime=-1,string requestedState=null){
        // Skin and shadow uploads can trail Animator evaluation. Require completed renders, not a time delay.
        const int settleCallbacks=3;long before=renderedFrames;double until=Time.realtimeSinceStartupAsDouble+10;while(renderedFrames-before<settleCallbacks&&Time.realtimeSinceStartupAsDouble<until)yield return null;
        if(renderedFrames-before<settleCallbacks){Emit("error","Insufficient camera renders for settled capture",count);finished=true;Application.Quit(3);yield break;}
        var captureAnimator=UnitAnimator(units[0]);var captureState=captureAnimator.GetCurrentAnimatorStateInfo(0);var activeClips=captureAnimator.GetCurrentAnimatorClipInfo(0);string actualClip=activeClips.Length>0&&activeClips[0].clip!=null?activeClips[0].clip.name:null;
        int expectedShort=requestedState==null?0:Animator.StringToHash(requestedState);int expectedFull=requestedState==null?0:Animator.StringToHash(captureAnimator.GetLayerName(0)+"."+requestedState);
        bool stateMatches=requestedState==null||(captureState.shortNameHash==expectedShort&&captureState.fullPathHash==expectedFull);bool phaseMatches=requestedPhase<0||Mathf.Abs(captureState.normalizedTime-requestedPhase)<.002f;
        bool clipMatches=clipName==null||clipName==actualClip;
        if(!stateMatches||!phaseMatches||!clipMatches||actualClip==null){Emit("error","Capture state mismatch: requested="+requestedState+" actual clip="+actualClip+" phase="+captureState.normalizedTime+" shortHash="+captureState.shortNameHash+" fullHash="+captureState.fullPathHash,count);finished=true;Application.Quit(4);yield break;}
        var previous=RenderTexture.active;var pixels=new Texture2D(renderTarget.width,renderTarget.height,TextureFormat.RGBA32,false);RenderTexture.active=renderTarget;pixels.ReadPixels(new Rect(0,0,renderTarget.width,renderTarget.height),0,0);pixels.Apply();RenderTexture.active=previous;
        var colors=pixels.GetPixels32();int min=255,max=0;for(int i=0;i<colors.Length;i+=31){int luminance=(54*colors[i].r+183*colors[i].g+19*colors[i].b)>>8;min=Math.Min(min,luminance);max=Math.Max(max,luminance);}
        byte[] png=pixels.EncodeToPNG();string file=name+".png";File.WriteAllBytes(Path.Combine(folder,file),png);string hash;using(var h=SHA256.Create())hash=BitConverter.ToString(h.ComputeHash(png)).Replace("-","").ToLowerInvariant();Destroy(pixels);
        File.AppendAllText(log,JsonUtility.ToJson(new CaptureProof{file=file,sha256=hash,camera=view.name,count=count,clip=actualClip,requestedState=requestedState,actualShortNameHash=captureState.shortNameHash,actualFullPathHash=captureState.fullPathHash,expectedShortNameHash=expectedShort,expectedFullPathHash=expectedFull,stateMatches=stateMatches,phaseMatches=phaseMatches,requestedPhase=requestedPhase,sequenceFrame=sequenceFrame,actualNormalizedTime=captureState.normalizedTime,width=renderTarget.width,height=renderTarget.height,minLuminance=min,maxLuminance=max,renderedFrame=renderedFrames,settledRenderCallbacks=(int)(renderedFrames-before),shadowSettings=GetShadowSettings(),nonUniform=max-min>8})+"\n");
        if(max-min<=8){Emit("error","RenderTexture readback appears uniform; inspect capture",count);finished=true;Application.Quit(3);}
    }
    void ConfigureFixturePipeline(){var original=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;if(original==null)throw new InvalidOperationException("URP fixture required");previousDefaultPipeline=GraphicsSettings.defaultRenderPipeline;previousQualityPipeline=QualitySettings.renderPipeline;fixturePipeline=Instantiate(original);fixturePipeline.name="SoldierFixtureRuntimePipeline";fixturePipeline.shadowCascadeCount=fixtureShadowCascades;fixturePipeline.shadowDistance=fixtureShadowDistance;GraphicsSettings.defaultRenderPipeline=fixturePipeline;QualitySettings.renderPipeline=fixturePipeline;}
    void ApplyShadowOverrides(){
        string depth=Arg("--shadow-depth-bias",""),normal=Arg("--shadow-normal-bias",""),resolution=Arg("--shadow-resolution",""),cascades=Arg("--shadow-cascades",""),distance=Arg("--shadow-distance","");
        if(depth==""&&normal==""&&resolution==""&&cascades==""&&distance=="")return;
        var light=UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).First(l=>l.type==LightType.Directional);var pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;var baseline=GetShadowSettings();
        if(depth!=""||normal!=""){var data=light.GetComponent<UniversalAdditionalLightData>()??light.gameObject.AddComponent<UniversalAdditionalLightData>();float d=depth==""?baseline.effectiveDepthBias:float.Parse(depth,System.Globalization.CultureInfo.InvariantCulture),n=normal==""?baseline.effectiveNormalBias:float.Parse(normal,System.Globalization.CultureInfo.InvariantCulture);if(d<0||d>10||n<0||n>10)throw new ArgumentException("Shadow biases must be between0 and10");light.shadowBias=d;light.shadowNormalBias=n;data.usePipelineSettings=false;}
        if(resolution!=""){int value=int.Parse(resolution);if(value!=1024&&value!=2048&&value!=4096)throw new ArgumentException("Shadow resolution must be1024,2048or4096");pipeline.mainLightShadowmapResolution=value;}
        if(cascades!=""){int value=int.Parse(cascades);if(value!=1&&value!=2&&value!=4)throw new ArgumentException("Shadow cascades must be1,2or4");if(value!=1&&!shadowVariantsIncluded)throw new InvalidOperationException("This build did not retain cascade shader variants");pipeline.shadowCascadeCount=value;}
        if(distance!=""){float value=float.Parse(distance,System.Globalization.CultureInfo.InvariantCulture);if(value<=0||value>100)throw new ArgumentException("Shadow distance must be positive and at most100m");pipeline.shadowDistance=value;}
        shadowOverridePolicy="Explicit runtime flags: depth="+depth+", normal="+normal+", resolution="+resolution+", cascades="+cascades+", distance="+distance+". Omitted values preserve baseline effective settings.";
    }
    [Serializable] public class ShadowSettings {public string mode,biasSource;public bool usePipelineSettings;public float lightDepthBias,lightNormalBias,effectiveDepthBias,effectiveNormalBias,pipelineDepthBias,pipelineNormalBias,intensity,shadowStrength,shadowDistance;public int mainShadowResolution,cascades;public Vector3 lightEuler;public Color color,ambientColor;}
    ShadowSettings GetShadowSettings(){var light=UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).FirstOrDefault(l=>l.type==LightType.Directional);var pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;if(light==null||pipeline==null)return null;var data=light.GetComponent<UniversalAdditionalLightData>();bool usePipeline=data==null||data.usePipelineSettings;return new ShadowSettings{mode=light.shadows.ToString(),usePipelineSettings=usePipeline,biasSource=usePipeline?"URP asset":"UniversalAdditionalLightData light override",lightDepthBias=light.shadowBias,lightNormalBias=light.shadowNormalBias,pipelineDepthBias=pipeline.shadowDepthBias,pipelineNormalBias=pipeline.shadowNormalBias,effectiveDepthBias=usePipeline?pipeline.shadowDepthBias:light.shadowBias,effectiveNormalBias=usePipeline?pipeline.shadowNormalBias:light.shadowNormalBias,intensity=light.intensity,shadowStrength=light.shadowStrength,shadowDistance=pipeline.shadowDistance,mainShadowResolution=pipeline.mainLightShadowmapResolution,cascades=pipeline.shadowCascadeCount,lightEuler=light.transform.eulerAngles,color=light.color,ambientColor=RenderSettings.ambientLight};}
    IEnumerator StudyShadows(Animator animator,string state,int count,Bounds bounds,Vector3 fullPosition,Quaternion fullRotation,float fullSize){
        var light=UnityEngine.Object.FindObjectsByType<Light>(FindObjectsSortMode.None).FirstOrDefault(l=>l.type==LightType.Directional);if(light==null){Emit("error","Shadow study requires fixture directional light",count);finished=true;Application.Quit(4);yield break;}
        var original=GetShadowSettings();var data=light.GetComponent<UniversalAdditionalLightData>();bool added=data==null;if(added)data=light.gameObject.AddComponent<UniversalAdditionalLightData>();var pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;int oldResolution=pipeline.mainLightShadowmapResolution,oldCascades=pipeline.shadowCascadeCount;var oldMode=light.shadows;float oldDepth=light.shadowBias,oldNormal=light.shadowNormalBias;bool oldUse=data.usePipelineSettings;Directory.CreateDirectory(Path.Combine(folder,"shadow-study"));
        try{
            string[] variants=shadowVariantsIncluded?new[]{"baseline","shadows-off","depth-bias-0.05","depth-bias-2","depth-bias-4","resolution-4096","cascades-4"}:new[]{"baseline","shadows-off","depth-bias-0.05","depth-bias-2","depth-bias-4","resolution-4096"};
            for(int i=0;i<variants.Length;i++){
                light.shadows=oldMode;light.shadowBias=oldDepth;light.shadowNormalBias=oldNormal;data.usePipelineSettings=oldUse;pipeline.mainLightShadowmapResolution=oldResolution;pipeline.shadowCascadeCount=oldCascades;
                if(i==1)light.shadows=LightShadows.None;
                if(i>=2&&i<=4){data.usePipelineSettings=false;light.shadowBias=i==2?.05f:i==3?2:4;light.shadowNormalBias=original.effectiveNormalBias;if(data.usePipelineSettings||!Mathf.Approximately(GetShadowSettings().effectiveDepthBias,light.shadowBias))throw new InvalidOperationException("URP depth bias override was not applied");}
                if(i==5)pipeline.mainLightShadowmapResolution=4096;
                if(i==6)pipeline.shadowCascadeCount=4;
                animator.speed=1;animator.Play(Animator.StringToHash(animator.GetLayerName(0)+"."+state),0,0);animator.Update(0);animator.speed=0;
                Emit("shadow-study",variants[i]+"; outside timing; effective settings recorded in captures",count);
                view.transform.position=fullPosition;view.transform.rotation=fullRotation;view.orthographicSize=fullSize;yield return CaptureFrame("shadow-study/"+variants[i]+"-body",count,null,0,-1,-1,state);if(finished)yield break;
                Vector3 target=new Vector3(bounds.center.x,bounds.max.y-.20f,bounds.center.z);view.transform.position=target+new Vector3(-1,.08f,-.35f);view.transform.LookAt(target);view.orthographicSize=.34f;yield return CaptureFrame("shadow-study/"+variants[i]+"-face",count,null,0,-1,-1,state);if(finished)yield break;
            }
        } finally {light.shadows=oldMode;light.shadowBias=oldDepth;light.shadowNormalBias=oldNormal;data.usePipelineSettings=oldUse;pipeline.mainLightShadowmapResolution=oldResolution;pipeline.shadowCascadeCount=oldCascades;if(added)Destroy(data);view.transform.position=fullPosition;view.transform.rotation=fullRotation;view.orthographicSize=fullSize;}
        File.WriteAllText(Path.Combine(folder,"shadow-study/restored-settings.json"),JsonUtility.ToJson(GetShadowSettings(),true));Emit("shadow-study-complete","Original shadow settings restored before warmup",count);
    }
    void OnDestroy(){RenderPipelineManager.endCameraRendering-=OnCameraRendered;if(fixturePipeline!=null){if(GraphicsSettings.defaultRenderPipeline==fixturePipeline)GraphicsSettings.defaultRenderPipeline=previousDefaultPipeline;if(QualitySettings.renderPipeline==fixturePipeline)QualitySettings.renderPipeline=previousQualityPipeline;Destroy(fixturePipeline);}foreach(var r in recorders)r.Dispose();if(renderTarget!=null){renderTarget.Release();Destroy(renderTarget);}}

}





