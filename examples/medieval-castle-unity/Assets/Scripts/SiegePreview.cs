using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.InputSystem;

public class SiegePreview : MonoBehaviour
{
    int frames; float elapsed; Vector3 initial; Quaternion initialRotation;
    IEnumerator Start(){initial=transform.position;initialRotation=transform.rotation;Application.runInBackground=true;yield return new WaitForSeconds(3);var args=System.Environment.GetCommandLineArgs();var i=System.Array.IndexOf(args,"--proof-dir");if(i>=0&&i+1<args.Length){Directory.CreateDirectory(args[i+1]);ScreenCapture.CaptureScreenshot(Path.Combine(args[i+1],"unity-player.png"));yield return new WaitForSeconds(2);File.WriteAllText(Path.Combine(args[i+1],"player-proof.json"),"{\"frames\":"+frames+",\"seconds\":"+elapsed.ToString(System.Globalization.CultureInfo.InvariantCulture)+",\"unity\":\""+Application.unityVersion+"\"}");}}
    void Update(){frames++;elapsed+=Time.unscaledDeltaTime;var k=Keyboard.current;var m=Mouse.current;if(k==null)return;if(k.rKey.wasPressedThisFrame){transform.SetPositionAndRotation(initial,initialRotation);}if(k.escapeKey.wasPressedThisFrame)Application.Quit();float x=(k.dKey.isPressed?1:0)-(k.aKey.isPressed?1:0),z=(k.wKey.isPressed?1:0)-(k.sKey.isPressed?1:0),y=(k.eKey.isPressed?1:0)-(k.qKey.isPressed?1:0);transform.position+=(transform.right*x+transform.forward*z+Vector3.up*y)*Time.unscaledDeltaTime*(k.leftShiftKey.isPressed?18:7);if(m!=null&&m.rightButton.isPressed){var delta=m.delta.ReadValue();var a=transform.eulerAngles;transform.rotation=Quaternion.Euler(a.x-delta.y*.12f,a.y+delta.x*.12f,0);}}
    void OnGUI(){GUI.Box(new Rect(16,16,580,62),"THE LAST CROSSING · modular pipeline proof\nWASD + Q/E fly · hold right mouse to look · Shift faster · R reset\nBlockout only: no siege simulation or collision-constrained player yet");}
}
