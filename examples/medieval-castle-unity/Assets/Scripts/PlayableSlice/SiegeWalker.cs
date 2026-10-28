using UnityEngine;
using UnityEngine.InputSystem;

namespace LastCrossing.Playable
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class SiegeWalker : MonoBehaviour
    {
        public Camera view;
        public bool controlledExternally, mounted;
        public float walkSpeed=3.3f, sprintSpeed=5.2f;
        CharacterController body;
        float yaw,pitch,vertical;
        public bool Grounded { get { return body!=null && body.isGrounded; } }
        void Awake(){body=GetComponent<CharacterController>();body.height=1.8f;body.radius=.28f;body.center=new Vector3(0,.9f,0);body.stepOffset=.35f;body.slopeLimit=48;body.skinWidth=.035f;}
        public void Place(Vector3 position,Quaternion facing)
        {
            body.enabled=false;transform.SetPositionAndRotation(position,facing);body.enabled=true;
            yaw=facing.eulerAngles.y;pitch=0;vertical=0;
            if(view!=null){view.transform.SetParent(transform,false);view.transform.localPosition=new Vector3(0,1.62f,0);view.transform.localRotation=Quaternion.identity;}
        }
        public void SetLook(Quaternion facing){yaw=facing.eulerAngles.y;pitch=Mathf.DeltaAngle(0,facing.eulerAngles.x);}
        public void Look(Vector2 delta)
        {
            yaw+=delta.x*.10f;pitch=Mathf.Clamp(pitch-delta.y*.10f,-75,75);
            if(mounted)view.transform.rotation=Quaternion.Euler(pitch,yaw,0);
            else {transform.rotation=Quaternion.Euler(0,yaw,0);view.transform.localRotation=Quaternion.Euler(pitch,0,0);}
        }
        void Update()
        {
            if(controlledExternally||mounted)return;
            var k=Keyboard.current;var m=Mouse.current;
            if(Cursor.lockState==CursorLockMode.Locked && m!=null)Look(m.delta.ReadValue());
            Vector2 input=k==null||Cursor.lockState!=CursorLockMode.Locked?Vector2.zero:new Vector2((k.dKey.isPressed?1:0)-(k.aKey.isPressed?1:0),(k.wKey.isPressed?1:0)-(k.sKey.isPressed?1:0));
            var velocity=transform.TransformDirection(new Vector3(input.x,0,input.y).normalized)*(k!=null&&k.leftShiftKey.isPressed?sprintSpeed:walkSpeed);
            Move(velocity,Time.deltaTime);
        }
        public void Move(Vector3 horizontalVelocity,float dt)
        {
            if(!body.enabled)return;
            if(body.isGrounded && vertical<0)vertical=-2;
            vertical=Mathf.Max(-25,vertical-20*dt);
            body.Move((horizontalVelocity+Vector3.up*vertical)*dt);
        }
        public void WalkToward(Vector3 target,float dt)
        {
            Vector3 d=target-transform.position;d.y=0;
            if(d.sqrMagnitude>.01f){transform.rotation=Quaternion.LookRotation(d);yaw=transform.eulerAngles.y;}
            Move(d.magnitude<.15f?Vector3.zero:d.normalized*walkSpeed,dt);
        }
    }
}
