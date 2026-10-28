"""Repair the qualified studio backdrop only; preserve appearance and overrides."""
from pathlib import Path
import hashlib,json,shutil
import unreal
R=Path(__file__).resolve().parents[1];C=R/'native/ToolchainValidation/Content';E=R/'evidence'
L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);S=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
rows={}
for level in ['RangeSliceLab','WeaponLab']:
    p=C/'Qualification'/(level+'.umap');backup=E/'range-v7-before-sky-collision-fix'/(level+'.umap')
    assert L.load_level('/Game/Qualification/'+level)
    matches=[a for a in S.get_all_level_actors() if isinstance(a,unreal.StaticMeshActor) and a.static_mesh_component.static_mesh and a.static_mesh_component.static_mesh.get_path_name()=='/Engine/BasicShapes/Sphere.Sphere' and list(a.get_actor_scale3d().to_tuple())==[1000,1000,1000]]
    assert len(matches)==1
    a=matches[0];c=a.static_mesh_component
    assert c.get_material(0).get_path_name()=='/Game/Qualification/TransportCaseStudio/M_StudioSky.M_StudioSky'
    def appearance_of(a,c):
        q=a.get_actor_rotation()
        return (list(a.get_actor_location().to_tuple()),list(a.get_actor_scale3d().to_tuple()),[float(q.pitch),float(q.yaw),float(q.roll)],c.get_material(0).get_path_name())
    appearance=appearance_of(a,c)
    backup.parent.mkdir(parents=True,exist_ok=True)
    if backup.exists(): assert backup.read_bytes()==p.read_bytes(),'Source changed since backup; stop and review'
    else: shutil.copy2(p,backup)
    before=hashlib.sha256(p.read_bytes()).hexdigest()
    c.set_collision_profile_name('NoCollision');c.set_collision_enabled(unreal.CollisionEnabled.NO_COLLISION);a.set_actor_enable_collision(False)
    assert appearance_of(a,c)==appearance
    assert L.save_current_level()
    rows[level]={'beforeSha256':before,'afterSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'backup':str(backup),'actor':a.get_name(),'profile':str(c.get_collision_profile_name()),'collision':str(c.get_collision_enabled()),'actorCollision':a.get_actor_enable_collision(),'appearancePreserved':True}
(E/'range-v7-sky-collision-fix.json').write_text(json.dumps({'ok':True,'maps':rows},indent=2))
unreal.log('RANGE_SKY_COLLISION_FIX_PASS')
