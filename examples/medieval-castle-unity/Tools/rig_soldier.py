"""Blender batch adapter: canonical Kiln GLB -> weighted rig, clips, FBX/GLB.
This is a versioned delivery derivative; never overwrites the Kiln source.
"""
import argparse, hashlib, json, math, pathlib, sys
import bpy
from mathutils import Vector, Quaternion, Matrix

argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ap=argparse.ArgumentParser();ap.add_argument('--input',required=True);ap.add_argument('--manifest',required=True);ap.add_argument('--out',required=True);ap.add_argument('--render',action='store_true');args=ap.parse_args(argv)
out=pathlib.Path(args.out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(pathlib.Path(args.input).resolve()))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
if not meshes: raise RuntimeError('No imported meshes')
# glTF +Y up -> Blender +Z up, using the same basis as Blender's importer.
def P(v):return Vector((v[0],-v[2],v[1]))
j={'Root':[0,0,0],'Hips':[0,.94,0],'Spine':[0,1.10,0],'Chest':[0,1.32,0],'Neck':[0,1.48,0],'Head':[0,1.61,0]}
for side,s in [('L',1),('R',-1)]:
    for key,p in {'Shoulder':[0,1.39,.19*s],'UpperArm':[0,1.39,.19*s],'Forearm':[0,1.16,.36*s],'Hand':[0,.94,.52*s],'UpperLeg':[0,.91,.10*s],'LowerLeg':[.02,.51,.10*s],'Foot':[0,.12,.10*s],'Toes':[.15,.05,.10*s]}.items():j[key+'.'+side]=p
manifest=json.loads(pathlib.Path(args.manifest).read_text());landmarks=manifest['joints']
for key in ['Root','Hips','Spine','Chest','Neck','Head']:j[key]=landmarks[key.lower()]
for side,prefix in [('L','left'),('R','right')]:
    for key,source in [('Shoulder','Shoulder'),('UpperArm','Shoulder'),('Forearm','Elbow'),('Hand','Wrist'),('UpperLeg','Hip'),('LowerLeg','Knee'),('Foot','Ankle'),('Toes','Toe')]:j[key+'.'+side]=landmarks[prefix+source]
# Bone heads and tails are explicit authored anatomical landmarks in metres.
defs=[('Root',j['Root'],[0,.15,0],None),('Hips',j['Hips'],j['Spine'],'Root'),('Spine',j['Spine'],j['Chest'],'Hips'),('Chest',j['Chest'],j['Neck'],'Spine'),('Neck',j['Neck'],j['Head'],'Chest'),('Head',j['Head'],[0,1.78,0],'Neck')]
for side,s in [('L',1),('R',-1)]:
    defs.extend([('Shoulder.'+side,[0,1.38,.06*s],j['UpperArm.'+side],'Chest'),('UpperArm.'+side,j['UpperArm.'+side],j['Forearm.'+side],'Shoulder.'+side),('Forearm.'+side,j['Forearm.'+side],j['Hand.'+side],'UpperArm.'+side),('Hand.'+side,j['Hand.'+side],[.015,.82,.595*s],'Forearm.'+side),('UpperLeg.'+side,j['UpperLeg.'+side],j['LowerLeg.'+side],'Hips'),('LowerLeg.'+side,j['LowerLeg.'+side],j['Foot.'+side],'UpperLeg.'+side),('Foot.'+side,j['Foot.'+side],j['Toes.'+side],'LowerLeg.'+side),('Toes.'+side,j['Toes.'+side],[.22,.05,.10*s],'Foot.'+side)])
arm_data=bpy.data.armatures.new('GarrisonSkeleton');arm=bpy.data.objects.new('GarrisonRig',arm_data);bpy.context.collection.objects.link(arm);bpy.context.view_layer.objects.active=arm;arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in defs:
    b=arm_data.edit_bones.new(name);b.head=P(head);b.tail=P(tail)
    if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
segments={name:(P(head),P(tail)) for name,head,tail,_ in defs}
def distance(p,a,b):
    v=b-a;t=max(0,min(1,(p-a).dot(v)/v.length_squared));return (p-(a+t*v)).length
