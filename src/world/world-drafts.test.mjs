import test from 'node:test';
import assert from 'node:assert/strict';
import {createDraftRegistry,worldChangeBlockers} from './world-drafts.mjs';

test('drafts survive panel unmount and incoming revisions until explicit save or discard',()=>{
 const registry=createDraftRegistry(),source={title:'Cove'},meta={label:'bible',panel:'bible'};let changed=0;
 const unsubscribe=registry.subscribe(()=>changed++);registry.sync('bible',source,3,meta);registry.edit('bible',old=>({...old,title:'Draft'}),source,3,meta);unsubscribe();
 registry.sync('bible',{title:'Changed elsewhere'},4,meta);
 assert.deepEqual(registry.getSnapshot().bible,{value:{title:'Draft'},base:3,dirty:true,...meta});
 assert.equal(source.title,'Cove');assert.equal(changed,2);
 registry.reset('bible',{title:'Changed elsewhere'},4,meta);assert.equal(registry.getSnapshot().bible.dirty,false);
 registry.edit('bible',{title:'Saved'},source,4,meta);registry.saved('bible',registry.getSnapshot().bible);registry.sync('bible',{title:'Saved'},5,meta);
 assert.equal(registry.getSnapshot().bible.base,5);assert.equal(registry.getSnapshot().bible.value.title,'Saved');
 assert.deepEqual(createDraftRegistry().getSnapshot(),{},'new session cannot inherit another world drafts');
});

test('a completed save cannot erase newer typing while the request was in flight',()=>{
 const registry=createDraftRegistry(),meta={label:'bible',panel:'bible'};
 registry.edit('bible','Submitted text','',7,meta);const submitted=registry.getSnapshot().bible;
 registry.edit('bible','New typing','',7,meta);registry.saved('bible',submitted);registry.sync('bible','Submitted text',8,meta);
 assert.equal(registry.getSnapshot().bible.value,'New typing');assert.equal(registry.getSnapshot().bible.dirty,true);assert.equal(registry.getSnapshot().bible.base,7);
});

test('switching identifies every unresolved draft and agent condition without checking focus',()=>{
 const blockers=worldChangeBlockers({active:true,pendingProposal:true,drafts:[{id:'placement/tree',label:'tree placement',panel:'scene',item:'tree'},{id:'board',label:'mood board',panel:'references'}],message:'draft thought'});
 assert.deepEqual(blockers.map(row=>row.id),['agent','proposal','placement/tree','board','message']);
 assert.equal(blockers[2].item,'tree');assert.equal(blockers[3].location,'references');
 assert.deepEqual(worldChangeBlockers({message:'  '}),[]);
 assert.deepEqual(worldChangeBlockers({loading:true,online:false}).map(row=>row.id),['busy','offline']);
});
