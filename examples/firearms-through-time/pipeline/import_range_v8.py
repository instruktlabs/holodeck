"""Import retrieval v8 candidates; run only in the parent's serialized Unreal session.

Normal: pipeline/run-unreal-script.ps1 -Script pipeline/import_range_v8.py -Label range-v8-import
Readback only: set RANGE_V8_VERIFY_ONLY=1 and run the same command in a fresh process.
An interrupted attempt requires checkpoint inspection and explicit RANGE_V8_RESUME=1.
No automatic rollback or deletion of imported namespaces is performed.
"""
from pathlib import Path
import copy, hashlib, json, os, shutil, traceback
import unreal

R = Path(__file__).resolve().parents[1]
E = R / 'evidence'
C = R / 'native/ToolchainValidation/Content'
manifest_path = E / 'range-v8-manifest.json'
M = json.loads(manifest_path.read_text(encoding='utf-8-sig'))
A = unreal.get_editor_subsystem(unreal.EditorAssetSubsystem)
L = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
S = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
checkpoint = E / 'range-v8-native-checkpoint.json'
backup = E / 'range-v8-native-before'

def digest(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def put(name, value):
    dest = E / name
    temp = dest.with_suffix(dest.suffix + '.tmp')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    temp.replace(dest)
def vec(v): return unreal.Vector(v[0] * 100, v[2] * 100, v[1] * 100)
def tup(v): return list(v.to_tuple())
def near(a, b, tolerance=.08): return len(a) == len(b) and all(abs(x-y) <= tolerance for x,y in zip(a,b))
def path(obj): return obj.get_path_name() if obj else None
def tags(actor): return [str(t) for t in actor.tags]
def comps(actor): return {c.get_name(): c for c in actor.get_components_by_class(unreal.SceneComponent)}
def tagged(tag):
    found = [a for a in S.get_all_level_actors() if tag in tags(a)]
    assert len(found) == 1, (tag, len(found))
    return found[0]
def oldfiles():
    return {str(p.relative_to(C)): digest(p) for folder in ['RangeSliceOverrides','WeaponOverrides']
            for p in (C/'Qualification'/folder).rglob('*') if p.is_file()}
def component_snapshot(c):
    value = {'class': c.get_class().get_name(), 'parent': path(c.get_attach_parent()),
             'relativeLocation': tup(c.relative_location), 'relativeRotation': tup(c.relative_rotation),
             'relativeScale': tup(c.relative_scale3d), 'worldLocation': tup(c.get_world_location()),
             'mobility': str(c.mobility)}
    if isinstance(c, unreal.PrimitiveComponent):
        value.update(collisionProfile=str(c.get_collision_profile_name()), collisionEnabled=str(c.get_collision_enabled()))
    if isinstance(c, unreal.StaticMeshComponent):
        value.update(mesh=path(c.static_mesh), materials=[path(c.get_material(i)) for i in range(c.get_num_materials())],
                     overrides=[path(m) for m in c.get_editor_property('override_materials')])
    if isinstance(c, unreal.BoxComponent): value['extent'] = tup(c.get_unscaled_box_extent())
    return value
def snapshot(include_rail=False):
    result = {}
    for actor in S.get_all_level_actors():
        if not include_rail and 'RangeRetrievalV1' in tags(actor): continue
        result[path(actor)] = {'class': actor.get_class().get_name(), 'tags': tags(actor),
            'location': tup(actor.get_actor_location()), 'rotation': tup(actor.get_actor_rotation()),
            'scale': tup(actor.get_actor_scale3d()), 'collision': actor.get_actor_enable_collision(),
            'components': {name: component_snapshot(c) for name,c in comps(actor).items()}}
    return result
def counts(actor, meshes, boxes):
    assert len(actor.get_components_by_class(unreal.StaticMeshComponent)) == meshes
    assert len(actor.get_components_by_class(unreal.BoxComponent)) == boxes
def mapfile(mapname): return C / (mapname.removeprefix('/Game/') + '.umap')
def validate_imports(result):
    for row in M['assets']:
        assert set(result['imports'][row['id']]['meshes']) == {p['key'] for p in row['meshes']}
        for p in row['meshes']:
            mesh = unreal.load_asset(result['imports'][row['id']]['meshes'][p['key']]['path'])
            assert isinstance(mesh,unreal.StaticMesh)
            bounds = mesh.get_bounding_box()
            assert near(tup(bounds.min),p['nativeMin']) and near(tup(bounds.max),p['nativeMax']), ('Readback native bounds',row['id'],p['key'])
def validate_boxes(actor, obj):
    cc = comps(actor); prefix = obj['id'].replace('-', '_') + '_'
    col = obj['collider']; boxes = col['boxes'] if col['type']=='compound' else [col]
    for i,b in enumerate(boxes):
        c = cc[prefix+'block_'+str(i)]
        assert isinstance(c,unreal.BoxComponent) and c.get_attach_parent()==actor.root_component
        assert near(tup(c.relative_location),tup(vec([a+b for a,b in zip(obj['position'],b['offset'])])))
        assert near(tup(c.get_unscaled_box_extent()),tup(vec([x/2 for x in b['size']])))
def validate_hierarchy(actor, row, obj, imported):
    cc = comps(actor); prefix = obj['id'].replace('-', '_') + '_'
    placement = cc[prefix+'placement']
    assert placement.get_attach_parent() == actor.root_component
    assert near(tup(placement.relative_location), tup(vec(obj['position'])))
    for n in row['nodes']:
        c = cc[prefix+n['key']]
        assert c.get_attach_parent() == (cc[prefix+n['parent']] if n['parent'] else placement)
        assert near(tup(c.relative_location), tup(vec(n['localPosition'])))
        assert near(tup(c.get_world_location()), tup(vec([a+b for a,b in zip(obj['position'],n['position'])])))
    for p in row['meshes']:
        c = cc[prefix+p['key']]
        assert c.get_attach_parent() == (cc[prefix+p['parent']] if p['parent'] else placement)
        assert near(tup(c.relative_location), tup(vec([-v for v in p['parentPosition']])))
        assert near(tup(c.get_world_location()), tup(vec(obj['position'])))
        if imported is not None: assert path(c.static_mesh) == imported[p['key']]['path']
def verify_map(mapname, result):
    assert L.load_level(mapname)
    old = tagged('RangeExpansionV7'); rail = tagged('RangeRetrievalV1')
    counts(old,80,37); counts(rail,3,5)
    assert snapshot() == result['maps'][mapname]['after'], ('Saved original actor/component preservation',mapname)
    assert snapshot(True)[path(rail)] == result['maps'][mapname]['rail'], ('Saved rail preservation',mapname)
    for kind,actor,obj in [('target-paper',old,M['paper']),('paper-travel-rail',rail,M['rail'])]:
        validate_hierarchy(actor, rows[kind], obj, result['imports'][kind]['meshes'])
        validate_boxes(actor,obj)
    assert len(comps(rail)) == 2+len(rows['paper-travel-rail']['nodes'])+3+5
    validate_imports(result)
    assert oldfiles() == result['oldFiles']

assert Path(unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())).resolve() == (R/'native/ToolchainValidation').resolve()
assert not unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages(), 'Run with saved maps in a serialized session'
assert set(a['id'] for a in M['assets']) == {'target-paper','paper-travel-rail'}
assert len(M['maps']) == 2 and len(set(M['maps'])) == 2
rows = {a['id']:a for a in M['assets']}
assert len(rows['target-paper']['meshes']) == 9 and len(rows['paper-travel-rail']['meshes']) == 3
assert M['paper']['collider']['type'] == 'box' and len(M['rail']['collider']['boxes']) == 5
for obj in [M['paper'],M['rail']]:
    assert obj['rotation'] == [0,0,0] and obj['scale'] == [1,1,1], 'Adapter supports the pinned translation-only placements'