def weights(name,p):
    # Work in imported Blender world coordinates, convert only for region decisions.
    y=p.z;z=-p.y;side='L' if z>=0 else 'R'
    if 'Helmet' in name or 'Eyelid' in name:return {'Head':1}
    if 'Head' in name:
        t=max(0,min(1,(y-1.48)/.07));return {'Head':t,'Neck':1-t}
    if 'Glove' in name:return {'Hand.'+side:1}
    if 'Belt' in name:return {'Hips':1}
    if 'Collar' in name:return {'Neck':.3,'Chest':.7}
    if 'Skirt' in name:
        t=max(0,min(.75,(1.01-y)/.38));return {'Hips':1-t,'UpperLeg.'+side:t}
    if 'Boot' in name:
        t=max(0,min(1,(y-.12)/.12));return {'Foot.'+side:1-t,'LowerLeg.'+side:t}
    if 'Leg' in name:
        t=max(0,min(1,(y-.44)/.14));return {'UpperLeg.'+side:t,'LowerLeg.'+side:1-t}
    # Ring parameters provide continuous weights; distance-only region switching
    # caused an armpit spike in the first smoke test. Do not reintroduce a hard seam.
    def smooth(a,b,v):
        t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
    az=abs(z)
    if az>=.28:
        elbow=smooth(.33,.405,az);w={'UpperArm.'+side:1-elbow,'Forearm.'+side:elbow}
        wrist=smooth(.49,.54,az);w={n:v*(1-wrist) for n,v in w.items()};w['Hand.'+side]=wrist;return w
    chest=smooth(1.06,1.30,y);hips=1-smooth(.96,1.12,y)
    base={'Hips':hips,'Spine':(1-hips)*(1-chest),'Chest':(1-hips)*chest}
    shoulder=smooth(.16,.28,az)
    base={n:v*(1-shoulder) for n,v in base.items()};base['UpperArm.'+side]=shoulder
    return base

materials=[]
for mat in {m for o in meshes for m in o.data.materials if m}:
    node=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if mat.use_nodes else None
    color=list(node.inputs['Base Color'].default_value) if node else list(mat.diffuse_color)
    metallic=float(node.inputs['Metallic'].default_value) if node else mat.metallic
    roughness=float(node.inputs['Roughness'].default_value) if node else mat.roughness
    mat.diffuse_color=color;materials.append({'name':mat.name,'baseColor':color,'metallic':metallic,'roughness':roughness})
for o in meshes:
    # Bake imported object hierarchy into mesh coordinates before armature parenting.
    o.data.transform(o.matrix_world.copy());o.parent=None;o.matrix_world=Matrix.Identity(4)
    groups={n:o.vertex_groups.new(name=n) for n in segments}
    for v in o.data.vertices:
        w=weights(o.name,v.co);total=sum(w.values())
        for n,value in w.items():
            if value>0:groups[n].add([v.index],value/total,'REPLACE')
    o.parent=arm;modifier=o.modifiers.new('Garrison Skin','ARMATURE');modifier.object=arm;modifier.use_deform_preserve_volume=False
    for poly in o.data.polygons:poly.use_smooth=True
# Consolidate draw hierarchy; material slots remain explicit, no hidden atlas conversion.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();body=bpy.context.object;body.name='GarrisonBody'
bad=[];max_influences=0
for v in body.data.vertices:
    ws=[g.weight for g in v.groups if g.weight>0];max_influences=max(max_influences,len(ws))
    if not ws or abs(sum(ws)-1)>.0001 or len(ws)>4:bad.append(v.index)
if bad:raise RuntimeError('Invalid weights: '+str(bad[:12]))
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=61
def rotate(name,axis,angle):
    b=arm.pose.bones[name];local=arm.data.bones[name].matrix_local.to_3x3().inverted()@Vector(axis);b.rotation_quaternion=Quaternion(local,angle)
def pose(kind,phase):
    for b in arm.pose.bones:b.rotation_mode='QUATERNION';b.rotation_quaternion=Quaternion();b.location=(0,0,0)
    wave=math.sin(phase*2*math.pi)
    if kind=='Idle':
        rotate('Chest',(0,1,0),.012*wave);rotate('Head',(0,0,1),.04*wave)
    elif kind=='Walk':
        for side,s in [('L',1),('R',-1)]:
            swing=s*wave
            rotate('UpperLeg.'+side,(0,1,0),-.36*swing)
            rotate('LowerLeg.'+side,(0,1,0),.55*max(0,-swing))
            rotate('Foot.'+side,(0,1,0),-.18*max(0,-swing))
            rotate('UpperArm.'+side,(0,1,0),.24*swing)
            rotate('Forearm.'+side,(0,1,0),-.12)
        arm.pose.bones['Hips'].location=(0,0,.012*(1-math.cos(phase*4*math.pi)))
    elif kind=='Aim':
        # Pose study only; grip IK is a later runtime constraint on this same skeleton.
        for side,s in [('L',1),('R',-1)]:
            rotate('UpperArm.'+side,(0,1,0),-.9)
            rotate('Forearm.'+side,(0,1,0),-.65+.015*wave)
        rotate('Chest',(0,0,1),.04*wave)
    elif kind=='Stress':
        rotate('UpperArm.L',(1,0,0),-1.35);rotate('Forearm.L',(0,1,0),-1.6)
        rotate('UpperLeg.R',(0,1,0),-1.1);rotate('LowerLeg.R',(0,1,0),1.6);rotate('Head',(0,0,1),.6)
