using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

namespace LastCrossing.Playable
{
    public sealed class SiegeEnemyHandle : MonoBehaviour { public int id; }

    public sealed class CastleSiegeGame : MonoBehaviour
    {
        public GameObject soldierPrefab;
        public RuntimeAnimatorController soldierController;
        public Camera gameplayCamera;
        public float soldierForwardYaw=90, defenseRange=80;
        public SiegeSimulation Simulation { get; private set; }
        readonly Dictionary<int,GameObject> actors=new Dictionary<int,GameObject>();
        Transform[] path;float[] segmentEnds;float pathLength;
        Transform defense,spawn,vantage;SiegeWalker walker;
        Material markerMaterial,boltMaterial;bool mounted,autoDefense,smoke,smokeVictory,smokeFailed;
        Vector3 dismountPosition;Quaternion dismountRotation;
        string status="Explore the court, then press Space to begin the siege.",smokeFolder,smokeScenario;
        double accumulator;float messageUntil;int lastDefeated,lastGate;float damageFlashUntil,hitFlashUntil;AudioSource cues;AudioClip shotCue,hitCue;
        RenderTexture smokeTarget;UniversalRenderPipeline.SingleCameraRequest renderRequest;long renderedFrames;
        RenderPipelineAsset previousDefault,previousQuality;UniversalRenderPipelineAsset temporaryPipeline;
        static string Arg(string name,string fallback=""){var a=Environment.GetCommandLineArgs();int i=Array.IndexOf(a,name);return i>=0&&i+1<a.Length?a[i+1]:fallback;}
        static Transform Marker(string name){var o=GameObject.Find(name);return o==null?null:o.transform;}
        static Transform[] Markers(string prefix){return FindObjectsByType<Transform>(FindObjectsSortMode.None).Where(t=>t.name.StartsWith(prefix,StringComparison.Ordinal)).OrderBy(t=>t.name,StringComparer.Ordinal).ToArray();}
        void Start()
        {
            smokeFolder=Arg("--slice-smoke-dir");smoke=smokeFolder!="";smokeScenario=Arg("--slice-smoke","all");
            try
            {
                path=Markers("SiegeSlice_EnemyPath");defense=Marker("SiegeSlice_Defense");spawn=Marker("SiegeSlice_PlayerSpawn");vantage=Marker("SiegeSlice_WallVantage");
                if(path.Length<2||defense==null||spawn==null||soldierPrefab==null)throw new InvalidOperationException("Siege slice requires soldierPrefab, 2+ enemy path markers, Defense and PlayerSpawn.");
                segmentEnds=new float[path.Length-1];for(int i=1;i<path.Length;i++){pathLength+=Vector3.Distance(path[i-1].position,path[i].position);segmentEnds[i-1]=pathLength;}
                Simulation=new SiegeSimulation(pathLength);
                if(gameplayCamera==null){foreach(var c in FindObjectsByType<Camera>(FindObjectsSortMode.None))c.enabled=false;gameplayCamera=new GameObject("Siege player camera").AddComponent<Camera>();gameplayCamera.tag="MainCamera";gameplayCamera.gameObject.AddComponent<AudioListener>();}
                gameplayCamera.nearClipPlane=.08f;gameplayCamera.farClipPlane=400;gameplayCamera.fieldOfView=68;
                var player=new GameObject("Siege player");player.AddComponent<CharacterController>();walker=player.AddComponent<SiegeWalker>();walker.view=gameplayCamera;walker.controlledExternally=smoke;walker.Place(spawn.position,spawn.rotation);
                var shader=Shader.Find("Universal Render Pipeline/Unlit")??Shader.Find("Universal Render Pipeline/Lit");if(shader==null)throw new InvalidOperationException("URP marker shader unavailable");
                markerMaterial=new Material(shader);markerMaterial.color=new Color(.95f,.63f,.12f);boltMaterial=new Material(shader);boltMaterial.color=new Color(1,.86f,.45f);
                var pipeline=GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
                if(pipeline!=null){previousDefault=GraphicsSettings.defaultRenderPipeline;previousQuality=QualitySettings.renderPipeline;temporaryPipeline=Instantiate(pipeline);temporaryPipeline.shadowCascadeCount=4;temporaryPipeline.shadowDistance=50;GraphicsSettings.defaultRenderPipeline=temporaryPipeline;QualitySettings.renderPipeline=temporaryPipeline;}
                Application.runInBackground=true;QualitySettings.vSyncCount=0;Application.targetFrameRate=smoke?30:60;
                if(!smoke){cues=gameObject.AddComponent<AudioSource>();cues.spatialBlend=0;cues.volume=.12f;shotCue=MakeCue("Ballista release",130,.09f);hitCue=MakeCue("Hit feedback",560,.045f);}
                if(smoke){Directory.CreateDirectory(smokeFolder);smokeTarget=new RenderTexture(1280,720,24,RenderTextureFormat.ARGB32){name="SiegeSmokeTarget"};smokeTarget.Create();gameplayCamera.targetTexture=smokeTarget;gameplayCamera.aspect=1280f/720;gameplayCamera.enabled=false;renderRequest=new UniversalRenderPipeline.SingleCameraRequest{destination=smokeTarget};RenderPipelineManager.endCameraRendering+=Rendered;StartCoroutine(Smoke());}
                else {gameplayCamera.enabled=true;Cursor.lockState=CursorLockMode.None;Cursor.visible=true;}
            }
            catch(Exception e){Debug.LogError("SIEGE_SETUP_FAILED "+e);enabled=false;if(smoke)Application.Quit(2);}
        }
        Vector3 Position(float distance)
        {
            int i=Array.FindIndex(segmentEnds,x=>x>=distance);if(i<0)return path[path.Length-1].position;
            float start=i==0?0:segmentEnds[i-1];return Vector3.Lerp(path[i].position,path[i+1].position,Mathf.InverseLerp(start,segmentEnds[i],distance));
        }
        Animator AnimatorFor(GameObject actor){return actor.GetComponentInChildren<Animator>();}
        void SyncActors()
        {
            foreach(var enemy in Simulation.Enemies)
            {
                GameObject actor;
                if(!enemy.Alive){if(actors.TryGetValue(enemy.Id,out actor)){actors.Remove(enemy.Id);Destroy(actor);}continue;}
                if(!actors.TryGetValue(enemy.Id,out actor))
                {
                    actor=Instantiate(soldierPrefab);actor.name="Siege raider "+enemy.Id;actors.Add(enemy.Id,actor);
                    var animator=AnimatorFor(actor);if(animator==null)throw new InvalidOperationException("Soldier needs an Animator");if(soldierController!=null)animator.runtimeAnimatorController=soldierController;
                    animator.applyRootMotion=false;animator.cullingMode=AnimatorCullingMode.AlwaysAnimate;animator.speed=(float)enemy.Speed/1.75f;animator.Play("Walk",0,(enemy.Id*.6180339f+.17f)%1);
                    foreach(var renderer in actor.GetComponentsInChildren<SkinnedMeshRenderer>())renderer.updateWhenOffscreen=false;
                    var lod=actor.GetComponent<LODGroup>();if(lod!=null)lod.ForceLOD(-1);
                    var handle=actor.AddComponent<SiegeEnemyHandle>();handle.id=enemy.Id;var collider=actor.AddComponent<CapsuleCollider>();collider.height=1.8f;collider.center=new Vector3(0,.9f,0);collider.radius=.33f;
                    var marker=GameObject.CreatePrimitive(PrimitiveType.Cube);marker.name="Ochre attacker marker";Destroy(marker.GetComponent<Collider>());marker.transform.SetParent(actor.transform,false);marker.transform.localPosition=new Vector3(0,2.05f,0);marker.transform.localScale=new Vector3(.16f,.16f,.16f);marker.GetComponent<Renderer>().sharedMaterial=markerMaterial;
                }
                Vector3 p=Position((float)enemy.Distance),direction=Position(Mathf.Min(pathLength,(float)enemy.Distance+.4f))-p;
                actor.transform.position=p;if(direction.sqrMagnitude>.001f)actor.transform.rotation=Quaternion.LookRotation(direction.normalized)*Quaternion.Euler(0,soldierForwardYaw,0);
                var anim=AnimatorFor(actor);bool arrived=enemy.Distance>=pathLength;
                string desired=arrived?"Idle":"Walk";if(!anim.IsInTransition(0) && !anim.GetCurrentAnimatorStateInfo(0).IsName(desired))anim.CrossFade(desired,.12f);
            }
            Physics.SyncTransforms();
        }
        void Update()
        {
            if(Simulation==null)return;
            accumulator+=Math.Min(Time.deltaTime,.1f);while(accumulator>=.02){Simulation.Tick(.02);accumulator-=.02;}
            SyncActors();
            if(Simulation.Defeated>lastDefeated){Notify("Hit confirmed — raider down.",1.2f);lastDefeated=Simulation.Defeated;}
            if(Simulation.GateHealth<lastGate){damageFlashUntil=Time.unscaledTime+.22f;Notify("Inner barricade under attack! R repairs for 3 supplies.",2);}lastGate=Simulation.GateHealth;
            if((autoDefense && !mounted) || smokeVictory){var target=BestTarget();if(target!=null)Fire(target.Id,false,!smokeVictory);}
            if(smoke)return;
            bool ended=Simulation.State==SiegeSimulation.Phase.Victory||Simulation.State==SiegeSimulation.Phase.Breached;if(ended){Cursor.lockState=CursorLockMode.None;Cursor.visible=true;}
            bool focused=Cursor.lockState==CursorLockMode.Locked && !ended;
            var k=Keyboard.current;var m=Mouse.current;
            if(k!=null)
            {
                if(k.escapeKey.wasPressedThisFrame){Cursor.lockState=CursorLockMode.None;Cursor.visible=true;focused=false;}
                if(k.spaceKey.wasPressedThisFrame)Begin();
                if(k.enterKey.wasPressedThisFrame)Restart();
                if(focused && k.eKey.wasPressedThisFrame)ToggleMount();
                if(focused && k.fKey.wasPressedThisFrame){autoDefense=!autoDefense;Notify(autoDefense?"Ballista crew: automatic fire.":"Ballista crew: hold fire.");}
                if(focused && k.rKey.wasPressedThisFrame)Repair();
                if(focused && mounted && k.qKey.wasPressedThisFrame)Fire(AimedTarget(),true,false);
            }
            if(m!=null && focused)
            {
                if(mounted){walker.Look(m.delta.ReadValue());if(m.leftButton.isPressed)Fire(AimedTarget(),false,false);}
            }
            if(walker.transform.position.y<spawn.position.y-15){walker.Place(spawn.position,spawn.rotation);Notify("Returned to the courtyard after a fall.");}
        }
        public void Begin(){if(Simulation.Start())Notify("Raiders approaching. Hold the crossing!");}
        public void Restart()
        {
            if(mounted)ToggleMount();foreach(var a in actors.Values)Destroy(a);actors.Clear();Simulation.Reset();accumulator=0;autoDefense=false;smokeVictory=false;lastDefeated=0;lastGate=200;
            walker.Place(spawn.position,spawn.rotation);Notify("New siege ready. Space starts the wave.");
        }
        void Repair(){Notify(Simulation.TryRepair()?"Barricade repaired +75. Supplies spent: 3.":"Repair needs 3 supplies and a damaged barricade.");}
        void ToggleMount()
        {
            if(!mounted && Vector3.Distance(gameplayCamera.transform.position,defense.position)>3){Notify("Climb the west stair to the ballista. E operates it nearby.");return;}
            mounted=!mounted;walker.mounted=mounted;
            if(mounted){dismountPosition=walker.transform.position;dismountRotation=walker.transform.rotation;gameplayCamera.transform.SetParent(null);gameplayCamera.transform.position=vantage!=null?vantage.position:defense.position+Vector3.up*.45f;gameplayCamera.transform.LookAt(Position(pathLength*.35f)+Vector3.up*.8f);walker.SetLook(gameplayCamera.transform.rotation);Cursor.lockState=CursorLockMode.Locked;Cursor.visible=false;Notify("Aim with mouse. Hold left button to fire. Q heavy bolt. E leave.");}
            else walker.Place(dismountPosition,dismountRotation);
        }
        SiegeSimulation.Enemy BestTarget()
        {
            return Simulation.Enemies.Where(e=>e.Alive && ClearShot(e.Id)).OrderByDescending(e=>e.Distance).FirstOrDefault();
        }
        bool ClearShot(int id)
        {
            GameObject actor;if(!actors.TryGetValue(id,out actor))return false;Vector3 d=actor.transform.position+Vector3.up*.95f-defense.position;if(d.magnitude>defenseRange)return false;
            RaycastHit hit;if(!Physics.Raycast(defense.position,d.normalized,out hit,d.magnitude+.5f,~0,QueryTriggerInteraction.Ignore))return false;
            var handle=hit.collider.GetComponentInParent<SiegeEnemyHandle>();return handle!=null && handle.id==id;
        }
        int AimedTarget()
        {
            RaycastHit hit;if(Physics.Raycast(gameplayCamera.ViewportPointToRay(new Vector3(.5f,.5f,0)),out hit,defenseRange,~0,QueryTriggerInteraction.Ignore)){var h=hit.collider.GetComponentInParent<SiegeEnemyHandle>();if(h!=null && ClearShot(h.id))return h.id;}return -1;
        }
        void Fire(int id,bool heavy,bool automatic)
        {
            if(!Simulation.TryShoot(id,heavy,automatic))return;
            if(!smoke && cues!=null)cues.PlayOneShot(id>=0?hitCue:shotCue);if(id>=0)hitFlashUntil=Time.unscaledTime+.12f;
            Vector3 end=defense.position+gameplayCamera.transform.forward*25;GameObject target;if(actors.TryGetValue(id,out target))end=target.transform.position+Vector3.up*.95f;
            var go=new GameObject("Ballista bolt trail");var line=go.AddComponent<LineRenderer>();line.sharedMaterial=boltMaterial;line.positionCount=2;line.SetPosition(0,defense.position);line.SetPosition(1,end);line.startWidth=heavy?.08f:.035f;line.endWidth=.015f;Destroy(go,.12f);
            if(id<0&&!automatic)Notify("Miss — lead the nearest raider.",.8f);
        }
        void Notify(string message,float duration=3){status=message;messageUntil=Time.unscaledTime+duration;}
        void OnGUI()
        {
            if(Simulation==null)return;
            if(smokeTarget!=null)GUI.DrawTexture(new Rect(0,0,Screen.width,Screen.height),smokeTarget,ScaleMode.ScaleToFit,false);
            if(Time.unscaledTime<damageFlashUntil){var oldColor=GUI.color;GUI.color=new Color(1,.08f,.03f,.14f);GUI.DrawTexture(new Rect(0,0,Screen.width,Screen.height),Texture2D.whiteTexture);GUI.color=oldColor;}
            GUI.Box(new Rect(12,12,470,196),"THE LAST CROSSING — HOLD THE INNER BARRICADE");
            GUI.Label(new Rect(26,40,440,25),"Barricade "+Simulation.GateHealth+" / 200    Supplies "+Simulation.Supplies+"    Raiders "+Simulation.Defeated+" / 24");
            GUI.Label(new Rect(26,64,440,24),"Wave: "+Simulation.State+"    Active "+Simulation.AliveCount+" / 12    Crew "+(mounted?"MANUAL":autoDefense?"AUTO":"HOLD"));
            GUI.Label(new Rect(26,88,440,24),"WASD / Shift move   E ballista   Mouse aim /left fire");
            GUI.Label(new Rect(26,110,440,24),"F auto crew   Q heavy bolt (2)   R repair (3)   Esc cursor");
            GUI.Label(new Rect(26,136,440,24),"Manual reload 0.95s; automatic crew 2.2s. Heavy bolt: 2 supplies.");
            if(GUI.Button(new Rect(26,168,130,28),Simulation.State==SiegeSimulation.Phase.Ready?"Start wave [Space]":"Restart [Enter]")){if(Simulation.State==SiegeSimulation.Phase.Ready)Begin();else Restart();}
            if(GUI.Button(new Rect(168,168,130,28),"Auto crew [F]"))autoDefense=!autoDefense;
            if(GUI.Button(new Rect(310,168,140,28),"Repair [R]"))Repair();
            if(Cursor.lockState!=CursorLockMode.Locked&&!smoke && GUI.Button(new Rect(Screen.width-190,18,175,34),"Enter mouse look")){Cursor.lockState=CursorLockMode.Locked;Cursor.visible=false;}
            if(mounted){GUI.Label(new Rect(Screen.width*.5f-5,Screen.height*.5f-12,20,25),Time.unscaledTime<hitFlashUntil?"X":"+");GUI.Label(new Rect(Screen.width*.5f-110,Screen.height*.5f+24,240,24),Simulation.Time<Simulation.NextShotAt?"Reloading…":"READY — fire / Q heavy bolt");}
            if(Time.unscaledTime<messageUntil || Simulation.State==SiegeSimulation.Phase.Ready)GUI.Box(new Rect(18,Screen.height-62,Mathf.Min(780,Screen.width-36),42),status);
            if(Simulation.State==SiegeSimulation.Phase.Victory || Simulation.State==SiegeSimulation.Phase.Breached){GUI.Box(new Rect(Screen.width*.5f-210,Screen.height*.5f-65,420,130),Simulation.State==SiegeSimulation.Phase.Victory?"VICTORY — THE CROSSING HOLDS":"DEFEAT — THE INNER BARRICADE IS BREACHED");GUI.Label(new Rect(Screen.width*.5f-175,Screen.height*.5f-20,350,30),"Raider wave ended. Press Enter for a fresh siege.");}
        }
        static AudioClip MakeCue(string name,float frequency,float duration){int length=(int)(22050*duration);var samples=new float[length];for(int i=0;i<length;i++){float t=i/22050f;samples[i]=Mathf.Sin(t*frequency*2*Mathf.PI)*Mathf.Exp(-t*45)*.4f;}var clip=AudioClip.Create(name,length,1,22050,false);clip.SetData(samples,0);return clip;}
        void Rendered(ScriptableRenderContext context,Camera camera){if(camera==gameplayCamera)renderedFrames++;}
        void LateUpdate(){if(smokeTarget!=null)RenderPipeline.SubmitRenderRequest(gameplayCamera,renderRequest);}
        [Serializable] class Checkpoint { public string stage,state,message;public double simulationTime;public int gate,supplies,spawned,defeated,alive;public long renderedFrames;public Vector3 player;public bool grounded; }
        void Record(string stage,string message="") { var row=new Checkpoint{stage=stage,message=message,state=Simulation.State.ToString(),simulationTime=Simulation.Time,gate=Simulation.GateHealth,supplies=Simulation.Supplies,spawned=Simulation.Spawned,defeated=Simulation.Defeated,alive=Simulation.AliveCount,renderedFrames=renderedFrames,player=walker.transform.position,grounded=walker.Grounded};File.AppendAllText(Path.Combine(smokeFolder,"checkpoints.jsonl"),JsonUtility.ToJson(row)+"\n");Debug.Log("SIEGE_SMOKE "+stage+" "+message); }
        IEnumerator Capture(string name)
        {
            long first=renderedFrames;float deadline=Time.realtimeSinceStartup+10;while(renderedFrames-first<3 && Time.realtimeSinceStartup<deadline)yield return null;
            if(renderedFrames-first<3){smokeFailed=true;Record("failure","No actual camera callbacks");Application.Quit(3);yield break;}
            var old=RenderTexture.active;RenderTexture.active=smokeTarget;var image=new Texture2D(1280,720,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1280,720),0,0);image.Apply();RenderTexture.active=old;File.WriteAllBytes(Path.Combine(smokeFolder,name+".png"),image.EncodeToPNG());Destroy(image);Record("capture",name);
        }
        IEnumerator WalkTo(Vector3 point,string label)
        {
            float deadline=Time.realtimeSinceStartup+25;
            while((Vector2.Distance(new Vector2(walker.transform.position.x,walker.transform.position.z),new Vector2(point.x,point.z))>.35f || Mathf.Abs(walker.transform.position.y-point.y)>.55f) && Time.realtimeSinceStartup<deadline){walker.WalkToward(point,Time.deltaTime);yield return null;}
            if(Time.realtimeSinceStartup>=deadline){smokeFailed=true;Record("failure","Blocked walking route: "+label);yield return Capture("walk-blocked");Application.Quit(4);yield break;}
            Record("walk-checkpoint",label);
        }
        IEnumerator ReviewCapture(string markerName,string filename)
        {
            var marker=Marker(markerName);if(marker==null){Record("review-marker-missing",markerName);yield break;}
            Vector3 p=gameplayCamera.transform.position;Quaternion q=gameplayCamera.transform.rotation;
            gameplayCamera.transform.SetPositionAndRotation(marker.position,marker.rotation);yield return Capture(filename);gameplayCamera.transform.SetPositionAndRotation(p,q);
        }
        [Serializable] class AimProof {public int target,aimed,healthBefore,healthAfter;public bool mounted,lineOfSight,damageApplied,cooldownActive;}
        IEnumerator Smoke()
        {
            Record("input-devices","Keyboard="+(Keyboard.current!=null)+" Mouse="+(Mouse.current!=null)+"; device presence is not an interactive key-event test");
            if(Keyboard.current==null||Mouse.current==null){Record("failure","Input System keyboard/mouse absent; check activeInputHandler");Application.Quit(8);yield break;}
            Record("ready","Scene setup complete; real-time physics; smoke limited to 30fps");yield return Capture("court-start");if(smokeFailed)yield break;
            yield return ReviewCapture("SiegeSlice_ReviewOverview","overview");yield return ReviewCapture("SiegeSlice_ReviewApproach","approach");
            bool traversal=smokeScenario=="all"||smokeScenario=="walk"||smokeScenario=="victory";
            var route=Markers("SiegeSlice_PlayerRoute");
            if(traversal)
            {
                if(route.Length==0){Record("failure","No collision-traversal route markers supplied");Application.Quit(4);yield break;}
                foreach(var point in route){yield return WalkTo(point.position,"ascend "+point.name);if(smokeFailed)yield break;}
                yield return Capture("wall-after-walk");if(smokeFailed)yield break;
            }
            if(smokeScenario=="all"||smokeScenario=="victory")
            {
                ToggleMount();if(!mounted){Record("failure","Could not mount after physical stair traversal");Application.Quit(5);yield break;}
                Begin();Record("mounted-wave-start");float targetDeadline=Time.realtimeSinceStartup+15;SiegeSimulation.Enemy target=null;
                while(target==null && Time.realtimeSinceStartup<targetDeadline){target=BestTarget();yield return null;}
                if(target==null){Record("failure","No raider has an unobstructed muzzle line of sight");Application.Quit(5);yield break;}
                gameplayCamera.transform.LookAt(actors[target.Id].transform.position+Vector3.up*.95f);walker.SetLook(gameplayCamera.transform.rotation);
                int aimed=AimedTarget(),before=target.Health;bool clear=ClearShot(target.Id);Fire(aimed,false,false);
                var proof=new AimProof{target=target.Id,aimed=aimed,mounted=mounted,lineOfSight=clear,healthBefore=before,healthAfter=target.Health,damageApplied=target.Health<before,cooldownActive=Simulation.NextShotAt>Simulation.Time};
                File.WriteAllText(Path.Combine(smokeFolder,"aim-proof.json"),JsonUtility.ToJson(proof,true));
                if(aimed!=target.Id||!proof.damageApplied||!proof.cooldownActive){Record("failure","Mounted crosshair shot failed actual aim/damage/cooldown gate");Application.Quit(5);yield break;}
                Record("aimed-hit","Actual mounted camera ray and muzzle LOS applied damage; later shots use LOS autoplay");
                while(Simulation.Time<12 && Simulation.State==SiegeSimulation.Phase.Running)yield return null;
                gameplayCamera.transform.LookAt(Position(pathLength*.35f)+Vector3.up);yield return Capture("active-wave");yield return ReviewCapture("SiegeSlice_ReviewOverview","active-wave-overview");if(smokeFailed)yield break;
                smokeVictory=true;Record("los-autoplay-start");float deadline=Time.realtimeSinceStartup+125;
                while(Simulation.State==SiegeSimulation.Phase.Running && Time.realtimeSinceStartup<deadline)yield return null;
                smokeVictory=false;Record("victory-result");yield return Capture("victory");if(smokeFailed)yield break;
                if(Simulation.State!=SiegeSimulation.Phase.Victory){Record("failure","LOS autoplay did not win");Application.Quit(5);yield break;}
                ToggleMount();
            }
            if(traversal)
            {
                foreach(var point in route.Reverse()){yield return WalkTo(point.position,"descend "+point.name);if(smokeFailed)yield break;}
                foreach(var point in path.Reverse()){yield return WalkTo(point.position,"bridge outward "+point.name);if(smokeFailed)yield break;}
                yield return Capture("bridge-walked-out");if(smokeFailed)yield break;
                foreach(var point in path){yield return WalkTo(point.position,"bridge return "+point.name);if(smokeFailed)yield break;}
                yield return Capture("court-return");if(smokeFailed)yield break;
            }
            if(smokeScenario=="all"||smokeScenario=="loss")
            {
                Restart();Begin();Record("unattended-start");float deadline=Time.realtimeSinceStartup+100;
                while(Simulation.State==SiegeSimulation.Phase.Running && Time.realtimeSinceStartup<deadline)yield return null;
                Record("unattended-result");yield return Capture("breach");if(smokeFailed)yield break;
                if(Simulation.State!=SiegeSimulation.Phase.Breached){Record("failure","Unattended wave did not breach");Application.Quit(6);yield break;}
            }
            Restart();Record("restart");if(Simulation.State!=SiegeSimulation.Phase.Ready||Simulation.GateHealth!=200||Simulation.Spawned!=0){Record("failure","Restart state invalid");Application.Quit(7);yield break;}
            yield return Capture("restart");if(smokeFailed)yield break;Record("complete","Requested physical traversal, interaction and state gates completed; screenshot readbacks show camera world, not OnGUI HUD");Application.Quit(0);
        }
        void OnDestroy()
        {
            RenderPipelineManager.endCameraRendering-=Rendered;
            if(temporaryPipeline!=null){if(GraphicsSettings.defaultRenderPipeline==temporaryPipeline)GraphicsSettings.defaultRenderPipeline=previousDefault;if(QualitySettings.renderPipeline==temporaryPipeline)QualitySettings.renderPipeline=previousQuality;Destroy(temporaryPipeline);}
            if(smokeTarget!=null){smokeTarget.Release();Destroy(smokeTarget);}if(markerMaterial!=null)Destroy(markerMaterial);if(boltMaterial!=null)Destroy(boltMaterial);
            if(shotCue!=null)Destroy(shotCue);if(hitCue!=null)Destroy(hitCue);
            Cursor.lockState=CursorLockMode.None;Cursor.visible=true;
        }
    }
}
