// Derive a profile's first-person view from the delivered sight anchors and the owner-approved sight policy.
// The eye (anchor_eye, or eyeDistance behind the rear sight along the sight line) becomes the aim camera origin.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^﻿/,''));
const [profile,pinsFile,out]=process.argv.slice(2);assert(profile&&pinsFile&&out,'usage: derive-sight-view.mjs <profile> <gun pins> <out view json>');
const policy=(await read('game/sight-policy-v1.json')).profiles[profile];assert(policy,'No sight policy for '+profile);
const pins=await read(pinsFile),anchors=Object.fromEntries((pins.anchorsAndPivots??[]).map(a=>[a.name,a.worldMatrix.slice(12,15)]));
const rear=anchors.anchor_sight_rear,front=anchors.anchor_sight_front;assert(rear&&front,'Sight anchors missing');
const len=Math.hypot(...front.map((v,i)=>v-rear[i])),axis=front.map((v,i)=>(v-rear[i])/len);
const base=anchors.anchor_eye??rear.map((v,i)=>v-axis[i]*policy.eyeDistance),eye=base.map((v,i)=>i===1?v+(policy.eyeLift??0):v),eyeDistance=Math.hypot(...rear.map((v,i)=>v-eye[i]));
// eyeLift is a labelled presentation offset (Pattern 1742: head kept up, so the stud shows over the breech); the pitch then follows eye->front.
// Asset +X turns to camera -Z (rotation +90° about Y): (x,y,z) -> (z,y,-x). The eye maps to the camera origin.
// aimPitch turns the gun about the eye so a sloped sight line lies on the view axis; level lines give 0.
const round=v=>Math.round(v*1e7)/1e7,aimPosition=[-eye[2],-eye[1],eye[0]].map(round);
const pitch=round(-Math.atan2(front[1]-eye[1],front[0]-eye[0]));
const view={schemaVersion:2,profile,space:'camera-local metres, +X right, +Y up, -Z forward',
 hipPosition:policy.hipPosition,aimPosition,assetForwardRotationY:Math.PI/2,...(pitch?{aimPitch:pitch}:{}),...(policy.eyeLift?{eyeLift:policy.eyeLift}:{}),recoilBack:policy.recoilBack,recoilPitch:policy.recoilPitch,
 eye:{position:eye.map(round),distanceToRear:round(eyeDistance),source:anchors.anchor_eye?'anchor_eye':'policy eyeDistance behind anchor_sight_rear'},
 sightLine:{rear,front,radius:round(len),slopeRadians:round(Math.atan2(front[1]-rear[1],front[0]-rear[0]))},
 aimFovDeg:policy.aimFovDeg,aimNear:policy.aimNear,ghostRing:policy.ghostRing,frontSight:policy.frontSight,
 gun:{assetId:pins.assetId,revisionId:pins.revisionId,pins:pinsFile},
 scope:'Owner-approved sight presentation (docs/sight-research-v1.md section 8). Eye distance, aim FOV and pupil are Targets; the ghost ring is an analytic aperture vignette and targets stay sharp.'};
await writeFile(out,JSON.stringify(view,null,2)+'\n');console.log(JSON.stringify({out,aimPosition,eyeDistance:view.eye.distanceToRear,radius:view.sightLine.radius}));