actions=[]
for kind in ['Idle','Walk','Aim']:
    arm.animation_data_create();action=bpy.data.actions.new(kind);arm.animation_data.action=action
    for frame in range(1,62):
        pose(kind,(frame-1)/60)
        for b in arm.pose.bones:b.keyframe_insert('rotation_quaternion',frame=frame);b.keyframe_insert('location',frame=frame)
    action.use_fake_user=True;actions.append(action)
arm.animation_data.action=None;pose('Idle',0);scene.frame_set(1)
audit={'blender':bpy.app.version_string,'sourceSha256':hashlib.sha256(pathlib.Path(args.input).read_bytes()).hexdigest(),'restJointsGltf':j,'bones':len(arm.data.bones),'vertices':len(body.data.vertices),'triangles':sum(len(p.vertices)-2 for p in body.data.polygons),'materialSlots':len(body.data.materials),'maxInfluences':max_influences,'unweightedOrBadVertices':len(bad),'clips':['Idle','Walk','Aim'],'deformationSamples':[],'limitations':['Procedural baked motion studies, not authored combat animation','No grip IK or foot locking yet','CPU geometry review is not PBR approval']}
# Sample evaluated deformed bounds and finite coordinates in both motion and stress poses.
for kind,phase in [('Idle',0),('Walk',.25),('Walk',.75),('Aim',.25),('Stress',0)]:
    pose(kind,phase);bpy.context.view_layer.update();evaluated=body.evaluated_get(bpy.context.evaluated_depsgraph_get());mesh=evaluated.to_mesh();verts=[v.co.copy() for v in mesh.vertices]
    if any(not math.isfinite(c) for v in verts for c in v):raise RuntimeError('Nonfinite deformation')
    audit['deformationSamples'].append({'pose':kind,'phase':phase,'min':[min(v[k] for v in verts) for k in range(3)],'max':[max(v[k] for v in verts) for k in range(3)]});evaluated.to_mesh_clear()
pose('Idle',0);arm.animation_data.action=actions[0];scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);arm.select_set(True);bpy.context.view_layer.objects.active=arm
bpy.ops.wm.save_as_mainfile(filepath=str((out/'Garrison.blend').resolve()))
bpy.ops.export_scene.fbx(filepath=str((out/'Garrison.fbx').resolve()),use_selection=True,object_types={'ARMATURE','MESH'},add_leaf_bones=False,bake_anim=True,bake_anim_use_all_actions=True,bake_anim_use_nla_strips=False,bake_anim_simplify_factor=0,axis_forward='-Z',axis_up='Y',apply_unit_scale=True,use_armature_deform_only=True)
bpy.ops.export_scene.gltf(filepath=str((out/'Garrison-rigged.glb').resolve()),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='ACTIONS',export_skins=True)
for filename in ['Garrison.fbx','Garrison-rigged.glb','Garrison.blend']:audit[filename+'Sha256']=hashlib.sha256((out/filename).read_bytes()).hexdigest()
(out/'material-manifest.json').write_text(json.dumps({'materials':materials},indent=2))
(out/'rig-audit.json').write_text(json.dumps(audit,indent=2))
if args.render:
    scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.background_type='WORLD';scene.world.color=(.16,.18,.20)
    scene.render.resolution_x=768;scene.render.resolution_y=768;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
    cam_data=bpy.data.cameras.new('RigReview');cam=bpy.data.objects.new('RigReview',cam_data);bpy.context.collection.objects.link(cam);scene.camera=cam
    cam.location=(3.3,-3.0,2);target=Vector((0,0,.95));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam_data.type='ORTHO';cam_data.ortho_scale=2.25
    arm.animation_data.action=None
    for kind,phase in [('Idle',0),('Walk',.25),('Walk',.75),('Aim',.25),('Stress',0)]:
        pose(kind,phase);bpy.context.view_layer.update();scene.render.filepath=str((out/(kind+'-'+str(phase)+'.png')).resolve());bpy.ops.render.render(write_still=True)
print('SOLDIER_RIG_COMPLETE',json.dumps(audit))