for row in rows.values():
    assert row['nativeDestination'] == '/Game/Qualification/RangeV8Generated/'+row['id']
    assert 'sha256:'+digest(R/row['nativeFile']) == row['nativeHash']
    assert 'sha256:'+digest(R/row['glb']) == row['sha256']
    assert len(set(p['key'] for p in row['meshes'])) == len(row['meshes'])

if os.environ.get('RANGE_V8_VERIFY_ONLY') == '1':
    result = json.loads((E/'range-v8-native-result.json').read_text())
    assert result['ok'] and result['manifestHash'] == digest(manifest_path)
    before = {name:digest(mapfile(name)) for name in M['maps']}
    for name in M['maps']: verify_map(name,result)
    assert before == {name:digest(mapfile(name)) for name in M['maps']}
    put('range-v8-native-fresh-proof.json', {'ok':True,'maps':before,'nativeOverrideBytesPreserved':True,
        'checks':['all original actor/component snapshots with bounded paper changes','80 original meshes and 37 original boxes',
                  '3 new rail meshes and 5 new boxes','paper and rail hierarchy and baked compensation','map bytes unchanged'],
        'runtimeTested':False})
    unreal.log('RANGE_V8_FRESH_PASS')
else:
    resume = os.environ.get('RANGE_V8_RESUME') == '1'
    if resume:
        assert checkpoint.exists() and backup.exists(), 'No resumable checkpoint and backup'
        result = json.loads(checkpoint.read_text())
        assert not result['ok'] and result['manifestHash'] == digest(manifest_path)
        assert oldfiles() == result['oldFiles']; result.pop('error',None)
    else:
        assert not checkpoint.exists() and not backup.exists(), 'Prior attempt exists: inspect before explicitly resuming'
        assert not A.does_directory_exist('/Game/Qualification/RangeV8Generated'), 'Existing unrecorded destination'
        result = {'ok':False,'phase':'begin','manifestHash':digest(manifest_path),'oldFiles':oldfiles(),'imports':{},'maps':{}}
        backup.mkdir(); put(checkpoint.name,result)
    try:
        # Back up and inspect BOTH maps before imports or any level mutation.
        for mapname in M['maps']:
            assert L.load_level(mapname)
            old = tagged('RangeExpansionV7'); counts(old,80,37)
            previous = result['maps'].get(mapname)
            if previous and previous.get('saved'):
                verify_map(mapname,result); continue
            assert not any('RangeRetrievalV1' in tags(a) for a in S.get_all_level_actors())
            validate_hierarchy(old,rows['target-paper'],M['paper'],None)
            src = mapfile(mapname); dst = backup/src.relative_to(C)
            if previous:
                assert digest(src) == previous['beforeHash'] == digest(dst)
                assert snapshot() == previous['before']
            else:
                assert not dst.exists(), 'Unrecorded backup: inspect interrupted attempt'
                dst.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(src,dst)
                assert digest(src) == digest(dst)
                # These non-partitioned test maps must not depend on omitted external actor packages.
                for external in ['__ExternalActors__','__ExternalObjects__']:
                    assert not (C/external/src.relative_to(C).with_suffix('')).exists(), 'External map packages need a complete backup plan'
                companions = {}
                for suffix in ['.uexp','.ubulk','_BuiltData.uasset']:
                    p = src.with_name(src.stem+suffix)
                    if p.exists():
                        d = backup/p.relative_to(C); shutil.copy2(p,d); assert digest(p)==digest(d)
                        companions[str(p.relative_to(C))] = digest(p)
                result['maps'][mapname] = {'before':snapshot(),'beforeHash':digest(src),'companions':companions}
            result['phase']='backed-up-'+mapname; put(checkpoint.name,result)
        pipeline = unreal.load_asset('/Interchange/Pipelines/DefaultGLTFAssetsPipeline')
        pipeline.reimport_strategy = unreal.ReimportStrategyFlags.APPLY_PIPELINE_PROPERTIES
        pipeline.material_pipeline.reuse_existing_materials = False
        stack = unreal.InterchangePipelineStackOverride(); stack.add_pipeline(pipeline)
        stack.add_pipeline(unreal.load_asset('/Interchange/Pipelines/DefaultGLTFPipeline'))
        for row in M['assets']:
            if row['id'] not in result['imports']:
                assert not A.does_directory_exist(row['nativeDestination']), 'Unrecorded namespace requires inspection'
                task=unreal.AssetImportTask(); task.filename=str(R/row['nativeFile']); task.destination_path=row['nativeDestination']
                task.options=stack; task.automated=True; task.replace_existing=False; task.save=True; task.async_=False
                unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
            loaded=[unreal.load_asset(p) for p in A.list_assets(row['nativeDestination'],recursive=True,include_folder=False)]
            meshes={m.get_name():m for m in loaded if isinstance(m,unreal.StaticMesh)}
            # No textures are expected in either exact candidate. Do not modify unrelated imported resources.
            assert not any(isinstance(x,unreal.Texture2D) for x in loaded)
            result['imports'][row['id']]={'meshes':{n:{'path':path(m),'min':tup(m.get_bounding_box().min),
                'max':tup(m.get_bounding_box().max)} for n,m in meshes.items()},'nativeHash':row['nativeHash']}
            result['phase']='imported-'+row['id']; put(checkpoint.name,result)
            assert set(meshes)=={p['key'] for p in row['meshes']}, ('Importer names differ',row['id'],list(meshes))
            for p in row['meshes']:
                b=meshes[p['key']].get_bounding_box()
                assert near(tup(b.min),p['nativeMin']) and near(tup(b.max),p['nativeMax']), ('Baked native frame differs',row['id'],p['key'])
        for mapname in M['maps']:
            if result['maps'][mapname].get('saved'): continue
            assert L.load_level(mapname); record=result['maps'][mapname]
            assert snapshot()==record['before']
            old=tagged('RangeExpansionV7'); cc=comps(old); prefix='paper_carrier_'
            expected=copy.deepcopy(record['before']); expected_parts=expected[path(old)]['components']
            paper_materials={}
            for p in rows['target-paper']['meshes']:
                name=prefix+p['key']; component=cc[name]
                materials=[component.get_material(i) for i in range(component.get_num_materials())]
                paper_materials[name]=[path(m) for m in materials]
                mesh=unreal.load_asset(result['imports']['target-paper']['meshes'][p['key']]['path'])
                component.set_static_mesh(mesh)
                assert component.get_num_materials()==len(materials), ('Material slot count changed',name)
                # Promote every previous effective slot to an explicit override, including inherited materials.
                for i,material in enumerate(materials): component.set_material(i,material)
                assert [path(component.get_material(i)) for i in range(component.get_num_materials())]==paper_materials[name]
                expected_parts[name]['mesh']=path(mesh)
                expected_parts[name]['overrides']=[path(m) for m in component.get_editor_property('override_materials')]
            block=cc['paper_carrier_block_0']; col=M['paper']['collider']
            center=vec([a+b for a,b in zip(M['paper']['position'],col['offset'])]); extent=vec([v/2 for v in col['size']])
            assert block.get_attach_parent()==old.root_component
            block.set_relative_location(center,False,False); block.set_box_extent(extent,True)
            assert near(tup(block.relative_location),tup(center)) and near(tup(block.get_unscaled_box_extent()),tup(extent))
            for key in ['relativeLocation','worldLocation','extent']:
                expected_parts['paper_carrier_block_0'][key]=component_snapshot(block)[key]
            assert snapshot()==expected, 'Change exceeded paper mesh bindings and dock-only box'
            cls=unreal.load_class(None,'/Script/ToolchainValidation.RangeExpansionActor'); assert cls
            rail=S.spawn_actor_from_class(cls,unreal.Vector()); rail.tags=['RangeRetrievalV1']; rail.set_actor_label('RangeRetrievalV1')
            row=rows['paper-travel-rail']; obj=M['rail']; prefix=obj['id'].replace('-','_')+'_'
            rail.add_frame(prefix+'placement','None',vec(obj['position']))
            for n in row['nodes']:
                rail.add_frame(prefix+n['key'],prefix+n['parent'] if n['parent'] else prefix+'placement',vec(n['localPosition']))
            for p in row['meshes']:
                rail.add_piece(prefix+p['key'],unreal.load_asset(result['imports'][row['id']]['meshes'][p['key']]['path']),
                    prefix+p['parent'] if p['parent'] else prefix+'placement',vec([-v for v in p['parentPosition']]))
            for i,b in enumerate(obj['collider']['boxes']):
                rail.add_blocker(prefix+'block_'+str(i),vec([a+b for a,b in zip(obj['position'],b['offset'])]),vec(b['size']))
            counts(old,80,37); counts(rail,3,5)
            validate_hierarchy(old,rows['target-paper'],M['paper'],result['imports']['target-paper']['meshes'])
            validate_hierarchy(rail,row,obj,result['imports']['paper-travel-rail']['meshes'])
            validate_boxes(old,M['paper']); validate_boxes(rail,obj)
            assert snapshot()==expected and oldfiles()==result['oldFiles']
            record.update(after=expected,rail=snapshot(True)[path(rail)],paperEffectiveMaterials=paper_materials)
            # Persist review expectations before the level save; a crash in this narrow window requires manual inspection.
            result['phase']='ready-to-save-'+mapname; put(checkpoint.name,result)
            assert L.save_current_level()
            record.update(saved=True,afterHash=digest(mapfile(mapname)),parts=80,boxes=37,railParts=3,railBoxes=5)
            result['phase']='saved-'+mapname; put(checkpoint.name,result)
        for mapname in M['maps']: verify_map(mapname,result)
        result.update(ok=True,phase='complete',runtimeTested=False,freshProcessVerified=False)
        put('range-v8-native-result.json',result); put(checkpoint.name,result); unreal.log('RANGE_V8_IMPORT_PASS')
    except Exception:
        result.update(error=traceback.format_exc()); put(checkpoint.name,result); raise
