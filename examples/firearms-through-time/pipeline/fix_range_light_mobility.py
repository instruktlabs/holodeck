"""Use a dynamic key light for the mutable qualification scenes, with backups."""
from pathlib import Path
import hashlib,json,shutil
import unreal
R=Path(__file__).resolve().parents[1];C=R/'native/ToolchainValidation/Content';E=R/'evidence'
L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem);S=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
rows={}
for level in ['RangeSliceLab','WeaponLab']:
    assert L.load_level('/Game/Qualification/'+level)
    lights=[a for a in S.get_all_level_actors() if isinstance(a,unreal.Light)]
    before=[{'name':a.get_name(),'class':a.get_class().get_name(),'mobility':str(a.light_component.mobility),'intensity':float(a.light_component.intensity)} for a in lights]
    (E/('range-v7-light-audit-'+level+'.json')).write_text(json.dumps(before,indent=2))
    directional=[a for a in lights if isinstance(a,unreal.DirectionalLight)]
    assert len(directional)==1
    a=directional[0];c=a.light_component
    assert c.mobility in [unreal.ComponentMobility.STATIONARY,unreal.ComponentMobility.STATIC]
    p=C/'Qualification'/(level+'.umap');backup=E/'range-v7-before-light-mobility-fix'/(level+'.umap')
    backup.parent.mkdir(parents=True,exist_ok=True)
    assert not backup.exists(),'Inspect existing fix receipt before retrying'
    shutil.copy2(p,backup)
    intensity=float(c.intensity);color=list(c.get_light_color().to_tuple());pos=list(a.get_actor_location().to_tuple());rot=a.get_actor_rotation();angles=[float(rot.pitch),float(rot.yaw),float(rot.roll)]
    c.set_mobility(unreal.ComponentMobility.MOVABLE)
    assert float(c.intensity)==intensity and list(c.get_light_color().to_tuple())==color and list(a.get_actor_location().to_tuple())==pos
    q=a.get_actor_rotation();assert [float(q.pitch),float(q.yaw),float(q.roll)]==angles
    assert L.save_current_level()
    rows[level]={'before':before,'directionalMobilityAfter':str(c.mobility),'intensityColorAndTransformPreserved':True,'backup':str(backup),'mapSha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(E/'range-v7-light-mobility-fix.json').write_text(json.dumps({'ok':True,'maps':rows},indent=2))
unreal.log('RANGE_LIGHT_MOBILITY_FIX_PASS')
