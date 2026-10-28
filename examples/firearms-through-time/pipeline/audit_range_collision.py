"""Read back environment collision; no mutation."""
from pathlib import Path
import json
import unreal
R=Path(__file__).resolve().parents[1]
L=unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
S=unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
rows={}
for level in ['RangeSliceLab','WeaponLab']:
    assert L.load_level('/Game/Qualification/'+level)
    rows[level]=[]
    for a in S.get_all_level_actors():
        if not isinstance(a,unreal.StaticMeshActor): continue
        c=a.static_mesh_component
        rows[level].append(dict(name=a.get_name(),label=a.get_actor_label(),mesh=c.static_mesh.get_path_name() if c.static_mesh else None,location=list(a.get_actor_location().to_tuple()),scale=list(a.get_actor_scale3d().to_tuple()),collision=str(c.get_collision_enabled()),profile=str(c.get_collision_profile_name()),pawnResponse=str(c.get_collision_response_to_channel(unreal.CollisionChannel.ECC_PAWN)),actorCollision=a.get_actor_enable_collision()))
(R/'evidence/range-v7-environment-collision-audit.json').write_text(json.dumps(rows,indent=2))
unreal.log('RANGE_ENVIRONMENT_AUDIT_DONE')
